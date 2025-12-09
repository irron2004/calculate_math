import React, { useEffect, useMemo, useState } from 'react';

import SkillTreeGraph, { SkillEdge, SkillNode } from './SkillTreeGraph';
import './SkillTreePage.css';

type ApiNode = {
  id: string;
  label?: string;
  name?: string;
  level: number;
  state?: 'learned' | 'available' | 'locked';
  prerequisites?: string[];
  kind?: string;
};

type ApiEdge = { from: string; to: string };

type SkillTreeResponse = {
  nodes: ApiNode[];
  edges: ApiEdge[];
  max_level?: number;
  source?: string;
};

const stateLabel = (state: string | undefined) => {
  switch (state) {
    case 'learned':
      return '완료';
    case 'available':
      return '도전 가능';
    default:
      return '잠김';
  }
};

const normaliseNodes = (nodes: ApiNode[]): SkillNode[] =>
  nodes.map((node) => ({
    id: node.id,
    name: node.name ?? node.label ?? node.id,
    level: Number(node.level ?? 1),
    state: node.state,
    prerequisites: node.prerequisites ?? [],
  }));

const SkillTreePage: React.FC = () => {
  const [data, setData] = useState<SkillTreeResponse>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxLevelFilter, setMaxLevelFilter] = useState<number | null>(null);
  const [skipBoss, setSkipBoss] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (maxLevelFilter) {
        params.set('max_level', String(maxLevelFilter));
      }
      if (skipBoss) {
        params.set('skip_boss', 'true');
      }
      params.set('allow_missing', 'true');

      const res = await fetch(`/api/v1/skills/tree-diablo?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`스킬트리를 불러오지 못했습니다 (HTTP ${res.status})`);
      }
      const json = (await res.json()) as SkillTreeResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxLevelFilter, skipBoss]);

  const nodes: SkillNode[] = useMemo(() => normaliseNodes(data.nodes ?? []), [data.nodes]);
  const edges: SkillEdge[] = useMemo(
    () => (data.edges ?? []).map((edge) => ({ from: edge.from, to: edge.to })),
    [data.edges]
  );

  const maxLevel = data.max_level ?? Math.max(...nodes.map((n) => n.level), 1);

  return (
    <div className="skill-tree-layout">
      <div className="skill-tree-left">
        {loading && <div className="skill-banner">스킬트리를 불러오는 중...</div>}
        {error && (
          <div className="skill-banner error">
            <strong>오류</strong> {error}
          </div>
        )}
        {!loading && !nodes.length && !error && (
          <div className="skill-banner">표시할 스킬 노드가 없습니다.</div>
        )}
        {!!nodes.length && <SkillTreeGraph nodes={nodes} edges={edges} />}
      </div>

      <aside className="skill-panel">
        <div className="skill-panel-header">
          <div>
            <p className="panel-kicker">디아블로 스타일 스킬 트리</p>
            <h3 className="panel-title">레벨별 세로 플로우</h3>
            <p className="panel-sub">같은 레벨은 한 행에, 휠/드래그로 탐색하세요.</p>
          </div>
        </div>

        <div className="panel-section">
          <h4>필터</h4>
          <div className="form-control">
            <label htmlFor="maxLevel">표시할 최대 레벨</label>
            <div className="slider-row">
              <input
                id="maxLevel"
                type="range"
                min={1}
                max={maxLevel || 1}
                value={maxLevelFilter ?? maxLevel}
                onChange={(e) => setMaxLevelFilter(Number(e.target.value))}
              />
              <span className="pill">{maxLevelFilter ?? maxLevel}</span>
            </div>
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={skipBoss}
              onChange={(e) => setSkipBoss(e.target.checked)}
            />
            보스 노드 숨기기
          </label>

          <div className="panel-actions">
            <button className="primary-button full" onClick={fetchData} disabled={loading}>
              새로고침
            </button>
          </div>
        </div>

        <div className="panel-section">
          <h4>현재 요약</h4>
          <ul className="panel-list">
            <li>
              <span>노드 수</span>
              <span className="pill">{nodes.length}</span>
            </li>
            <li>
              <span>엣지 수</span>
              <span className="pill">{edges.length}</span>
            </li>
            <li>
              <span>데이터 소스</span>
              <span className="pill small">{data.source || 'n/a'}</span>
            </li>
          </ul>
        </div>

        <div className="panel-section">
          <h4>상태 안내</h4>
          <ul className="panel-list">
            {['available', 'learned', 'locked'].map((state) => (
              <li key={state}>
                <span>{stateLabel(state)}</span>
                <span className="pill">{state}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
};

export default SkillTreePage;
