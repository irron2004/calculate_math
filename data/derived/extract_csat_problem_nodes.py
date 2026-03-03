from __future__ import annotations

import csv
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable, Literal


def _extract_pages_text(pdf_path: Path) -> list[str]:
    try:
        from pdfminer.high_level import extract_text  # type: ignore

        full_text = extract_text(str(pdf_path)) or ""
        return [str(page) for page in full_text.split("\f")]
    except Exception:
        from pypdf import PdfReader

        reader = PdfReader(str(pdf_path))
        pages: list[str] = []
        for page in reader.pages:
            pages.append(page.extract_text() or "")
        return pages


Section = Literal["common", "probability", "calculus", "geometry", "unknown"]


@dataclass(frozen=True)
class ProblemNode:
    source_file: str
    year: int | None
    section: Section
    problem_number: int
    prompt_snippet: str
    topic: str
    keywords: list[str]
    node_id: str


def _guess_year_from_name(name: str) -> int | None:
    m = re.search(r"(20\d{2})", name)
    return int(m.group(1)) if m else None


def _detect_section_heading(page_text: str) -> Section:
    if re.search(r"(?m)^\s*\(\s*확률과\s*통계\s*\)\s*$", page_text):
        return "probability"
    if re.search(r"(?m)^\s*\(\s*미적분\s*\)\s*$", page_text):
        return "calculus"
    if re.search(r"(?m)^\s*\(\s*기하\s*\)\s*$", page_text):
        return "geometry"
    return "unknown"


def _split_question_blocks(text: str) -> list[tuple[int, str]]:
    starts = list(re.finditer(r"(?m)^\s*(\d{1,2})\.\s", text))
    blocks: list[tuple[int, str]] = []
    for idx, match in enumerate(starts):
        start = match.start()
        end = starts[idx + 1].start() if idx + 1 < len(starts) else len(text)
        number = int(match.group(1))
        block = text[start:end].strip()
        blocks.append((number, block))
    return blocks


