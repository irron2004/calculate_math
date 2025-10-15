import React, { useMemo } from 'react';

import type {
  SkillNodeProgress,
  SkillTreeEdge,
  SkillTreeGraphTree,
  SkillTreeRequirement,
  SkillTreeTeaching,
  SkillTreeNodeState,
} from '../types';
import './SkillTreeGraph.css';

export type SkillTreeGraphNodeView = {
  id: string;
  tree: string;
  tier: number;
  label: string;
  lens: string[];
  boss?: boolean;
  grid: {
    row: number;
    col: number;
  };
  xp: {
    per_try: number;
    per_correct: number;
  };
  requires: SkillTreeRequirement[];
  teaches: SkillTreeTeaching[];
  state: SkillTreeNodeState;
  progress?: SkillNodeProgress | null;
};

type SkillTreeGraphProps = {
  nodes: SkillTreeGraphNodeView[];
  edges: SkillTreeEdge[];
  trees: SkillTreeGraphTree[];
  palette: Record<string, string>;
  onStart: (node: SkillTreeGraphNodeView) => void;
  onSelect?: (node: SkillTreeGraphNodeView) => void;
};

type PositionedNode = {
  node: SkillTreeGraphNodeView;
  x: number;
  y: number;
  width: number;
  height: number;
  groupIndex: number;
};

const PANEL_WIDTH = 720;
const PANEL_PADDING_X = 80;
const NODE_WIDTH = 220;
const NODE_HEIGHT = 132;
const NODE_COLUMN_SPACING = 240;
const ROW_GAP = 200;

const statusLabel: Record<string, string> = {
  locked: '잠김',
  available: '진행 가능',
  completed: '완료',
};

const statusColor: Record<string, string> = {
  locked: 'rgba(148, 163, 184, 0.35)',
  available: '#38bdf8',
  completed: '#22c55e',
};

function groupOrder(groups: SkillTreeGraphTree[]): Record<string, number> {
  return groups
    .slice()
    .sort((a, b) => a.order - b.order)
    .reduce<Record<string, number>>((accumulator, group, index) => {
      accumulator[group.id] = index;
      return accumulator;
    }, {});
}

function buildPositionedNodes(
  nodes: SkillTreeGraphNodeView[],
  trees: SkillTreeGraphTree[],
): { positioned: PositionedNode[]; height: number } {
  const orderLookup = groupOrder(trees);
  const positioned: PositionedNode[] = [];
  let maxRowIndex = 0;

  nodes
    .slice()
    .sort((a, b) => {
      const treeA = orderLookup[a.tree] ?? Infinity;
      const treeB = orderLookup[b.tree] ?? Infinity;
      if (treeA !== treeB) {
        return treeA - treeB;
      }
      const rowA = a.grid?.row ?? a.tier;
      const rowB = b.grid?.row ?? b.tier;
      if (rowA !== rowB) {
        return rowA - rowB;
      }
      const colA = a.grid?.col ?? 0;
      const colB = b.grid?.col ?? 0;
      if (colA !== colB) {
        return colA - colB;
      }
      return a.label.localeCompare(b.label, 'ko');
    })
    .forEach((node) => {
      const groupIndex = orderLookup[node.tree] ?? trees.length;
      const panelOffsetX = groupIndex * PANEL_WIDTH;
      const colIndex = Math.max(0, (node.grid?.col ?? 1) - 1);
      const rowIndex = Math.max(0, (node.grid?.row ?? node.tier) - 1);
      const x = panelOffsetX + PANEL_PADDING_X + colIndex * NODE_COLUMN_SPACING;
      const y = rowIndex * ROW_GAP;

      positioned.push({
        node,
        x,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        groupIndex,
      });

      if (rowIndex > maxRowIndex) {
        maxRowIndex = rowIndex;
      }
    });

  const height = Math.max((maxRowIndex + 1) * ROW_GAP + NODE_HEIGHT + 160, 560);

  return { positioned, height };
}

function formatRequirements(requirements: SkillTreeRequirement[]): string {
  if (!requirements.length) {
    return '필요 조건: 없음';
  }
  return `필요 조건: ${requirements
    .map((req) => `${req.label} Lv ${req.current_level}/${req.min_level}`)
    .join(', ')}`;
}

function formatTeaches(teaches: SkillTreeTeaching[]): string {
  if (!teaches.length) {
    return '보상: XP 및 진행도';
  }
  return `보상: ${teaches.map((teach) => `${teach.label} +${teach.delta_level}`).join(', ')}`;
}

function formatXpSummary(progress?: SkillNodeProgress | null): string | null {
  if (!progress) {
    return null;
  }
  const earned = typeof progress.xp_earned === 'number' ? progress.xp_earned : 0;
  const required =
    typeof progress.xp_required === 'number' && progress.xp_required > 0
      ? progress.xp_required
      : null;
  if (required) {
    return `누적 XP ${earned.toLocaleString()} / ${required.toLocaleString()}`;
  }
  if (earned > 0) {
    return `누적 XP ${earned.toLocaleString()}`;
  }
  return null;
}

function buildEdgePath(
  from: PositionedNode,
  to: PositionedNode,
): string {
  const x1 = from.x + from.width / 2;
  const y1 = from.y + from.height;
  const x2 = to.x + to.width / 2;
  const y2 = to.y;
  const control1Y = y1 + 48;
  const control2Y = y2 - 48;
  return `M ${x1} ${y1} C ${x1} ${control1Y}, ${x2} ${control2Y}, ${x2} ${y2}`;
}

