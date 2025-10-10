from __future__ import annotations

import logging
import os
import socket
import time
import uuid
from functools import lru_cache
from threading import Lock
from typing import Callable

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

try:  # Optional OpenTelemetry support
    from opentelemetry import baggage, context, metrics, trace  # type: ignore
    from opentelemetry.exporter.otlp.proto.http.metric_exporter import (
        OTLPMetricExporter,
    )
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
        OTLPSpanExporter,
    )
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.sdk.metrics import MeterProvider
    from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    _OTEL_AVAILABLE = True
except ImportError:  # pragma: no cover - telemetry is optional in tests
    baggage = context = trace = None  # type: ignore[assignment]
    metrics = None  # type: ignore[assignment]
    OTLPMetricExporter = OTLPSpanExporter = None  # type: ignore[assignment]
    FastAPIInstrumentor = None  # type: ignore[assignment]
    MeterProvider = PeriodicExportingMetricReader = None  # type: ignore[assignment]
    TracerProvider = BatchSpanProcessor = None  # type: ignore[assignment]
    Resource = None  # type: ignore[assignment]
    _OTEL_AVAILABLE = False

logger = logging.getLogger("calculate_service")

_instrumentation_lock = Lock()
_instrumented_apps: set[int] = set()
_meter_provider_configured = False


def _is_otlp_configured(signal: str) -> bool:
    """Return True if an OTLP endpoint is configured for the given signal."""

    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip()
    if endpoint:
        return True

    if signal == "traces":
        signal_endpoint = os.getenv(
            "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", ""
        ).strip()
    elif signal == "metrics":
        signal_endpoint = os.getenv(
            "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT", ""
        ).strip()
    else:  # pragma: no cover - defensive guard for unexpected values
        signal_endpoint = ""

    return bool(signal_endpoint)


def configure_telemetry(app: FastAPI) -> None:
    """Initialise OTEL tracer/meter providers and instrument the FastAPI app."""

    if not _OTEL_AVAILABLE:
        return

    tracer_provider = _get_tracer_provider()
    meter_provider = _get_meter_provider()

    global _meter_provider_configured
    if meter_provider is not None and not _meter_provider_configured:
        metrics.set_meter_provider(meter_provider)
        _meter_provider_configured = True

    if tracer_provider is None:
        return

    with _instrumentation_lock:
        app_id = id(app)
        if app_id in _instrumented_apps:
            return
        FastAPIInstrumentor().instrument_app(app, tracer_provider=tracer_provider)
        _instrumented_apps.add(app_id)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Ensure every request surfaces a request ID and basic timing for observability."""

    async def dispatch(  # type: ignore[override]
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        start = time.perf_counter()
        request_id = request.headers.get("X-Request-ID", uuid.uuid4().hex)
        request.state.request_id = request_id

        token = None
        if _OTEL_AVAILABLE and baggage and context:
            baggage_context = baggage.set_baggage("request.id", request_id)
            token = context.attach(baggage_context)

        try:
            response = await call_next(request)
        finally:
            if _OTEL_AVAILABLE and trace and context:
                span = trace.get_current_span()
                if span.get_span_context().is_valid:
                    span.set_attribute("http.request_id", request_id)
                if token is not None:
                    context.detach(token)

        duration_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = request_id
        # Prevent accidental indexing of result/problem pages.
        response.headers.setdefault("X-Robots-Tag", "noindex")
        response.headers.setdefault("Cache-Control", "no-store")

        logger.info(
            "request completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
            },
        )
        return response


def bind_request_id(request: Request) -> Callable[[logging.LogRecord], None]:
    """Helper to inject request_id into structured logs if needed."""

    def processor(record: logging.LogRecord) -> None:
        setattr(record, "request_id", getattr(request.state, "request_id", "unknown"))

    return processor


@lru_cache(maxsize=1)
def _get_resource():
    if not _OTEL_AVAILABLE or Resource is None:
        return None

    return Resource.create(
        {
            "service.name": os.getenv("OTEL_SERVICE_NAME", "calculate-service"),
            "service.namespace": os.getenv("OTEL_SERVICE_NAMESPACE", "education"),
            "service.instance.id": os.getenv(
                "OTEL_SERVICE_INSTANCE_ID", socket.gethostname()
            ),
        }
    )


@lru_cache(maxsize=1)
def _get_tracer_provider() -> TracerProvider | None:
    if (not _OTEL_AVAILABLE) or TracerProvider is None:
        return None

    if os.getenv("OTEL_SDK_DISABLED", "false").lower() == "true":
        return None

    if not _is_otlp_configured("traces"):
        logger.debug("Skipping OTEL trace provider setup; no OTLP endpoint configured")
        return None

    current_provider = trace.get_tracer_provider()
    if isinstance(current_provider, TracerProvider):
        return current_provider

    resource = _get_resource()
    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(tracer_provider)
    return tracer_provider


@lru_cache(maxsize=1)
def _get_meter_provider() -> MeterProvider | None:
    if (not _OTEL_AVAILABLE) or MeterProvider is None:
        return None

    if os.getenv("OTEL_SDK_DISABLED", "false").lower() == "true":
        return None

    if not _is_otlp_configured("metrics"):
        logger.debug(
            "Skipping OTEL meter provider setup; no OTLP endpoint configured"
        )
        return None

    resource = _get_resource()
    metric_reader = PeriodicExportingMetricReader(OTLPMetricExporter())
    return MeterProvider(resource=resource, metric_readers=[metric_reader])


__all__ = ["configure_telemetry", "RequestContextMiddleware", "bind_request_id"]
