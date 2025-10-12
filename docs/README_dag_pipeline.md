
# DAG → skills.json 파이프라인

## 파일
- `docs/skills.schema.json` : 스킬 트리 JSON 스키마
- `scripts/dag_to_skills.py` : `docs/dag.md`를 파싱해 `skills.json` 생성
- `scripts/validate_skills.py` : 스킬 JSON 검증(스키마/사이클/참조)
- `app/data/skills.baseline.json` : 대화에서 정리된 베이스라인 DAG (샘플)

## 사용법
```bash
python scripts/dag_to_skills.py --in docs/dag.md --out app/data/skills.json
python scripts/validate_skills.py --in app/data/skills.json --schema docs/skills.schema.json
```
- `jsonschema`, `PyYAML`이 설치되어 있지 않으면 스키마 검증이 자동으로 건너뛰어집니다. 필요한 경우 `.venv/bin/pip install jsonschema PyYAML`로 추가하세요.

### Markdown 작성 팁
- 머메이드 블록에서 `A[노드라벨] --> B[노드라벨]` 형태로 엣지를 적을 수 있습니다.
- 엣지 텍스트에 `enables`가 포함되면 `type:"enables"`로 기록됩니다.
- 노드 속성은 ` ```csv nodes ` 블록에서 표로 정의하면 정확하게 반영됩니다.
  예)
  ```csv nodes
  id,label,tier,kind,lens,keywords,micro_skills
  add_1d,덧셈(한 자리),1,core,accumulation,"합;교환법칙","세로셈셋업;보정"
  ```

## 주의
- 실제 `docs/dag.md` 포맷이 다르면 `dag_to_skills.py`를 쉽게 커스터마이즈할 수 있게 작성했습니다.
- 스키마 검증(`jsonschema`)은 선택입니다: `pip install jsonschema pyyaml`
