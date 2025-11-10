# 디아블로식 스킬 트리 기반 연산 학습 서비스 — 최대 상세 기획서(v1.0)

성공 응답은 평문 JSON, 오류는 RFC 9457 Problem Details, 아동용 서비스 기준 noindex + 비개인화 광고(NPA), PII 최소화 원칙을 전제로 작성했습니다.

---

## 1. 로드맵

### 1‑1. 제품 비전

* 목표: 학습을 “스킬 해금(Unlock) → 마스터(⭐️)”로 게임화하여 몰입·반복을 유도하고, 선행 개념 충족 → 다음 개념 해금을 시각적·즉각적으로 피드백.
* 핵심 가치:

  1. 가시성 – 내 위치·다음 목표·부족 스킬을 한 화면에서 파악
  2. 진행도 연동 – 정답/오답이 레벨·해금에 직접 반영
  3. 안전/경량 – 아동 보호(PII 최소)·로딩 ≤ 3초(3G 기준)·p95 API < 300ms

### 1‑2. OKR (Q4 2025 ~ Q1 2026)

**O1. 스킬 트리 1차 공개(웹·태블릿)**

* KR1: `/skills` 첫 화면 노출, 노드(≥ 80개)·엣지(≥ 100개) 렌더 OK
* KR2: 잠금/해제 정확도 100%(서버 unlock 판정 = UI 상태)
* KR3: 트리 진입 → 세션 시작 전환율 +15%p

**O2. 문제 생성·채점 엔진 고도화**

* KR1: `op/digits/count/seed` 기반 규칙 생성 100% 적용(상수 세트 제거)
* KR2: 보스전(10문/티어) 통과 → 다음 티어 해금 워킹
* KR3: 평균 세션 길이 8~12분, 이탈률 15% 이하

**O3. 품질/성능/관측 표준화**

* KR1: API p95 < 300ms@100RPS, 5xx < 1%
* KR2: FE 단위/통합 커버리지 ≥ 80%, BE ≥ 80%
* KR3: X‑Request‑ID/OTel 100% 전파, 대시보드(Unlock/XP/보스) 운영

**O4. 정책/안전 준수**

* KR1: `X‑Robots‑Tag: noindex`·NPA·PII 최소, COPPA 체크리스트 통과
* KR2: 개인정보 안내·쿠키·동의(필요 시) 고지 UI/문서 완료

### 1‑3. 마일스톤(6주, 2주 스프린트 × 3)

| 주차    | 마일스톤             | 산출물(DoD)                                                                                                 |
| ----- | ---------------- | -------------------------------------------------------------------------------------------------------- |
| W1–W2 | 데이터·백엔드      | `graph.bipartite.json` → `skills.ui.json` 변환/검증 파이프라인, `/api/v1/skills/tree`, 문제 생성 `/problems/generate` |
| W3–W4 | 프런트 그래프 & 패널 | React Flow 스킬 트리(줌/패닝/상태 스타일), SkillDetailPanel, 세션 시작 버튼 연동                                             |
| W5–W6 | 프로그레스 & 보스전  | /skills/progress 적용, teaches→AS 레벨업, 보스전 통과→다음 티어 해금, 대시보드/테스트/성능                                        |

---

## 2. 백로그 세분화

> 표기: P0/1/2 · 예상시간(h) · 담당: 나 · DoD(수용 기준)

### Epic A. 데이터·도메인 정리 (DAG → UI 투영)

1. Bipartite → UI 변환기(자동 생성) — P0 · 6h · 나

   * DoD: `graph.bipartite.json` → `skills.ui.json(trees/nodes/edges/grid)` 생성, 사이클/누락 검사 통과
2. DAG 검증 스크립트(CI 훅) — P0 · 3h · 나

   * DoD: 중복 id/미참조/티어 역전/고아 노드 실패, PR 차단
3. 스키마/버전 관리 — P1 · 4h · 나

   * DoD: `$schema`·버전키(UTC+SHA8)·체인지로그 자동 반영

