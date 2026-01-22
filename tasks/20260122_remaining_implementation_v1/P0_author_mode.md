# P0-1: Author Mode 완성

## 목표
Author(관리자)가 그래프 엣지를 직접 편집/저장/배포할 수 있게 한다.

## 현재 상태
- AuthorEditorPage.tsx 존재
- SkillGraphPreview.tsx 존재
- graphRepository.ts 존재
- **엣지 추가/삭제 UI 미구현**

## 구현 항목

### 1. 엣지 연결 UI
```tsx
// AuthorEditorPage.tsx
const onConnect = useCallback((params: Connection) => {
  // 1. EdgeTypeSelectModal 열기
  // 2. 사용자가 requires/prepares_for 선택
  // 3. 엣지 추가
}, []);
```

**상세**:
- React Flow의 `onConnect` 콜백 활용
- 노드 A → B 드래그 시 연결선 표시
- 연결 완료 시 엣지 타입 선택 모달 표시

### 2. EdgeTypeSelectModal 컴포넌트
```tsx
interface Props {
  isOpen: boolean;
  onSelect: (type: 'requires' | 'prepares_for') => void;
  onCancel: () => void;
}
```

**UI**:
- "requires (선수 관계)" 버튼
- "prepares_for (연계 관계)" 버튼
- 취소 버튼

### 3. 엣지 삭제 UI
```tsx
const onEdgeClick = useCallback((event, edge) => {
  if (confirm('이 연결을 삭제하시겠습니까?')) {
    removeEdge(edge.id);
  }
}, []);
```

### 4. 노드 드래그 + 위치 저장
```tsx
const onNodeDragStop = useCallback((event, node) => {
  updateNodePosition(node.id, node.position);
}, []);
```

### 5. 실시간 검증
- 엣지 추가/삭제 시 자동으로 validation 실행
- 사이클 감지 시 경고 표시
- 검증 결과 패널 업데이트

## 테스트 시나리오

1. Author 로그인 → Editor 페이지 진입
2. 노드 A에서 노드 B로 드래그
3. 엣지 타입 모달에서 "requires" 선택
4. 새 엣지가 그래프에 표시됨
5. 저장 버튼 클릭 → localStorage/서버 저장
6. 새로고침 후에도 엣지 유지됨

## 관련 파일
- `src/pages/AuthorEditorPage.tsx`
- `src/components/SkillGraphPreview.tsx`
- `src/components/EdgeTypeSelectModal.tsx` (신규)
- `src/lib/repository/graphRepository.ts`