const SkillTreeGraph: React.FC<SkillTreeGraphProps> = ({
  nodes,
  edges,
  trees,
  palette,
  onStart,
  onSelect,
}) => {
  const { positioned, height } = useMemo(
    () => buildPositionedNodes(nodes, trees),
    [nodes, trees],
  );

  const canvasWidth = Math.max(trees.length * PANEL_WIDTH, PANEL_WIDTH);
  const treeOrderLookup = useMemo(() => groupOrder(trees), [trees]);

  const positionedMap = useMemo(() => {
    return positioned.reduce<Record<string, PositionedNode>>((accumulator, item) => {
      accumulator[item.node.id] = item;
      return accumulator;
    }, {});
  }, [positioned]);

  const orderedGroups = useMemo(
    () => trees.slice().sort((a, b) => a.order - b.order),
    [trees],
  );

  const tierGuidelines = useMemo(() => {
    const tiers = new Set<number>();
    nodes.forEach((node) => tiers.add(node.tier));
    return Array.from(tiers).sort((a, b) => a - b);
  }, [nodes]);

  return (
    <div className="skill-tree-graph" data-testid="skill-tree-graph">
      <div className="skill-tree-graph__canvas" style={{ height, width: canvasWidth }}>
        {orderedGroups.map((group) => {
          const index = treeOrderLookup[group.id] ?? 0;
          const x = index * PANEL_WIDTH;
          return (
            <React.Fragment key={group.id}>
              <div
                className="skill-tree-graph__group-column"
                style={{ left: x, width: PANEL_WIDTH }}
                aria-hidden="true"
              />
              <div
                className="skill-tree-graph__group-label"
                style={{ left: x + PANEL_PADDING_X }}
              >
                {group.label}
              </div>
            </React.Fragment>
          );
        })}

        {tierGuidelines.map((tier) => (
          <React.Fragment key={`tier-${tier}`}>
            <div
              className="skill-tree-graph__tier-guideline"
              style={{ top: (tier - 1) * ROW_GAP + NODE_HEIGHT / 2 }}
              aria-hidden="true"
            />
            <div
              className="skill-tree-graph__tier-label"
              style={{ top: (tier - 1) * ROW_GAP + NODE_HEIGHT / 2 - 10 }}
            >
              Tier {tier}
            </div>
          </React.Fragment>
        ))}

        <svg className="skill-tree-graph__edge-canvas">
          {edges.map((edge) => {
            const from = positionedMap[edge.from];
            const to = positionedMap[edge.to];
            if (!from || !to) {
              return null;
            }
            return (
              <path
                key={`${edge.from}-${edge.to}`}
                className="skill-tree-graph__edge"
                d={buildEdgePath(from, to)}
                stroke={statusColor[from.node.state.value]}
              />
            );
          })}
        </svg>

        {positioned.map((item) => {
          const { node, x, y } = item;
          const stateValue = node.state.value;
          const accentColor = palette[node.lens[0] ?? ''] ?? statusColor[stateValue];
          const disabled = stateValue === 'locked';
          const xpSummary = formatXpSummary(node.progress);
          const handleSelect = () => {
            if (onSelect) {
              onSelect(node);
            }
          };
          const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
            if (!onSelect) {
              return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(node);
            }
          };

          return (
            <article
              key={node.id}
              className="skill-tree-node"
              data-node-id={node.id}
              data-state={stateValue}
              style={{ left: x, top: y }}
              aria-label={`${node.label} ${statusLabel[stateValue]}`}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              onClick={handleSelect}
              onKeyDown={handleKeyDown}
            >
              <div
                className="skill-tree-graph__node-glow"
                style={{ background: `radial-gradient(circle, ${accentColor}33, transparent 70%)` }}
              />
              <span
                className="skill-tree-node__status"
                style={{ color: accentColor }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: accentColor,
                  }}
                  aria-hidden="true"
                />
                {statusLabel[stateValue] ?? stateValue}
              </span>
              <h3 className="skill-tree-node__title">
                {node.label}
                {node.boss ? <span className="skill-tree-node__boss">BOSS</span> : null}
              </h3>
              <div className="skill-tree-node__stats">
                Tier {node.tier} · XP {node.xp.per_try}/{node.xp.per_correct}
              </div>
              {xpSummary ? <div className="skill-tree-node__stats">{xpSummary}</div> : null}
              <div className="skill-tree-node__badges">
                {node.lens.map((lens) => (
                  <span
                    key={`${node.id}-lens-${lens}`}
                    className="skill-tree-node__badge"
                    style={{
                      borderColor: palette[lens] ? `${palette[lens]}55` : undefined,
                      color: palette[lens] ?? undefined,
                    }}
                  >
                    {lens}
                  </span>
                ))}
              </div>
              <div className="skill-tree-node__stats">{formatRequirements(node.requires)}</div>
              <div className="skill-tree-node__stats">{formatTeaches(node.teaches)}</div>
              <button
                type="button"
                className="skill-tree-node__action"
                onClick={(event) => {
                  event.stopPropagation();
                  onStart(node);
                }}
                disabled={disabled}
                aria-disabled={disabled}
              >
                학습 시작
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default SkillTreeGraph;
