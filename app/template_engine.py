"""Problem template loader and generator aligned with the LensMath PRD."""

from __future__ import annotations

import ast
import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from threading import RLock
from typing import Any, List, Mapping, MutableMapping, Sequence

from .config import get_settings

__all__ = [
    "ConceptNode",
    "ItemInstance",
    "ProblemTemplate",
    "TemplateEngineError",
    "ConceptNotFound",
    "TemplateNotFound",
    "get_engine",
    "refresh_engine",
    "reset_engine",
    "list_concepts",
    "list_templates",
    "get_concept",
    "get_template",
    "generate_item",
]


class TemplateEngineError(RuntimeError):
    """Base exception for template loading and generation errors."""


class ConceptNotFound(TemplateEngineError):
    """Raised when a concept node lookup fails."""


class TemplateNotFound(TemplateEngineError):
    """Raised when a template lookup fails."""


@dataclass(frozen=True, slots=True)
class ConceptNode:
    id: str
    name: str
    lens: tuple[str, ...]
    prerequisites: tuple[str, ...]
    transfers: tuple[str, ...]
    summary: str
    stage_span: tuple[str, ...]
    focus_keywords: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "lens": list(self.lens),
            "prerequisites": list(self.prerequisites),
            "transfers": list(self.transfers),
            "summary": self.summary,
            "stage_span": list(self.stage_span),
            "focus_keywords": list(self.focus_keywords),
        }


@dataclass(frozen=True, slots=True)
class ParameterSpec:
    value_type: str
    min_value: Optional[int] = None
    max_value: Optional[int] = None
    step: int = 1
    choices: Optional[tuple[Any, ...]] = None

    def generate(self, rng: random.Random) -> Any:
        if self.value_type == "int":
            if self.min_value is None or self.max_value is None:
                raise TemplateEngineError("integer parameter requires min/max")
            if self.min_value > self.max_value:
                raise TemplateEngineError("integer parameter min greater than max")
            span = range(
                self.min_value,
                self.max_value + 1,
                self.step if self.step > 0 else 1,
            )
            return rng.choice(tuple(span))
        if self.value_type == "choice":
            if not self.choices:
                raise TemplateEngineError("choice parameter requires options")
            return rng.choice(self.choices)
        raise TemplateEngineError(f"Unsupported parameter type: {self.value_type}")


@dataclass(frozen=True, slots=True)
class ProblemTemplate:
    id: str
    concept: str
    step: str
    lens: tuple[str, ...]
    representation: str
    context_pack: tuple[str, ...]
    parameters: Mapping[str, ParameterSpec]
    computed_values: Mapping[str, str]
    prompt: str
    explanation: str
    answer_expression: str
    option_offsets: tuple[Any, ...]
    rubric_keywords: tuple[str, ...]

    def to_brief_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "concept": self.concept,
            "step": self.step,
            "lens": list(self.lens),
            "representation": self.representation,
            "context_pack": list(self.context_pack),
            "rubric_keywords": list(self.rubric_keywords),
            "parameter_names": list(self.parameters.keys()),
        }


@dataclass(frozen=True, slots=True)
class ItemInstance:
    id: str
    template_id: str
    concept: str
    step: str
    prompt: str
    explanation: str
    answer: int
    options: tuple[int, ...]
    context: str
    lens: tuple[str, ...]
    representation: str
    rubric_keywords: tuple[str, ...]
    variables: Mapping[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "template_id": self.template_id,
            "concept": self.concept,
            "step": self.step,
            "prompt": self.prompt,
            "explanation": self.explanation,
            "answer": self.answer,
            "options": list(self.options),
            "context": self.context,
            "lens": list(self.lens),
            "representation": self.representation,
            "rubric_keywords": list(self.rubric_keywords),
            "variables": dict(self.variables),
        }


