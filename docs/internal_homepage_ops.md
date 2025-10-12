# Homepage Ops Notes

The public learner landing page no longer surfaces operations and engineering reminders.
Keep these references available for staff reviews and release audits.

## Compliance toggle copy

When `show_compliance_details` is enabled (e.g. `/?staff=1`), the homepage still renders:

- WCAG 2.2 AA label
- Web Vitals target (LCP ≤ 2.5s)

Use this mode during accessibility or performance sweeps.

## Local verification quick start

Run the learner hub and arcade locally with separate ports when you need to observe
self/invite/aggregate transitions:

```bash
uvicorn app.main:app --reload --port 8080  # hub
uvicorn app.main:app --reload --port 8000  # arcade
```

## Privacy safeguards

- Learner telemetry is processed with anonymous tokens prior to aggregation.
- `noindex` headers and `X-Request-ID` tracing stay enabled in production.
- RFC 9457 problem detail responses explain failures to guardians and staff.

Record any additional platform guardrails in this document rather than exposing
raw operational terminology to learners.