def _cleanup_block(block: str) -> str:
    s = block
    s = re.sub(r"\b(홀수형|짝수형)\b", " ", s)
    s = re.sub(r"\b20\d{2}학년도\s+대학수학능력시험\s+문제지\b", " ", s)
    s = re.sub(
        r"이\s*문제지에\s*관한\s*저작권은\s*한국교육과정평가원에\s*있습니다\.?", " ", s
    )
    s = re.sub(r"한국교육과정평가원", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _normalize_snippet(block: str) -> str:
    s = _cleanup_block(block)
    return s[:220]


def _topic_and_keywords(block: str) -> tuple[str, list[str]]:
    b = block
    keys: list[str] = []

    def has(*needles: str) -> bool:
        return any(n in b for n in needles)

    if has("lim", "극한"):
        keys.append("limit")
    if has("미분", "f′", "도함수", "접선"):
        keys.append("derivative")
    if has("적분", "∫"):
        keys.append("integral")
    if has("sin", "cos", "tan", "삼각"):
        keys.append("trigonometry")
    if has("log", "ln"):
        keys.append("log")
    if has("수열", "등차수열", "등비수열"):
        keys.append("sequence")
    if has("확률", "사건", "P(", "주사위", "동전"):
        keys.append("probability")
    if has("정규분포", "표준편차", "신뢰구간"):
        keys.append("statistics")
    if has("벡터", "좌표공간", "포물선", "쌍곡선", "타원", "원기둥", "사면체"):
        keys.append("geometry")
    if has("연속"):
        keys.append("continuity")
    if has("넓이"):
        keys.append("area")
    if has("부피"):
        keys.append("volume")

    if not keys:
        return "uncategorized", []

    topic = " / ".join(dict.fromkeys(keys))
    return topic, keys


def _make_node_id(year: int | None, section: Section, number: int) -> str:
    y = str(year) if year else "unknown"
    return f"CSAT_{y}_{section.upper()}_Q{number:02d}"


def extract_problem_nodes(pdf_path: Path) -> list[ProblemNode]:
    year = _guess_year_from_name(pdf_path.name)

    results: list[ProblemNode] = []
    current_section: Section = "common"
    for raw in _extract_pages_text(pdf_path):
        if not raw.strip():
            continue

        page_blocks = _split_question_blocks(raw)
        heading_section = _detect_section_heading(raw)
        if heading_section != "unknown":
            current_section = heading_section
        else:
            nums = [n for n, _ in page_blocks]
            if any(1 <= n <= 22 for n in nums) or "수학 영역" in raw:
                current_section = "common"

        for number, block in page_blocks:
            snippet = _normalize_snippet(block)
            topic, keywords = _topic_and_keywords(block)

            if 1 <= number <= 22:
                section: Section = "common"
            elif current_section in ("probability", "calculus", "geometry"):
                section = current_section
            else:
                section = "unknown"

            node_id = _make_node_id(year, section, number)
            results.append(
                ProblemNode(
                    source_file=pdf_path.name,
                    year=year,
                    section=section,
                    problem_number=number,
                    prompt_snippet=snippet,
                    topic=topic,
                    keywords=keywords,
                    node_id=node_id,
                )
            )
    return results


def _quality_score(snippet: str) -> int:
    hangul = len(re.findall(r"[\uac00-\ud7a3]", snippet))
    private_use = len(re.findall(r"[\ue000-\uf8ff]", snippet))
    ascii_count = len(re.findall(r"[A-Za-z0-9]", snippet))
    return hangul * 3 + ascii_count - private_use * 6


def dedupe_nodes(nodes: list[ProblemNode]) -> list[ProblemNode]:
    best: dict[tuple[str, Section, int], ProblemNode] = {}
    for node in nodes:
        key = (node.source_file, node.section, node.problem_number)
        current = best.get(key)
        if not current:
            best[key] = node
            continue
        if _quality_score(node.prompt_snippet) > _quality_score(current.prompt_snippet):
            best[key] = node
    return list(best.values())


def iter_default_pdfs(data_dir: Path) -> Iterable[Path]:
    for path in sorted(data_dir.glob("*.pdf")):
        yield path


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    data_dir = repo_root / "data"
    out_path = data_dir / "derived" / "csat_problem_nodes_v1.json"
    md_path = data_dir / "derived" / "csat_problem_nodes_v1.md"
    csv_path = data_dir / "derived" / "csat_problem_nodes_v1.csv"

    all_nodes: list[ProblemNode] = []
    for pdf in iter_default_pdfs(data_dir):
        all_nodes.extend(dedupe_nodes(extract_problem_nodes(pdf)))

    payload = [asdict(node) for node in all_nodes]
    out_path.write_text(
        json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8"
    )

    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "node_id",
                "source_file",
                "year",
                "section",
                "problem_number",
                "topic",
                "keywords",
                "prompt_snippet",
            ],
        )
        writer.writeheader()
        for node in all_nodes:
            writer.writerow(
                {
                    "node_id": node.node_id,
                    "source_file": node.source_file,
                    "year": node.year,
                    "section": node.section,
                    "problem_number": node.problem_number,
                    "topic": node.topic,
                    "keywords": "|".join(node.keywords),
                    "prompt_snippet": node.prompt_snippet,
                }
            )

    grouped: dict[str, dict[str, list[ProblemNode]]] = {}
    for node in all_nodes:
        grouped.setdefault(node.source_file, {}).setdefault(node.section, []).append(
            node
        )

    section_order = {
        "common": 0,
        "probability": 1,
        "calculus": 2,
        "geometry": 3,
        "unknown": 9,
    }
    lines: list[str] = ["# CSAT Problem Nodes (v1)", ""]
    for source_file in sorted(grouped.keys()):
        lines.append(f"## {source_file}")
        for section in sorted(
            grouped[source_file].keys(), key=lambda s: section_order.get(s, 99)
        ):
            lines.append(f"### {section}")
            nodes = sorted(
                grouped[source_file][section], key=lambda n: n.problem_number
            )
            for node in nodes:
                kw = ",".join(node.keywords)
                lines.append(
                    f"- Q{node.problem_number:02d} `{node.node_id}` {node.topic}"
                    + (f" [{kw}]" if kw else "")
                    + f" — {node.prompt_snippet}"
                )
            lines.append("")
        lines.append("")
    md_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")

    print(f"Wrote {len(payload)} nodes -> {out_path}")
    print(f"Wrote csv export -> {csv_path}")
    print(f"Wrote markdown summary -> {md_path}")


if __name__ == "__main__":
    main()