_ALLOWED_BINOPS = {
    ast.Add: lambda a, b: a + b,
    ast.Sub: lambda a, b: a - b,
    ast.Mult: lambda a, b: a * b,
    ast.Div: lambda a, b: a / b,
    ast.FloorDiv: lambda a, b: a // b,
    ast.Mod: lambda a, b: a % b,
    ast.Pow: lambda a, b: a**b,
}
_ALLOWED_UNARY = {
    ast.UAdd: lambda a: +a,
    ast.USub: lambda a: -a,
}
_SAFE_NAMES: dict[str, Any] = {
    "abs": abs,
    "min": min,
    "max": max,
    "round": round,
    "int": int,
    "float": float,
}


class TemplateEngine:
    """Loader that materialises concept metadata and problem templates."""

    def __init__(self, concept_path: Path, template_path: Path):
        self.concept_path = Path(concept_path)
        self.template_path = Path(template_path)
        self._lock = RLock()
        self._concept_mtime: float | None = None
        self._template_mtime: float | None = None
        self._concepts: dict[str, ConceptNode] | None = None
        self._templates: dict[str, ProblemTemplate] | None = None

    def refresh(self, *, force: bool = False) -> None:
        with self._lock:
            concept_mtime = self._stat_mtime(self.concept_path)
            template_mtime = self._stat_mtime(self.template_path)

            needs_concept_reload = (
                force
                or self._concepts is None
                or self._concept_mtime is None
                or concept_mtime is None
                or concept_mtime > self._concept_mtime
            )
            needs_template_reload = (
                force
                or self._templates is None
                or self._template_mtime is None
                or template_mtime is None
                or template_mtime > self._template_mtime
            )

            if needs_concept_reload:
                self._concepts = self._load_concepts(self.concept_path)
                self._concept_mtime = concept_mtime
            if needs_template_reload:
                self._templates = self._load_templates(self.template_path)
                self._template_mtime = template_mtime

    def list_concepts(self) -> List[ConceptNode]:
        self._ensure_loaded()
        assert self._concepts is not None
        return list(self._concepts.values())

    def get_concept(self, concept_id: str) -> ConceptNode:
        self._ensure_loaded()
        assert self._concepts is not None
        try:
            return self._concepts[concept_id]
        except KeyError as exc:
            raise ConceptNotFound(concept_id) from exc

    def list_templates(
        self, *, concept: str | None = None, step: str | None = None
    ) -> List[ProblemTemplate]:
        self._ensure_loaded()
        assert self._templates is not None
        templates = list(self._templates.values())
        if concept:
            templates = [item for item in templates if item.concept == concept]
        if step:
            templates = [item for item in templates if item.step == step]
        return templates

    def get_template(self, template_id: str) -> ProblemTemplate:
        self._ensure_loaded()
        assert self._templates is not None
        try:
            return self._templates[template_id]
        except KeyError as exc:
            raise TemplateNotFound(template_id) from exc

    def instantiate(
        self,
        template_id: str,
        *,
        seed: int | None = None,
        context: str | None = None,
    ) -> ItemInstance:
        template = self.get_template(template_id)
        rng = random.Random(seed)
        variables: MutableMapping[str, Any] = {}

        for name, spec in template.parameters.items():
            variables[name] = spec.generate(rng)

        for name, expression in template.computed_values.items():
            variables[name] = self._evaluate_expression(expression, variables)

        answer_value = self._evaluate_expression(template.answer_expression, variables)
        answer_int = self._coerce_int(answer_value)

        lens = template.lens
        representation = template.representation
        context_value = self._resolve_context(template, context, rng)
        options = self._build_options(
            answer_int, template.option_offsets, variables, rng
        )

        prompt = template.prompt.format(**variables)
        explanation = template.explanation.format(**variables)
        instance_id = f"{template.id}-{rng.randrange(1_000, 99_999)}"

        enriched_variables = dict(variables)
        enriched_variables["answer"] = answer_int

        return ItemInstance(
            id=instance_id,
            template_id=template.id,
            concept=template.concept,
            step=template.step,
            prompt=prompt,
            explanation=explanation,
            answer=answer_int,
            options=tuple(options),
            context=context_value,
            lens=lens,
            representation=representation,
            rubric_keywords=template.rubric_keywords,
            variables=enriched_variables,
        )

    def _ensure_loaded(self) -> None:
        if self._concepts is None or self._templates is None:
            self.refresh(force=True)

    @staticmethod
    def _stat_mtime(path: Path) -> float | None:
        try:
            return path.stat().st_mtime
        except FileNotFoundError:
            return None

    @staticmethod
    def _load_concepts(path: Path) -> dict[str, ConceptNode]:
        if not path.exists():
            raise TemplateEngineError(f"concept data not found: {path}")
        raw_text = path.read_text(encoding="utf-8")
        parsed = json.loads(raw_text)
        if not isinstance(parsed, list):
            raise TemplateEngineError("concept data must be a list")
        concepts: dict[str, ConceptNode] = {}
        for entry in parsed:
            if not isinstance(entry, Mapping):
                raise TemplateEngineError("concept entry must be an object")
            node = ConceptNode(
                id=str(entry.get("id")),
                name=str(entry.get("name", "")),
                lens=tuple(str(item) for item in entry.get("lens", []) if item),
                prerequisites=tuple(
                    str(item) for item in entry.get("prerequisites", []) if item
                ),
                transfers=tuple(
                    str(item) for item in entry.get("transfers", []) if item
                ),
                summary=str(entry.get("summary", "")),
                stage_span=tuple(
                    str(item) for item in entry.get("stage_span", []) if item
                ),
                focus_keywords=tuple(
                    str(item) for item in entry.get("focus_keywords", []) if item
                ),
            )
            concepts[node.id] = node
        return concepts

    @staticmethod
    def _load_templates(path: Path) -> dict[str, ProblemTemplate]:
        if not path.exists():
            raise TemplateEngineError(f"template data not found: {path}")
        raw_text = path.read_text(encoding="utf-8")
        parsed = json.loads(raw_text)
        if not isinstance(parsed, list):
            raise TemplateEngineError("template data must be a list")
        templates: dict[str, ProblemTemplate] = {}
        for entry in parsed:
            if not isinstance(entry, Mapping):
                raise TemplateEngineError("template entry must be an object")
            template_id = str(entry.get("id"))
            parameters = {
                name: ParameterSpec(
                    value_type=str(spec.get("type")),
                    min_value=spec.get("min"),
                    max_value=spec.get("max"),
                    step=spec.get("step", 1),
                    choices=tuple(spec.get("choices", []))
                    if spec.get("choices") is not None
                    else None,
                )
                for name, spec in (entry.get("parameters") or {}).items()
            }
            computed_values = {
                str(name): str(expr)
                for name, expr in (entry.get("computed_values") or {}).items()
            }
            option_offsets = tuple(entry.get("option_offsets", []))
            rubric_keywords = tuple(
                str(keyword) for keyword in entry.get("rubric_keywords", [])
            )
            template = ProblemTemplate(
                id=template_id,
                concept=str(entry.get("concept")),
                step=str(entry.get("step")),
                lens=tuple(str(item) for item in entry.get("lens", []) if item),
                representation=str(entry.get("representation", "")),
                context_pack=tuple(
                    str(item) for item in entry.get("context_pack", []) if item
                ),
                parameters=parameters,
                computed_values=computed_values,
                prompt=str(entry.get("prompt", "")),
                explanation=str(entry.get("explanation", "")),
                answer_expression=str(entry.get("answer_expression", "")),
                option_offsets=option_offsets,
                rubric_keywords=rubric_keywords,
            )
            templates[template.id] = template
        return templates

    def _evaluate_expression(
        self, expression: str, variables: Mapping[str, Any]
    ) -> Any:
        try:
            node = ast.parse(expression, mode="eval")
        except SyntaxError as exc:
            raise TemplateEngineError(f"invalid expression: {expression}") from exc
        return self._eval_ast(node.body, variables)

    def _eval_ast(self, node: ast.AST, variables: Mapping[str, Any]) -> Any:
        if isinstance(node, ast.Constant):
            return node.value
        if isinstance(node, ast.Name):
            if node.id in variables:
                return variables[node.id]
            if node.id in _SAFE_NAMES:
                return _SAFE_NAMES[node.id]
            raise TemplateEngineError(f"unknown variable '{node.id}'")
        if isinstance(node, ast.BinOp):
            operator = _ALLOWED_BINOPS.get(type(node.op))
            if operator is None:
                raise TemplateEngineError("unsupported operator in expression")
            left = self._eval_ast(node.left, variables)
            right = self._eval_ast(node.right, variables)
            return operator(left, right)
        if isinstance(node, ast.UnaryOp):
            operator = _ALLOWED_UNARY.get(type(node.op))
            if operator is None:
                raise TemplateEngineError("unsupported unary operator")
            operand = self._eval_ast(node.operand, variables)
            return operator(operand)
        if isinstance(node, ast.Call):
            func = self._eval_ast(node.func, variables)
            if func not in _SAFE_NAMES.values():
                raise TemplateEngineError("function is not allowed in expression")
            args = [self._eval_ast(arg, variables) for arg in node.args]
            kwargs = {
                keyword.arg: self._eval_ast(keyword.value, variables)
                for keyword in node.keywords
            }
            return func(*args, **kwargs)
        raise TemplateEngineError("unsupported expression node")

    def _coerce_int(self, value: Any) -> int:
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            if math.isclose(value, round(value)):
                return int(round(value))
            return int(value)
        raise TemplateEngineError("expression did not evaluate to a number")

    def _resolve_context(
        self, template: ProblemTemplate, preferred: str | None, rng: random.Random
    ) -> str:
        if preferred and preferred in template.context_pack:
            return preferred
        if template.context_pack:
            return rng.choice(template.context_pack)
        return "generic"

    def _build_options(
        self,
        answer: int,
        offsets: Sequence[Any],
        variables: Mapping[str, Any],
        rng: random.Random,
    ) -> List[int]:
        option_set = {answer}
        for raw_offset in offsets:
            delta = self._resolve_offset(raw_offset, variables)
            candidate = answer + delta
            if candidate <= 0 or candidate == answer:
                continue
            option_set.add(candidate)
        # Ensure at least 4 unique options
        guard = 0
        max_span = max(5, abs(answer))
        while len(option_set) < 4 and guard < 20:
            guard += 1
            delta = rng.randint(1, max_span)
            candidate = answer + delta if guard % 2 else max(1, answer - delta)
            if candidate != answer:
                option_set.add(candidate)
        options = list(option_set)
        rng.shuffle(options)
        return options

    def _resolve_offset(self, raw_offset: Any, variables: Mapping[str, Any]) -> int:
        if isinstance(raw_offset, (int, float)):
            return self._coerce_int(raw_offset)
        if isinstance(raw_offset, str):
            value = self._evaluate_expression(raw_offset, variables)
            return self._coerce_int(value)
        raise TemplateEngineError("offset must be numeric or expression string")


