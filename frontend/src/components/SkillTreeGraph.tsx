import { ArrowRight, CheckCircle, Lock, Sparkles, Star } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';

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
const PANEL_PADDING_X = 64;
const NODE_WIDTH = 180;
const NODE_HEIGHT = 96;
const NODE_COLUMN_SPACING = 200;
const ROW_GAP = 140;

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

type LayoutResult = {
  positioned: PositionedNode[];
  height: number;
};

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

type EdgeBundle = {
  parent: PositionedNode;
  children: PositionedNode[];
  busX: number;
  busY: number;
  state: SkillState;
};

type RegularEdgeSegment = {
  parent: PositionedNode;
  child: PositionedNode;
};

const BUS_OFFSET = 48;

function getBounds(positioned: PositionedNode[]): Bounds {
  if (!positioned.length) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  const minX = Math.min(...positioned.map((item) => item.x));
  const minY = Math.min(...positioned.map((item) => item.y));
  const maxX = Math.max(...positioned.map((item) => item.x + item.width));
  const maxY = Math.max(...positioned.map((item) => item.y + item.height));
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [fitScale, setFitScale] = useState(1);
  const [hasFit, setHasFit] = useState(false);
  const dragStateRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const effectiveZoom = Math.min(Math.max(zoom, 0.5), 2) * fitScale;
  const layoutCacheRef = useRef<Map<string, LayoutResult>>(new Map());
  const [isLayoutLoading, setIsLayoutLoading] = useState(false);

  const layoutKey = useMemo(
    () =>
      JSON.stringify({
        nodes: nodes.map((node) => ({
          id: node.id,
          tree: node.tree,
          tier: node.tier,
          col: node.grid?.col ?? 0,
          row: node.grid?.row ?? 0,
        })),
        edges: edges.map((edge) => [edge.from, edge.to]),
        groups: trees.map((tree) => ({ id: tree.id, order: tree.order })),
      }),
    [nodes, edges, trees],
  );

  const fallbackLayout = useMemo(
    () => buildPositionedNodes(nodes, trees, edges),
    [nodes, trees, edges],
  );
  const [layoutResult, setLayoutResult] = useState<LayoutResult>(fallbackLayout);

  useEffect(() => {
    setLayoutResult(fallbackLayout);
    setIsLayoutLoading(false);
  }, [fallbackLayout]);

  const elk = useMemo(() => new ELK(), []);

  useEffect(() => {
    const cached = layoutCacheRef.current.get(layoutKey);
    if (cached) {
      setLayoutResult(cached);
      setIsLayoutLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      if (!nodes.length) {
        if (!cancelled) {
          setLayoutResult({ positioned: [], height: 560 });
          setIsLayoutLoading(false);
        }
        return;
      }

      setIsLayoutLoading(true);

      const orderLookup = groupOrder(trees);
      const nodeMap = new Map(nodes.map((node) => [node.id, node]));
      const sortedGroups = trees.slice().sort((a, b) => a.order - b.order);
      const positioned: PositionedNode[] = [];
      let maxHeight = 0;

      try {
        for (const group of sortedGroups) {
          const groupNodes = nodes.filter((node) => node.tree === group.id);
          if (!groupNodes.length) {
            continue;
          }
          const groupEdges = edges.filter((edge) => {
            const source = nodeMap.get(edge.from);
            const target = nodeMap.get(edge.to);
            return source?.tree === group.id && target?.tree === group.id;
          });

          const elkGraph = {
            id: `group-${group.id}`,
            layoutOptions: {
              'elk.algorithm': 'layered',
              'elk.direction': 'DOWN',
              'elk.layered.spacing.nodeNodeBetweenLayers': ROW_GAP.toString(),
              'elk.spacing.nodeNode': Math.floor(NODE_COLUMN_SPACING * 0.8).toString(),
              'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
            },
            children: groupNodes.map((node) => ({
              id: node.id,
              width: NODE_WIDTH,
              height: NODE_HEIGHT,
            })),
            edges: groupEdges.map((edge) => ({
              id: `${edge.from}->${edge.to}`,
              sources: [edge.from],
              targets: [edge.to],
            })),
          };

          const layout = await elk.layout(elkGraph);
          const offsetIndex = orderLookup[group.id] ?? sortedGroups.length;
          const panelOffsetX = offsetIndex * PANEL_WIDTH;
          let groupMaxBottom = 0;

          layout.children?.forEach(
            (child: { id: string; x?: number; y?: number; width?: number; height?: number }) => {
              const node = nodeMap.get(child.id);
              if (!node) {
                return;
              }
              const childX = child.x ?? 0;
              const childY = child.y ?? 0;
              const x = panelOffsetX + PANEL_PADDING_X + childX;
              const y = childY;
              positioned.push({
                node,
                x,
              y,
              width: NODE_WIDTH,
              height: NODE_HEIGHT,
              groupIndex: offsetIndex,
              });
              const bottom = childY + (child.height ?? NODE_HEIGHT);
              if (bottom > groupMaxBottom) {
                groupMaxBottom = bottom;
              }
            },
          );

          const groupHeight = groupMaxBottom + NODE_HEIGHT;
          if (groupHeight > maxHeight) {
            maxHeight = groupHeight;
          }
        }

        if (!cancelled) {
          const height = Math.max(Math.ceil(maxHeight + 160), 560);
          const result = {
            positioned: positioned.length ? positioned : fallbackLayout.positioned,
            height,
          };
          layoutCacheRef.current.set(layoutKey, result);
          setLayoutResult(result);
          setIsLayoutLoading(false);
        }
      } catch (error) {
        console.warn('[SkillTree] ELK layout failed, using fallback layout', error);
        if (!cancelled) {
          setLayoutResult(fallbackLayout);
          setIsLayoutLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [elk, nodes, trees, edges, fallbackLayout, layoutKey]);

  const positioned = layoutResult.positioned;
  const height = layoutResult.height;

  const canvasWidth = useMemo(() => {
    if (!positioned.length) {
      return Math.max(trees.length * PANEL_WIDTH, PANEL_WIDTH);
    }
    const maxX = Math.max(
      ...positioned.map((item) => item.x + item.width + PANEL_PADDING_X),
    );
    return Math.max(Math.ceil(maxX), PANEL_WIDTH);
  }, [positioned, trees.length]);

  const treeOrderLookup = useMemo(() => groupOrder(trees), [trees]);

  const positionedMap = useMemo(() => {
    return positioned.reduce<Record<string, PositionedNode>>(
      (accumulator, item: PositionedNode) => {
        accumulator[item.node.id] = item;
        return accumulator;
      },
      {},
    );
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
    positioned.forEach((item: PositionedNode) => map.set(item.node.id, new Set()));
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
  }, [edges, positioned]);

  const edgeGrouping = useMemo(() => {
    const parentChildren = new Map<string, PositionedNode[]>();
    edges.forEach((edge) => {
      const parent = positionedMap[edge.from];
      const child = positionedMap[edge.to];
      if (!parent || !child) {
        return;
      }
      if (!parentChildren.has(edge.from)) {
        parentChildren.set(edge.from, []);
      }
      parentChildren.get(edge.from)!.push(child);
    });

    const regular: RegularEdgeSegment[] = [];
    const bundles: EdgeBundle[] = [];

    parentChildren.forEach((children, parentId) => {
      const parent = positionedMap[parentId];
      if (!parent || !children.length) {
        return;
      }
      if (children.length <= 1) {
        const child = children[0];
        if (child) {
          regular.push({ parent, child });
        }
        return;
      }
      const centers = children.map((child) => child.x + child.width / 2);
      const busX = average(centers) ?? parent.x + parent.width / 2;
      const busY = parent.y + parent.height + BUS_OFFSET;
      bundles.push({
        parent,
        children,
        busX,
        busY,
        state: parent.node.resolvedState,
      });
    });

    return { regular, bundles };
  }, [edges, positionedMap]);

  const regularEdges = edgeGrouping.regular;
  const bundledEdges = edgeGrouping.bundles;

  const layoutStats = useMemo(
    () => ({
      nodes: positioned.length,
      edges: edges.length,
      bundles: bundledEdges.length,
    }),
    [positioned.length, edges.length, bundledEdges.length],
  );

  useEffect(() => {
    if (import.meta.env?.DEV) {
      console.info('[SkillTree] layout stats', layoutStats);
    }
  }, [layoutStats]);

  const graphBounds = useMemo(() => getBounds(positioned), [positioned]);

  const handleFitToView = useCallback(() => {
    const container = containerRef.current;
    if (!container || !positioned.length) {
      return;
    }
    const padding = 60;
    const { clientWidth, clientHeight } = container;
    const usableWidth = Math.max(200, clientWidth - padding * 2);
    const usableHeight = Math.max(200, clientHeight - padding * 2);
    const { width, height, minX, minY } = graphBounds;
    const scale = Math.min(usableWidth / Math.max(width, 1), usableHeight / Math.max(height, 1), 1.2);
    const offsetX = (usableWidth - width * scale) / 2 + padding - minX * scale;
    const offsetY = (usableHeight - height * scale) / 2 + padding - minY * scale;
    setFitScale(scale);
    setPan({ x: offsetX, y: offsetY });
    setHasFit(true);
  }, [graphBounds, positioned.length]);

  useEffect(() => {
    if (!hasFit && positioned.length) {
      handleFitToView();
    }
  }, [handleFitToView, hasFit, positioned.length]);

  const startDrag = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      dragStateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      setIsDragging(true);
      const handleMouseMove = (e: MouseEvent) => {
        const state = dragStateRef.current;
        if (!state) return;
        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;
        setPan({ x: state.panX + dx, y: state.panY + dy });
      };
      const handleMouseUp = () => {
        setIsDragging(false);
        dragStateRef.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [pan.x, pan.y],
  );

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
      height: Math.max(height * effectiveZoom + 120, 560),
      width: Math.max(canvasWidth * effectiveZoom + 120, PANEL_WIDTH),
      cursor: isDragging ? 'grabbing' : 'grab',
    }),
    [height, canvasWidth, effectiveZoom, isDragging],
  );

  const canvasStyle = useMemo(
    () => ({
      height,
      width: canvasWidth,
      transform: `translate(${pan.x}px, ${pan.y}px) scale(${effectiveZoom})`,
      transformOrigin: 'top left',
    }),
    [height, canvasWidth, pan.x, pan.y, effectiveZoom],
  );

  const edgeCanvasStyle = useMemo(
    () => ({
      height,
      width: canvasWidth,
      transform: `translate(${pan.x}px, ${pan.y}px) scale(${effectiveZoom})`,
      transformOrigin: 'top left',
    }),
    [height, canvasWidth, pan.x, pan.y, effectiveZoom],
  );

  const strokeWidth = Math.max(1.5, Math.min(4, 3 / effectiveZoom));

  return (
    <div
      className="skill-tree-graph"
      data-testid="skill-tree-graph"
      data-high-contrast={highContrast ? 'true' : 'false'}
    >
      <div className="skill-tree-graph__controls">
        <button type="button" className="ghost-button small" onClick={handleFitToView}>
          전체 보기
        </button>
        <span className="skill-tree-graph__controls-hint">드래그로 이동 · 상단 슬라이더로 확대/100%</span>
      </div>
      <div
        className="skill-tree-graph__canvas-wrapper"
        ref={containerRef}
        style={canvasWrapperStyle}
        data-loading={isLayoutLoading ? 'true' : 'false'}
        data-panning={isDragging ? 'true' : 'false'}
        onMouseDown={startDrag}
      >
        {isLayoutLoading ? (
          <div className="skill-tree-graph__loading" role="status">
            <span className="skill-tree-graph__loading-spinner" aria-hidden="true" />
            <span>레이아웃 계산 중…</span>
          </div>
        ) : null}
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
            style={edgeCanvasStyle}
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

            {bundledEdges.map((bundle) => {
              const tone = SKILL_STATE_META[bundle.state as SkillState].tone;
              const color = SKILL_STATE_COLORS[tone];
              const parentCenterX = bundle.parent.x + bundle.parent.width / 2;
              const parentBottomY = bundle.parent.y + bundle.parent.height;
              const bundleDimmed =
                focusSet && !focusSet.has(bundle.parent.node.id) && !bundle.children.some((child) => focusSet.has(child.node.id));
              const className = [
                'skill-tree-edge',
                `skill-tree-edge--${bundle.state}`,
                'skill-tree-edge--bundle',
                bundleDimmed ? 'skill-tree-edge--dimmed' : '',
              ]
                .filter(Boolean)
                .join(' ');
              const busPath = `M ${parentCenterX} ${parentBottomY} C ${parentCenterX} ${
                parentBottomY + 24
              }, ${bundle.busX} ${bundle.busY - 24}, ${bundle.busX} ${bundle.busY}`;

              return (
                <React.Fragment key={`bundle-${bundle.parent.node.id}`}>
                  <path
                    className={className}
                    d={busPath}
                    stroke={color}
                    strokeWidth={strokeWidth + 0.3}
                    markerEnd="url(#skill-tree-edge-arrow)"
                    strokeLinecap="round"
                  />
                  {bundle.children.map((child) => {
                    const targetX = child.x + child.width / 2;
                    const targetY = child.y;
                    const childDimmed =
                      focusSet && !(focusSet.has(bundle.parent.node.id) && focusSet.has(child.node.id));
                    const childClassName = [
                      'skill-tree-edge',
                      `skill-tree-edge--${bundle.state}`,
                      'skill-tree-edge--bundle-segment',
                      childDimmed ? 'skill-tree-edge--dimmed' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    const childPath = `M ${bundle.busX} ${bundle.busY} C ${bundle.busX} ${
                      bundle.busY + 24
                    }, ${targetX} ${targetY - 24}, ${targetX} ${targetY}`;
                    return (
                      <path
                        key={`${bundle.parent.node.id}->${child.node.id}`}
                        className={childClassName}
                        d={childPath}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        markerEnd="url(#skill-tree-edge-arrow)"
                        strokeLinecap="round"
                      />
                    );
                  })}
                </React.Fragment>
              );
            })}

            {regularEdges.map(({ parent, child }) => {
              const edgeState = parent.node.resolvedState;
              const tone = SKILL_STATE_META[edgeState as SkillState].tone;
              const color = SKILL_STATE_COLORS[tone];
              const dimmed =
                focusSet &&
                !(focusSet.has(parent.node.id) && focusSet.has(child.node.id));
              const className = [
                'skill-tree-edge',
                `skill-tree-edge--${edgeState}`,
                dimmed ? 'skill-tree-edge--dimmed' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <path
                  key={`${parent.node.id}-${child.node.id}`}
                  className={className}
                  d={buildEdgePath(parent, child)}
                  stroke={color}
                  strokeWidth={edgeState === 'completed' ? strokeWidth + 0.5 : strokeWidth}
                  markerEnd="url(#skill-tree-edge-arrow)"
                  filter={edgeState === 'completed' ? 'url(#skill-tree-edge-glow)' : undefined}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {positioned.map((item: PositionedNode) => {
            const { node, x, y } = item;
            const resolvedState = node.resolvedState;
            const stateMeta = SKILL_STATE_META[resolvedState as SkillState];
            const Icon = ICON_COMPONENTS[stateMeta.icon];
            const badgeClass = ['badge', SKILL_STATE_BADGE_CLASS[stateMeta.tone]]
              .filter(Boolean)
              .join(' ');
            const accentColor =
              palette[node.lens[0] ?? ''] ?? SKILL_STATE_COLORS[stateMeta.tone];
            const disabled = resolvedState === 'locked';
            const tooltipId = `skill-${node.id}-tooltip`;
            const unmetRequires = node.requires
              .filter((req: SkillTreeRequirement) => !req.met)
              .map((req: SkillTreeRequirement) => req.label)
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
                  {resolvedState === 'mastered' ? <span className="badge badge--amber">★</span> : null}
                </header>
                <p id={tooltipId} className="sr-only">
                  {tooltipText}
                </p>
                <h3 className="skill-tree-node__title">
                  {node.label}
                  {node.boss ? <span className="skill-tree-node__boss">BOSS</span> : null}
                </h3>
                <div className="skill-tree-node__compact">
                  {node.lens.slice(0, 3).map((lens: string) => (
                    <span
                      key={`${node.id}-lens-${lens}`}
                      className="skill-tree-node__badge"
                      style={{
                        borderColor: palette[lens] ? `${palette[lens]}55` : undefined,
                        color: palette[lens] ?? undefined,
                      }}
                      aria-hidden="true"
                    >
                      {lens}
                    </span>
                  ))}
                </div>
                <div className="skill-card__tooltip" role="tooltip" aria-label={`${node.label} 상세`}>
                  <div className="tooltip-row">
                    <span>Tier {node.tier}</span>
                    <span>
                      XP {node.xp.per_try}/{node.xp.per_correct}
                    </span>
                  </div>
                  <div className="tooltip-row">{formatRequirements(node.requires)}</div>
                  <div className="tooltip-row">{formatTeaches(node.teaches)}</div>
                  <div className="tooltip-row">{formatXpSummary(node.progress) ?? '시도 기록 없음'}</div>
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
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SkillTreeGraph;
