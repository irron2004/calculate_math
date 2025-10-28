import { ArrowRight, CheckCircle, Lock, Sparkles, Star } from 'lucide-react';
import React, { useMemo } from 'react';

import type {
  SkillNodeProgress,
  SkillTreeEdge,
  SkillTreeGraphTree,
  SkillTreeRequirement,
  SkillTreeTeaching,
  SkillTreeNodeState,
} from '../types';
import {
  SKILL_STATE_BADGE_CLASS,
  SKILL_STATE_COLORS,
  SKILL_STATE_META,
  type SkillState,
} from '../constants/skillStates';
import { formatList, t } from '../utils/i18n';
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
  resolvedState: SkillState;
  progress?: SkillNodeProgress | null;
};

type SkillTreeGraphProps = {
  nodes: SkillTreeGraphNodeView[];
  edges: SkillTreeEdge[];
  trees: SkillTreeGraphTree[];
  palette: Record<string, string>;
  onStart: (node: SkillTreeGraphNodeView) => void;
  onSelect?: (node: SkillTreeGraphNodeView) => void;
  zoom?: number;
  highContrast?: boolean;
  focusNodeId?: string | null;
  dimUnrelated?: boolean;
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

const ICON_COMPONENTS = {
  lock: Lock,
  sparkles: Sparkles,
  'arrow-right': ArrowRight,
  'check-circle': CheckCircle,
  star: Star,
} as const;

function groupOrder(groups: SkillTreeGraphTree[]): Record<string, number> {
  return groups
    .slice()
    .sort((a, b) => a.order - b.order)
    .reduce<Record<string, number>>((accumulator, group, index) => {
      accumulator[group.id] = index;
      return accumulator;
    }, {});
}

function average(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

type LayoutGraph = {
  nodes: SkillTreeGraphNodeView[];
  edges: SkillTreeEdge[];
};

type GraphIndex = {
  parents: Map<string, string[]>;
  children: Map<string, string[]>;
  depth: Map<string, number>;
};

function buildGraphIndex({ nodes, edges }: LayoutGraph): GraphIndex {
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();

  nodes.forEach((node) => {
    parents.set(node.id, []);
    children.set(node.id, []);
  });

  edges.forEach((edge) => {
    if (!parents.has(edge.to)) {
      parents.set(edge.to, []);
    }
    if (!children.has(edge.from)) {
      children.set(edge.from, []);
    }
    parents.get(edge.to)!.push(edge.from);
    children.get(edge.from)!.push(edge.to);
  });

  const depth = new Map<string, number>();

  const queue: string[] = [];
  nodes.forEach((node) => {
    const hasParent = (parents.get(node.id) ?? []).length > 0;
    if (!hasParent) {
      depth.set(node.id, 0);
      queue.push(node.id);
    }
  });

  const visitCount = new Map<string, number>();

  while (queue.length) {
    const nodeId = queue.shift()!;
    const nodeDepth = depth.get(nodeId) ?? 0;
    const childIds = children.get(nodeId) ?? [];
    childIds.forEach((childId) => {
      const visited = (visitCount.get(childId) ?? 0) + 1;
      visitCount.set(childId, visited);
      const parentIds = parents.get(childId) ?? [];
      const maxParentDepth = Math.max(
        ...parentIds.map((id) => depth.get(id) ?? 0),
      );
      const candidateDepth = Math.max(nodeDepth + 1, maxParentDepth + 1);
      const currentDepth = depth.get(childId);
      if (currentDepth === undefined || candidateDepth > currentDepth) {
        depth.set(childId, candidateDepth);
      }
      if (visited >= parentIds.length) {
        queue.push(childId);
      }
    });
  }

  nodes.forEach((node) => {
    if (!depth.has(node.id)) {
      depth.set(node.id, 0);
    }
  });

  return { parents, children, depth };
}

function buildColumnAssignments(
  groupNodes: SkillTreeGraphNodeView[],
  groupEdges: SkillTreeEdge[],
  graphIndex: GraphIndex,
): Map<string, number> {
  const tierBuckets = new Map<number, SkillTreeGraphNodeView[]>();
  groupNodes.forEach((node) => {
    const tier = Math.max(
      1,
      node.grid?.row ?? node.tier ?? (graphIndex.depth.get(node.id) ?? 0) + 1,
    );
    if (!tierBuckets.has(tier)) {
      tierBuckets.set(tier, []);
    }
    tierBuckets.get(tier)!.push(node);
  });

  const parentLookup = new Map<string, string[]>();
  groupEdges.forEach((edge) => {
    if (!parentLookup.has(edge.to)) {
      parentLookup.set(edge.to, []);
    }
    parentLookup.get(edge.to)!.push(edge.from);
  });

  const columnAssignments = new Map<string, number>();
  const placementTracker = new Map<number, number>();

  Array.from(tierBuckets.keys())
    .sort((a, b) => a - b)
    .forEach((tier) => {
      const tierNodes = tierBuckets.get(tier)!;
      tierNodes.sort((a, b) => {
        const parentColsA =
          parentLookup
            .get(a.id)
            ?.map((parentId) => columnAssignments.get(parentId))
            .filter((value): value is number => typeof value === 'number') ?? [];
        const parentColsB =
          parentLookup
            .get(b.id)
            ?.map((parentId) => columnAssignments.get(parentId))
            .filter((value): value is number => typeof value === 'number') ?? [];
        const avgA = average(parentColsA);
        const avgB = average(parentColsB);
        if (avgA !== null && avgB !== null && avgA !== avgB) {
          return avgA - avgB;
        }
        if (avgA !== null && avgB === null) {
          return -1;
        }
        if (avgA === null && avgB !== null) {
          return 1;
        }
        const graphDepthA = graphIndex.depth.get(a.id) ?? 0;
        const graphDepthB = graphIndex.depth.get(b.id) ?? 0;
        if (graphDepthA !== graphDepthB) {
          return graphDepthA - graphDepthB;
        }
        return a.label.localeCompare(b.label, 'ko');
      });
      tierNodes.forEach((node) => {
        const parentCols =
          parentLookup
            .get(node.id)
            ?.map((parentId) => columnAssignments.get(parentId))
            .filter((value): value is number => typeof value === 'number') ?? [];
        const averageParentColumn = average(parentCols);
        if (averageParentColumn !== null) {
          const proposed = Math.round(averageParentColumn);
          const used = placementTracker.get(tier) ?? 0;
          const assignedColumn = Math.max(used, proposed);
          columnAssignments.set(node.id, assignedColumn);
          placementTracker.set(tier, assignedColumn + 1);
        } else {
          const nextColumn = placementTracker.get(tier) ?? 0;
          columnAssignments.set(node.id, nextColumn);
          placementTracker.set(tier, nextColumn + 1);
        }
      });
    });

  return columnAssignments;
}

function buildPositionedNodes(
  nodes: SkillTreeGraphNodeView[],
  trees: SkillTreeGraphTree[],
  edges: SkillTreeEdge[],
): { positioned: PositionedNode[]; height: number } {
  const orderLookup = groupOrder(trees);
  const positioned: PositionedNode[] = [];
  let maxRowIndex = 0;

  const graphIndex = buildGraphIndex({ nodes, edges });
  const nodesByGroup = new Map<string, SkillTreeGraphNodeView[]>();
  nodes.forEach((node) => {
    const groupId = node.tree;
    if (!nodesByGroup.has(groupId)) {
      nodesByGroup.set(groupId, []);
    }
    nodesByGroup.get(groupId)!.push(node);
  });

  nodesByGroup.forEach((groupNodes, groupId) => {
    const groupIndex = orderLookup[groupId] ?? trees.length;
    const panelOffsetX = groupIndex * PANEL_WIDTH;
    const groupEdges = edges.filter((edge) => {
      const source = nodes.find((candidate) => candidate.id === edge.from);
      const target = nodes.find((candidate) => candidate.id === edge.to);
      return source?.tree === groupId && target?.tree === groupId;
    });
    const columnAssignments = buildColumnAssignments(
      groupNodes,
      groupEdges,
      graphIndex,
    );

    groupNodes
      .slice()
      .sort((a, b) => {
        const rowA = a.grid?.row ?? a.tier ?? (graphIndex.depth.get(a.id) ?? 0) + 1;
        const rowB = b.grid?.row ?? b.tier ?? (graphIndex.depth.get(b.id) ?? 0) + 1;
        if (rowA !== rowB) {
          return rowA - rowB;
        }
        const colA = columnAssignments.get(a.id) ?? 0;
        const colB = columnAssignments.get(b.id) ?? 0;
        if (colA !== colB) {
          return colA - colB;
        }
        const depthA = graphIndex.depth.get(a.id) ?? 0;
        const depthB = graphIndex.depth.get(b.id) ?? 0;
        if (depthA !== depthB) {
          return depthA - depthB;
        }
        return a.label.localeCompare(b.label, 'ko');
      })
      .forEach((node) => {
        const colIndex = columnAssignments.get(node.id) ?? 0;
        const rowIndex = Math.max(
          0,
          (node.grid?.row ?? node.tier ?? (graphIndex.depth.get(node.id) ?? 0) + 1) - 1,
        );
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

function buildEdgePath(from: PositionedNode, to: PositionedNode): string {
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
  zoom = 1,
  highContrast = false,
  focusNodeId = null,
  dimUnrelated = false,
}) => {
  const effectiveZoom = Math.min(Math.max(zoom, 0.5), 2);
  const { positioned, height } = useMemo(
    () => buildPositionedNodes(nodes, trees, edges),
    [nodes, trees, edges],
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

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    nodes.forEach((node) => map.set(node.id, new Set()));
    edges.forEach((edge) => {
      if (!map.has(edge.from)) {
        map.set(edge.from, new Set());
      }
      if (!map.has(edge.to)) {
        map.set(edge.to, new Set());
      }
      map.get(edge.from)!.add(edge.to);
      map.get(edge.to)!.add(edge.from);
    });
    return map;
  }, [edges, nodes]);

  const focusSet = useMemo(() => {
    if (!dimUnrelated || !focusNodeId) {
      return null;
    }
    const set = new Set<string>([focusNodeId]);
    const neighbors = adjacency.get(focusNodeId);
    if (neighbors) {
      neighbors.forEach((id) => set.add(id));
    }
    return set;
  }, [adjacency, dimUnrelated, focusNodeId]);

  const canvasWrapperStyle = useMemo(
    () => ({
      height: height * effectiveZoom,
      width: canvasWidth * effectiveZoom,
    }),
    [height, canvasWidth, effectiveZoom],
  );

  const canvasStyle = useMemo(
    () => ({
      height,
      width: canvasWidth,
      transform: `scale(${effectiveZoom})`,
      transformOrigin: 'top left',
    }),
    [height, canvasWidth, effectiveZoom],
  );

  const strokeWidth = Math.max(1.5, Math.min(4, 3 / effectiveZoom));

  return (
    <div
      className="skill-tree-graph"
      data-testid="skill-tree-graph"
      data-high-contrast={highContrast ? 'true' : 'false'}
    >
      <div className="skill-tree-graph__canvas-wrapper" style={canvasWrapperStyle}>
        <div className="skill-tree-graph__canvas" style={canvasStyle}>
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

          <svg
            className="skill-tree-graph__edge-canvas"
            width={canvasWidth}
            height={height}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="skill-tree-edge-arrow"
                markerWidth="12"
                markerHeight="12"
                refX="12"
                refY="6"
                orient="auto"
              >
                <path d="M0,0 L0,12 L12,6 z" fill="currentColor" />
              </marker>
              <filter id="skill-tree-edge-glow">
                <feDropShadow dx="0" dy="0" stdDeviation="1.4" floodOpacity="0.45" />
              </filter>
            </defs>
            {edges.map((edge) => {
              const from = positionedMap[edge.from];
              const to = positionedMap[edge.to];
              if (!from || !to) {
                return null;
              }
              const edgeState = from.node.resolvedState;
              const tone = SKILL_STATE_META[edgeState].tone;
              const color = SKILL_STATE_COLORS[tone];
              const dimmed =
                focusSet && (!focusSet.has(edge.from) || !focusSet.has(edge.to));
              const className = [
                'skill-tree-edge',
                `skill-tree-edge--${edgeState}`,
                dimmed ? 'skill-tree-edge--dimmed' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  className={className}
                  d={buildEdgePath(from, to)}
                  stroke={color}
                  strokeWidth={edgeState === 'completed' ? strokeWidth + 0.5 : strokeWidth}
                  markerEnd="url(#skill-tree-edge-arrow)"
                  filter={edgeState === 'completed' ? 'url(#skill-tree-edge-glow)' : undefined}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {positioned.map((item) => {
            const { node, x, y } = item;
            const resolvedState = node.resolvedState;
            const stateMeta = SKILL_STATE_META[resolvedState];
            const Icon = ICON_COMPONENTS[stateMeta.icon];
            const badgeClass = ['badge', SKILL_STATE_BADGE_CLASS[stateMeta.tone]]
              .filter(Boolean)
              .join(' ');
            const accentColor =
              palette[node.lens[0] ?? ''] ?? SKILL_STATE_COLORS[stateMeta.tone];
            const disabled = resolvedState === 'locked';
            const xpSummary = formatXpSummary(node.progress);
            const tooltipId = `skill-${node.id}-tooltip`;
            const unmetRequires = node.requires
              .filter((req) => !req.met)
              .map((req) => req.label)
              .filter(Boolean);
            const tooltipText = t(stateMeta.tooltipKey, {
              requires: unmetRequires.length ? formatList(unmetRequires) : '없음',
            });
            const dimmed = Boolean(focusSet && !focusSet.has(node.id));

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
                id={`skill-${node.id}`}
                className={[
                  'skill-tree-node',
                  'skill-card',
                  `skill-card--${resolvedState}`,
                  node.boss ? 'skill-card--boss-node' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-node-id={node.id}
                data-state={resolvedState}
                data-dimmed={dimmed ? 'true' : undefined}
                style={{ left: x, top: y }}
                aria-label={`${node.label} ${t(stateMeta.badgeKey)}`}
                aria-describedby={tooltipId}
                role={onSelect ? 'button' : undefined}
                tabIndex={onSelect ? 0 : undefined}
                onClick={handleSelect}
                onKeyDown={handleKeyDown}
                onMouseEnter={onSelect ? handleSelect : undefined}
              >
                <div
                  className="skill-tree-graph__node-glow"
                  style={{ background: `radial-gradient(circle, ${accentColor}33, transparent 70%)` }}
                />
                <header className="skill-tree-node__status">
                  <span className={badgeClass}>
                    <Icon className="skill-tree-node__status-icon" aria-hidden="true" />
                    {t(stateMeta.badgeKey)}
                  </span>
                  {resolvedState === 'mastered' ? (
                    <span className="badge badge--amber" aria-hidden="true">
                      ★
                    </span>
                  ) : null}
                </header>
                <p id={tooltipId} className="sr-only">
                  {tooltipText}
                </p>
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
    </div>
  );
};

export default SkillTreeGraph;