_engine_lock = RLock()
_engine: TemplateEngine | None = None


def get_engine() -> TemplateEngine:
    global _engine
    with _engine_lock:
        if _engine is None:
            settings = get_settings()
            _engine = TemplateEngine(
                concept_path=settings.concept_data_path,
                template_path=settings.template_data_path,
            )
        return _engine


def refresh_engine(*, force: bool = False) -> TemplateEngine:
    engine = get_engine()
    engine.refresh(force=force)
    return engine


def reset_engine() -> None:
    global _engine
    with _engine_lock:
        _engine = None


def list_concepts() -> List[ConceptNode]:
    engine = refresh_engine()
    return engine.list_concepts()


def list_templates(
    *, concept: str | None = None, step: str | None = None
) -> List[ProblemTemplate]:
    engine = refresh_engine()
    return engine.list_templates(concept=concept, step=step)


def get_concept(concept_id: str) -> ConceptNode:
    engine = refresh_engine()
    return engine.get_concept(concept_id)


def get_template(template_id: str) -> ProblemTemplate:
    engine = refresh_engine()
    return engine.get_template(template_id)


def generate_item(
    template_id: str,
    *,
    seed: int | None = None,
    context: str | None = None,
) -> ItemInstance:
    engine = refresh_engine()
    return engine.instantiate(template_id, seed=seed, context=context)
