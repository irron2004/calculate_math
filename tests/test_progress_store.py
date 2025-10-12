import json
from pathlib import Path

from app.progress_store import ProgressStore
from app.progress_store import ProgressSnapshot


def _create_dataset(tmp_path: Path) -> Path:
    payload = {
        "meta": {"xp": {"milestones": [100]}},
        "users": [
            {
                "user_id": "1",
                "updated_at": "2024-01-01T00:00:00+00:00",
                "total_xp": 0,
                "nodes": {},
                "skills": {},
            }
        ],
    }
    dataset = tmp_path / "progress.json"
    dataset.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return dataset


def test_update_snapshot_persists_changes(tmp_path):
    dataset = _create_dataset(tmp_path)
    store = ProgressStore(dataset)

    def mutator(snapshot: ProgressSnapshot) -> None:
        snapshot.total_xp += 10

    store.update_snapshot("1", mutator)

    reloaded = json.loads(dataset.read_text(encoding="utf-8"))
    assert reloaded["users"][0]["total_xp"] == 10
