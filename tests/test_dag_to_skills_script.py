from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def test_dag_to_skills_skips_sample_payload(tmp_path):
    repo_root = Path(__file__).resolve().parents[1]
    doc_path = tmp_path / "dag.md"
    doc_path.write_text(
        """```json
{
  "version": "2025-10-12",
  "nodes": [
    { "id": "C01-S1", "type": "course_step", "label": "코스01·S1" }
  ],
  "edges": []
}
```""",
        encoding="utf-8",
    )

    output_path = tmp_path / "skills.json"
    existing_payload = {
        "version": "keep-me",
        "palette": {"transform": "#6C5CE7"},
        "nodes": [
            {
                "id": f"node_{index}",
                "label": f"Node {index}",
                "tier": 1,
                "kind": "core",
                "requires": None,
                "boss": None,
                "xp_per_try": 4,
                "xp_per_correct": 8,
                "xp_to_level": [0, 40],
                "lens": [],
                "keywords": [],
                "micro_skills": [],
                "misconceptions": [],
                "lrc_min": None,
            }
            for index in range(12)
        ],
        "edges": [],
    }
    output_path.write_text(json.dumps(existing_payload), encoding="utf-8")

    completed = subprocess.run(
        [
            sys.executable,
            "scripts/dag_to_skills.py",
            "--in",
            str(doc_path),
            "--out",
            str(output_path),
        ],
        cwd=repo_root,
        capture_output=True,
        check=True,
        text=True,
    )

    result_payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert result_payload == existing_payload
    combined_output = f"{completed.stdout}\n{completed.stderr}"
    assert "Skipped rewrite" in combined_output
