import { ArrowLeft } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import SkillTreeGraph, { type SkillTreeGraphNodeView } from '../components/SkillTreeGraph';
import { buildCourseSkillTreeGraph } from '../utils/courseSkillTree';
import '../pages/pages.css';
import '../components/SkillTreePage.css';

type ExtendedNode = SkillTreeGraphNodeView & {
  nodeType?: 'course_step' | 'skill';
  outcomes?: string[];
};

const CourseSkillTreePage: React.FC = () => {
  const navigate = useNavigate();
  const { version, nodes, edges, trees, palette } = useMemo(buildCourseSkillTreeGraph, []);
  const [focusNode, setFocusNode] = useState<ExtendedNode | null>(null);
  const [dimUnrelated, setDimUnrelated] = useState<boolean>(true);

  const handleSelect = (node: SkillTreeGraphNodeView) => {
    setFocusNode(node as ExtendedNode);
  };

  const handleClear = () => setFocusNode(null);

  const lensBadges = (lens: string[]) =>
    lens.map((item) => (
      <span key={item} className="pill" style={{ borderColor: palette[item] ?? '#475569' }}>
        {item}
      </span>
    ));

  const requirements = focusNode?.requires ?? [];
  const outcomes = focusNode?.outcomes ?? [];

  return (
    <main className="page-shell">
      <div className="page-topbar">
        <div className="page-topbar-left">
          <button className="ghost-button" type="button" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} /> 뒤로
          </button>
          <div>
            <p className="page-title">레벨 5 코스 · 요구 스킬 트리</p>
            <p className="muted">source: docs/skill_tree_course_steps_l5.json · v{version}</p>
          </div>
        </div>
        <div className="page-topbar-actions">
          <label className="pill" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={dimUnrelated}
              onChange={(event) => setDimUnrelated(event.target.checked)}
              style={{ accentColor: '#38bdf8' }}
            />
            연관된 노드만 강조
          </label>
          <button className="ghost-button" type="button" onClick={handleClear}>
            선택 해제
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="skill-tree-layout">
          <div className="skill-tree-left">
            <SkillTreeGraph
              nodes={nodes}
              edges={edges}
              trees={trees}
              palette={palette}
              onStart={() => {}}
              onSelect={handleSelect}
              focusNodeId={dimUnrelated && focusNode ? focusNode.id : null}
              dimUnrelated={dimUnrelated && Boolean(focusNode)}
              highContrast
            />
          </div>

          <aside className="skill-panel">
            {!focusNode ? (
              <div>
                <div className="skill-panel-header">
                  <div>
                    <p className="panel-kicker">선택한 노드</p>
                    <h3 className="panel-title">트리에서 노드를 선택하세요</h3>
                    <p className="panel-sub">좌측 그래프를 클릭하면 요구 스킬과 설명을 볼 수 있습니다.</p>
                  </div>
                </div>
                <ul className="panel-list">
                  <li>course_step 노드는 상단, 요구 스킬은 하단에서 이어집니다.</li>
                  <li>동일 스킬이 여러 코스에 연결된 경우도 한 번에 확인할 수 있습니다.</li>
                  <li>필요하면 dim 토글을 끄고 전체 구조를 넓게 볼 수 있습니다.</li>
                </ul>
              </div>
            ) : (
              <div>
                <div className="skill-panel-header">
                  <div>
                    <p className="panel-kicker">선택한 노드</p>
                    <h3 className="panel-title">{focusNode.label}</h3>
                    <p className="panel-sub">{focusNode.nodeType === 'course_step' ? 'Course Step' : 'Skill'} · Tier {focusNode.tier}</p>
                  </div>
                  <button className="text-button small" type="button" onClick={handleClear}>
                    선택 해제
                  </button>
                </div>

                <div className="panel-tags">
                  {lensBadges(focusNode.lens)}
                  <span className="badge">상태: {focusNode.resolvedState}</span>
                </div>

                {outcomes.length > 0 && (
                  <div className="panel-section">
                    <div className="panel-section-head">
                      <h4>학습 결과</h4>
                    </div>
                    <ul className="panel-list">
                      {outcomes.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="panel-section">
                  <div className="panel-section-head">
                    <h4>필요한 선행 스킬</h4>
                  </div>
                  <ul className="panel-list">
                    {requirements.length === 0 ? <li>필수 요구 조건 없음</li> : null}
                    {requirements.map((req) => (
                      <li key={`${focusNode.id}-req-${req.skill_id}`}>
                        <span>{req.label}</span>
                        <span className="pill">Lv {req.current_level ?? 0}/{req.min_level}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
};

export default CourseSkillTreePage;