### Epic B. 백엔드 API

4. GET /api/v1/skills/tree — P0 · 4h · 나

   * DoD: `graph(ui)`+`progress(AS level)`+`unlocked(CS)` 반환, 캐시 버스팅
5. POST /api/v1/skills/progress — P0 · 6h · 나

   * DoD: 세션 결과 → XP·레벨·언락 반영, `updated, xp_awarded, last_completed` 반환
6. GET /api/v1/skills/node/{id} — P1 · 5h · 나

   * DoD: 요구/보상, 최근 정확도·속도 미니차트 데이터 제공
7. GET /api/v1/problems/generate — P0 · 5h · 나

   * DoD: `op/digits/count/seed` 규칙 기반 문항 생성(정답은 서버 채점), 상수 세트 제거

### Epic C. 프런트 그래프(React Flow) & 인터랙션

8. SkillTreeGraph(캔버스) — P0 · 10h · 나

   * DoD: 패널 3분할(그리드), 줌/패닝, 엣지 애니메이션, 60fps
9. 상태 스타일(🔒/🟡/🟢/⭐️/👑) — P0 · 4h · 나

   * DoD: 잠금·언락·마스터·보스(오라/아이콘) 시각 구분, 스냅샷 테스트
10. SkillDetailPanel — P0 · 6h · 나

   * DoD: 요구 스킬 레벨/부족 강조, XP바, 시작/보강 CTA, 접근성(포커스 트랩)

### Epic D. 프로그레스·보스전

11. teaches→AS 레벨업 엔진 — P0 · 6h · 나

   * DoD: CS 완료 → 연결된 AS `delta_level` 적용(상한 3), 레이스 컨디션 방지

12. 보스전(티어 평가) — P1 · 8h · 나

   * DoD: 10문/합격점·재도전 쿨다운, 통과 시 다음 티어 해금

### Epic E. 관측·품질·정책

13. 관측 스캐폴딩(X‑Request‑ID/OTel) — P0 · 4h · 나

   * DoD: 요청↔로그↔스팬 상관관계 100%, 기본 대시보드

14. 테스트 체계(Vitest/RTL/pytest/Playwright) — P0 · 8h · 나

   * DoD: 각 레벨 기본/오류 시나리오 녹화·리포트

15. 정책/SEO — P0 · 3h · 나

   * DoD: `X‑Robots‑Tag: noindex`, NPA, 개인정보 안내 고정

---

## 3. 첫 번째 스프린트 계획(2주)

### 포함 스토리

* A1, A2, B4, B5, C8, C9, E13, E14, E15

### 선정 이유

* 최소 기능 제품(MVF)에 필요한 데이터→API→그래프→상태의 핵심 골격을 2주 내 가시화.
* 상수 문제 제거·언락 판정·관측 표준을 초기에 고정 → 이후 기능 확장 리스크 최소화.

### 리스크 & 대응

* 데이터 불일치(ID/티어 변경): 변환·검증 CI로 PR 차단
* 성능/프레임 드랍: 뷰포트 가상화·SVG 최적화·애니메이션 밀도 제한
* 보스전 설계 지연: 스프린트1은 “요청만 정의”, 구현은 스프린트2로 분리

### 완료 기준(DoD 묶음)

* `/skills` 페이지에서 3패널 트리 렌더, 노드 ≥ 80·엣지 ≥ 100 표시
* 클릭→패널→“연습 시작”→문항 생성까지 흐름 워킹
* 언락/잠금 시각 상태와 서버 unlock 판정 일치(샘플 계정 기준 100%)
* Vitest 단위 70%+, pytest 70%+, Playwright 1개 시나리오 통과
* X‑Request‑ID·noindex 헤더·NPA 설정 확인

---

## 4. 디렉터리 구조 & 코드 스캐폴딩

### 4‑1. 디렉터리(권장)

