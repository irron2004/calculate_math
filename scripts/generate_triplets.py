#!/usr/bin/env python3
"""Generate isomorphic triplet variants (life/data/geometry) for base templates.

Usage::
    python scripts/generate_triplets.py templates/base_template.json > triplets.ndjson
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Dict, Any


@dataclass
class ContextVariant:
    label: str
    ctx: str
    prompt_template: str
    lens: str
    representation: str


TRIPLET_VARIANTS: List[ContextVariant] = [
    ContextVariant(
        label="life",
        ctx="life",
        prompt_template=(
            "{name}이는 매일 계단을 오릅니다. 첫날 {a1}계단에서 시작해 "
            "하루에 {d}계단씩 더 오르면, {n}일째에는 몇 계단을 오를까요?"
        ),
        lens="🔺",
        representation="C",
    ),
    ContextVariant(
        label="data",
        ctx="data",
        prompt_template="아래 표에서 공차를 활용해 동그라미 표시된 값을 구하세요.",
        lens="🔺",
        representation="P",
    ),
    ContextVariant(
        label="geometry",
        ctx="geometry",
        prompt_template=(
            "정사각형 타일을 한 줄씩 늘어놓습니다. 첫 줄은 {a1}장이고, 줄마다 {d}장씩 늘릴 때 "
            "{n}번째 줄은 몇 장인가요?"
        ),
        lens="🔺",
        representation="C",
    ),
]


def _resolve_scalar(value: Any) -> Any:
    if isinstance(value, list) and value:
        return value[0]
    return value


def generate_variant(base: Dict[str, Any], variant: ContextVariant) -> Dict[str, Any]:
    params = base.get("params", {})
    a1 = _resolve_scalar(params.get("a1"))
    d = _resolve_scalar(params.get("d"))
    n = _resolve_scalar(params.get("n"))

    prompt = variant.prompt_template.format(a1=a1, d=d, n=n, name="지민")
    derived = {
        **base,
        "prompt": prompt,
        "ctx": variant.ctx,
        "lens": variant.lens,
        "rep": variant.representation,
        "id": f"{base['id']}-triplet-{variant.label}",
        "tags": base.get("tags", {}),
    }
    return derived


def generate_triplets(dataset: Iterable[Dict[str, Any]]) -> Iterable[Dict[str, Any]]:
    for base in dataset:
        yield base
        for variant in TRIPLET_VARIANTS:
            yield generate_variant(base, variant)


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: generate_triplets.py path/to/base.ndjson", file=sys.stderr)
        sys.exit(1)

    base_path = Path(sys.argv[1])
    if not base_path.exists():
        print(f"Input file not found: {base_path}", file=sys.stderr)
        sys.exit(1)

    base_templates: List[Dict[str, Any]] = []
    with base_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            base_templates.append(json.loads(line))

    for entry in generate_triplets(base_templates):
        print(json.dumps(entry, ensure_ascii=False))


if __name__ == "__main__":
    main()
