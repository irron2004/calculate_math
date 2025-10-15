# Work List

작업 내역을 시간순으로 기록합니다.

## 2025-10-15

### Railway 배포 환경 스킬 트리 API 오류 수정

**문제**: Railway 프로덕션 환경에서 `/api/v1/skills/tree` 엔드포인트가 다음 오류를 반환:
```
AttributeError: 'pydantic_core._pydantic_core.ValidationInfo' object has no attribute 'palette'
```

**원인**: `app/schemas/skill.py`의 `SkillGraphSpec._cross_field_validation` 메서드가 Pydantic v1 문법을 사용하고 있었음:
- 메서드 시그니처: `def _cross_field_validation(cls, values: "SkillGraphSpec")`
- 필드 접근: `values.palette`, `values.nodes`, `values.edges`

Pydantic v2에서 `@model_validator(mode="after")`는 `values` dict 대신 `self` (모델 인스턴스)를 전달하므로 호환되지 않음.

**수정 내역**:
- 메서드 시그니처를 `def _cross_field_validation(self) -> "SkillGraphSpec"`로 변경
- `values.palette` → `self.palette`, `values.nodes` → `self.nodes`, `values.edges` → `self.edges`로 변경
- `cls._validate_requirements()`, `cls._validate_boss_node()` → `self._validate_requirements()`, `self._validate_boss_node()`로 변경
- 반환값 `return values` → `return self`로 변경

**커밋**: `1d403df` - fix(schemas): update SkillGraphSpec validator for Pydantic v2 compatibility

**결과**: Railway 자동 재배포 후 스킬 트리 API 정상 동작 예상

**참고 파일**:
- `app/schemas/skill.py:101-135` - 수정된 model_validator
- `app/routers/skills.py:162-266` - 스킬 트리 API 엔드포인트