```
root
├─ frontend/ (React 18 + Vite + TS)
│  ├─ src/
│  │  ├─ components/
│  │  │  ├─ SkillTreePage.tsx
│  │  │  ├─ SkillTreeGraph.tsx
│  │  │  └─ SkillDetailPanel.tsx
│  │  ├─ types/           # skill graph types
│  │  ├─ utils/           # unlock / level / mapping helpers
│  │  ├─ styles/
│  │  └─ tests/
│  └─ vite.config.ts
├─ backend/
│  ├─ app/
│  │  ├─ api/v1/
│  │  │  ├─ skills.py
│  │  │  └─ problems.py
│  │  ├─ services/        # progress, problem gen, projection
│  │  ├─ core/            # config, response, observability
│  │  └─ data/            # skills.ui.json (build artifact)
│  └─ tests/
└─ infra/
   ├─ ci/
   └─ docker/
```

### 4‑2. BE 스캐폴딩

응답 래퍼 없음(성공 평문) · 오류 RFC 9457 기준.

```python
# backend/app/api/v1/skills.py
from fastapi import APIRouter, HTTPException
import json, pathlib
from app.services.unlock import compute_unlocked
from app.services.progress import load_user_as_levels

router = APIRouter(prefix="/skills", tags=["skills"])
_UI = pathlib.Path("app/data/skills.ui.json")

@router.get("/tree")
def get_tree(user_id: str | None = None):
    if not _UI.exists():
        raise HTTPException(status_code=500, detail="skills_ui_missing")
    graph = json.loads(_UI.read_text(encoding="utf-8"))
    as_levels = load_user_as_levels(user_id)  # { "AS.MUL.FACTS": 2, ... }
    unlocked = { n["id"]: compute_unlocked(n, as_levels) for n in graph["nodes"] }
    return { "graph": graph, "progress": as_levels, "unlocked": unlocked }
```

```python
# backend/app/api/v1/problems.py  (상수 세트 제거)
from fastapi import APIRouter, Query
from random import randint, seed
router = APIRouter(prefix="/problems", tags=["problems"])

@router.get("/generate")
def generate(op: str = Query(pattern="^(add|sub|mul|div)$"),
             digits: int = Query(2, ge=1, le=3),
             count: int = Query(20, ge=1, le=50),
             seed_value: int | None = None):
    if seed_value is not None: seed(seed_value)
    lo, hi = 10**(digits-1), 10**digits - 1
    def one():
        a, b = randint(lo, hi), randint(lo, hi)
        if op == "add": return {"q": f"{a}+{b}=?", "a": a+b}
        if op == "sub": 
            if a<b: a,b = b,a
            return {"q": f"{a}-{b}=?", "a": a-b}
        if op == "mul": return {"q": f"{a}×{b}=?", "a": a*b}
        b = max(1,b); return {"q": f"{a*b}÷{a}=?", "a": b}
    items = [{"id": i+1, "question": it["q"]} for i,it in enumerate(one() for _ in range(count))]
    return {"op": op, "digits": digits, "count": count, "items": items}
```

```python
# backend/app/services/unlock.py
def compute_unlocked(cs_node: dict, as_levels: dict[str,int]) -> bool:
    reqs = cs_node.get("requires", [])
    return all(as_levels.get(r["skill_id"], 0) >= r.get("min_level", 1) for r in reqs)
```

### 4‑3. FE 스캐폴딩

```tsx
// frontend/src/components/SkillTreePage.tsx
import { useEffect, useState } from "react";
import { SkillTreeGraph } from "./SkillTreeGraph";
type UiGraph = { nodes: any[]; edges: any[]; trees: any[]; version: string };
type Payload = { graph: UiGraph; progress: Record<string, number>; unlocked: Record<string, boolean> };

export default function SkillTreePage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { 
    (async () => {
      try {
        const res = await fetch(import.meta.env.VITE_API_BASE_URL + "/v1/skills/tree");
        if (!res.ok) throw new Error("skills_tree_fetch_failed");
        setData(await res.json());
      } catch (e:any) { setError(e.message); }
    })();
  }, []);

  if (error) return <div className="error">API 오류: {error}</div>;
  if (!data?.graph?.nodes?.length) return <div className="empty">스킬 트리 데이터가 없습니다.</div>;

  return <SkillTreeGraph graph={data.graph} unlocked={data.unlocked} />;
}
```

