# Curriculum Viewer (new) + Legacy (reference)

이 레포는 새 프로젝트를 시작하는 워크스페이스다. 기존 서비스 코드는 `.legacy/`에 보관되어 있으며 신규 개발은 루트 기준으로 진행한다.

## Agents (tmux 오케스트레이터)

- 설정/템플릿: `agents/`
- 실행: `./agents_up.sh <task_id>`
- PRD v1용 graph profile: `curriculum_viewer_v1` (see `agents/config/graph_profiles.json`)

예시:
```bash
./agents_up.sh curriculum_viewer_mvp_v1
```

여러 task를 순차 실행:
```bash
./agents_up.sh curriculum_viewer_mvp curriculum_viewer_data_visualization_v1
# 또는
TASK_IDS="curriculum_viewer_mvp curriculum_viewer_data_visualization_v1" ./agents_up.sh
```

작업(task) 파일은 `tasks/<id>.md` 또는 `tasks/<id>/task.md` 형태를 사용한다.

> `agents_up.sh`는 기본적으로 `.venv/bin/activate`를 찾고, 없으면 `.legacy/.venv/bin/activate`를 사용한다.

## MVP v1 Task

- PRD v1 작업 파일: `tasks/curriculum_viewer_mvp_v1.md`

## Curriculum Viewer v1 — Data Validation

```bash
cd curriculum-viewer && npm run validate:data
cd curriculum-viewer && npm run validate:data -- --file <path>
```
