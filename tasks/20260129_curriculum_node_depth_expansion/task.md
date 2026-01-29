---
workflow: code
graph_profile: curriculum_2022_3r
---

# 2022 Curriculum Node Depth Expansion

기준 데이터: public/data/curriculum_math_2022.json

## 목표
- 각 도메인(NA, RR, GM, DP)의 기초(root) 노드 식별
- 기초 노드부터 시작하여 prereq 연결을 통해 depth를 확장
- 단계별로 노드를 추가하며 그래프 구조 조정

## 도메인 설명
- **NA (수와 연산)**: Number and Arithmetic - 수 개념, 덧셈, 뺄셈, 곱셈, 나눗셈
- **RR (변화와 관계)**: Regularity and Relationship - 규칙, 비례, 관계
- **GM (도형과 측정)**: Geometry and Measurement - 도형, 측정, 공간
- **DP (자료와 가능성)**: Data and Possibility - 자료 분석, 통계, 확률

## 작업 방식
1. 각 도메인에서 prereq이 없는 root 노드 식별
2. root 노드에서 시작하여 BFS/DFS 방식으로 연결 노드 탐색
3. depth별로 노드 배치 확인 및 조정
4. 필요시 누락된 prereq 연결 추가

## 제약
- 기존 노드 구조는 최대한 유지
- prereq 연결만 추가/수정 (contains, alignsTo는 변경하지 않음)
- 새 노드 추가 시 `P_TU_<slug>` 형식 사용

## 참고
- author/research-graph 페이지에서 depth는 X축(가로) 방향
- depth 1 = 가장 기초 노드, depth가 증가할수록 심화 개념