```tsx
// frontend/src/components/SkillTreeGraph.tsx
import "./SkillTreeGraph.css";
type Graph = { nodes:any[]; edges:any[]; trees:any[] };
export function SkillTreeGraph({ graph, unlocked }: { graph: Graph; unlocked: Record<string, boolean> }) {
  return (
    <div className="skill-tree-graph" role="region" aria-label="Skill tree">
      {/* 노드 */}
      {graph.nodes.map(n => {
        const state = unlocked[n.id] ? "unlocked" : "locked";
        const style = { left: n.grid.col * 220, top: n.grid.row * 140 };
        return (
          <article key={n.id} className={`node ${state} ${n.boss ? "boss":""}`} style={style} tabIndex={0} aria-describedby={`${n.id}-desc`}>
            <h3>{n.label}</h3>
            <p id={`${n.id}-desc`}>필요 스킬 {n.requires?.length ?? 0}개</p>
          </article>
        );
      })}
      {/* 엣지 (간단 직선; 실제는 SVG path 권장) */}
      <svg className="edges">
        {graph.edges.map((e:any) => {
          const from = graph.nodes.find((n:any)=>n.id===e.from)?.grid;
          const to = graph.nodes.find((n:any)=>n.id===e.to)?.grid;
          if (!from || !to) return null;
          const x1 = from.col*220+110, y1 = from.row*140+40, x2 = to.col*220+110, y2 = to.row*140+40;
          return <line key={`${e.from}-${e.to}`} x1={x1} y1={y1} x2={x2} y2={y2} className="edge" />;
        })}
      </svg>
    </div>
  );
}
```

```css
/* frontend/src/components/SkillTreeGraph.css */
.skill-tree-graph{ position:relative; width:100%; height:70vh; overflow:auto; }
.node{ position:absolute; width:200px; min-height:90px; border-radius:12px; padding:10px; background:#f7f7f7; border:2px solid #ccc; }
.node.unlocked{ background:#f0fff6; border-color:#2aa772; }
.node.locked{ opacity:.6; border-style:dashed; }
.node.boss{ box-shadow:0 0 0 3px gold; }
svg.edges{ position:absolute; inset:0; pointer-events:none; }
.edge{ stroke:#999; stroke-width:2; }
```

### 4‑4. Docker / 배포 스니펫(예시)

```docker
# backend/Dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY backend/ /app
RUN pip install -r requirements.txt
ENV UVICORN_WORKERS=2 PORT=8080
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8080"]
```

```yaml
# .github/workflows/ci.yml (요지)
name: ci
on: [push, pull_request]
jobs:
  fe:
    runs-on: ubuntu-latest
    steps: [ { uses: actions/checkout@v4 }, { name: Install, run: npm ci --prefix frontend }, { name: Test, run: npm test --prefix frontend -- --ci } ]
  be:
    runs-on: ubuntu-latest
    steps: [ { uses: actions/checkout@v4 }, { name: Install, run: pip install -r backend/requirements.txt }, { name: Test, run: pytest -q backend/tests } ]
```

---

## 5. 다음 의사결정

1. 해제 규칙 범위

   * 기본: ALL + min_level(모든 선행 AS 레벨 충족)
   * 선택: ANY 그룹 허용 여부(“분수 또는 소수 중 하나만 2레벨”)
     → 결정(v1.0.1): Phase 1=ALL 고정, 제한적 ANY=교사 모드 + Phase 2

2. 보스전 설계

   * 티어 S3를 보스 노드로 고정? 합격선(예: 80/100), 재도전 쿨다운, 힌트 정책
     → 결정(v1.0.1): 합격선 80/100, 재도전 쿨다운 없음, 실패 시 리미디얼 추천

3. 도메인/정책

   * `calc.서브도메인` noindex + NPA 유지, PII 미수집, 로그 IP 축약
   * 초등 범위 밖 노드는 “미래 콘텐츠” 흐림 표시(동기 부여) 유지?
     → 결정(v1.0.1): 기본 흐림, 보호자/교사 스위치로 진하게 보기

---

### 부록 A. 데이터 계약(요약)

* Bipartite 원본: `nodes(type: "skill"|"course_step")`, `edges(type: "requires"|"teaches"|"enables")`
* UI 투영:

  * `trees[3]`: 패널(수·연산 / 분수·소수·비율 / 대수·기하·해석·통계)
  * `nodes(CS only)`: `{ id, label, tier, requires: [{skill_id,min_level}], xp, boss, grid{row,col} }`
  * `edges(CS→CS enables only)`
* 잠금 판정: `every(require.skill_id level ≥ min_level) ∧ (boss? tier_passed : true)`

### 부록 B. KPI/관측 이벤트

* KPI: Problems Served, Attempts, Correct Rate, Avg Solve, Autopass Rate, skill_unlocked, boss_passed
* FE 이벤트:

  * `skill_viewed {cs_id}`
  * `skill_unlocked {cs_id, method: 'level'|'boss'}`
  * `session_started_from_tree {cs_id}`
  * `boss_passed {tier, tries}`

### 부록 C. 테스트 체크리스트

* 단위: unlock 판정(경계값), 문제 생성 파라미터, teaches 적용
* 통합: `/skills/tree` 응답 구조·일관성, `/problems/generate` 다양성
* E2E: 잠금→보강→언락, 보스 통과→해금, 실패→재도전
* 접근성: 키보드 네비, 포커스 링, ARIA 라벨, 대비 AA

---

## MQG-P1 (문항 품질 게이트 — Phase 1 최소)

- no_duplicate_in_session: 세션 내 최근 N=50 seeds 블랙리스트 적용
- unique_solution_check: 템플릿별 속성 테스트(5~10회 샘플링)로 다중해 방지
- domain_constraints: 자릿수/부호/단위 등 파라미터 제약 선언적 검증
- invariants: 합의 보존/비례표 일관 등 구조 어서션 통과 필수
- logging: variant_id, seed, params, solver_path 표준 로그 스키마 준수

이 기준은 `/api/v1/problems/generate` 구현/테스트 DoD에 포함한다.

## 접근성: 리스트 뷰(대체 UI) 세부 스펙

- 기본 진입은 리스트 뷰(Focus 모드), Explorer=트리 뷰 토글
- 키보드 내비게이션: ↑/↓=이동, Enter=패널 열기, Space=시작
- ARIA 라벨: 요구 스킬 수·잠금 상태·진행 요약 포함
- 스크린리더 마이크로카피: “언락 가능/잠금/마스터” 상태 읽기 표준화

## A/B 인프라(초안)

- 실험 단위: 진입 뷰(리스트 vs 트리), 설명 필드(선택 vs 필수)
- 옵션 비교: In-house 플래그 vs LaunchDarkly/Statsig (비용/속도/데이터 소유)
- 분석 지표: 트리→세션 전환, 세션 착수/완료, 7/28일 유지; 유의성/파워 확보 절차 명시

---

## 마무리

* 이 기획서는 데이터→API→UI→프로그레스의 전 과정을 실행 가능한 수준으로 담았습니다.
* 스프린트1 완료 시점에 실데이터 트리 / 규칙 기반 생성 / 언락 판정이 사용자에게 보이고, 스프린트2에서 보스전·추천·대시보드를 마무리하면 MVP 품질 목표를 달성합니다.
* 위 계획대로 진행하면서, 상기 3가지 의사결정에 대한 답만 주시면 세부 파라미터(ANY 허용 범위·보스 합격선·노출 정책)를 고정해 백로그를 바로 확정하겠습니다.
