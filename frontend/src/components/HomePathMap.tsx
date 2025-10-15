import './HomePathMap.css';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { useAuth } from '../contexts/AuthContext';
import type {
  CurriculumGraph,
  CurriculumGraphEdge,
  CurriculumGraphNode,
  CurriculumHomeCopy
} from '../types';
import {
  fetchCurriculumGraph,
  fetchCurriculumHomeCopy,
  fetchUserCurriculumGraph
} from '../utils/api';
import {
  classifyMastery,
  overlaps,
  parseGradeBand
} from './homePathMapHelpers';

const STEP_ORDER: Array<'S1' | 'S2' | 'S3'> = ['S1', 'S2', 'S3'];

const LENS_ICONS: Record<string, string> = {
  difference: '🔺',
  accumulation: '⬛',
  ratio: '➗',
  scale: '📏',
  random: '🎲',
  transform: '🔄',
  vector: '🧭',
};

const MASTER_RADIUS = 18;
const MASTER_CIRCUMFERENCE = 2 * Math.PI * MASTER_RADIUS;
const MIN_MASTERY_VISUAL = 0.01;

type ClassValue = string | Record<string, unknown> | null | undefined | false;

function cx(...values: ClassValue[]): string {
  const tokens: string[] = [];
  for (const value of values) {
    if (!value) {
      continue;
    }
    if (typeof value === 'string') {
      tokens.push(value);
      continue;
    }
    for (const [key, flag] of Object.entries(value)) {
      if (flag) {
        tokens.push(key);
      }
    }
  }
  return tokens.join(' ');
}

type MasteryRingProps = {
  value: number;
  paletteColor: string;
};

function MasteryRing({ value, paletteColor }: MasteryRingProps) {
  const clamped = Math.max(MIN_MASTERY_VISUAL, Math.min(1, value));
  const offset = MASTER_CIRCUMFERENCE * (1 - clamped);
  return (
    <svg
      className="home-path-map__mastery-ring"
      viewBox="0 0 48 48"
      role="img"
      aria-label={`마스터리 ${(clamped * 100).toFixed(0)}%`}
    >
      <circle className="home-path-map__mastery-ring-bg" cx="24" cy="24" r={MASTER_RADIUS} />
      <circle
        className="home-path-map__mastery-ring-fg"
        cx="24"
        cy="24"
        r={MASTER_RADIUS}
        stroke={paletteColor}
        strokeDasharray={MASTER_CIRCUMFERENCE}
        strokeDashoffset={offset}
      />
      <text x="24" y="27" textAnchor="middle" className="home-path-map__mastery-ring-label">
        {(clamped * 100).toFixed(0)}%
      </text>
    </svg>
  );
}

function isLensMatch(node: CurriculumGraphNode, selectedLens: Set<string>): boolean {
  if (selectedLens.size === 0) {
    return true;
  }
  return node.lens.some((lens) => selectedLens.has(lens));
}

type EdgePosition = {
  id: string;
  type: CurriculumGraphEdge['type'];
  lens: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type HomePathMapProps = {
  className?: string;
};

const HomePathMap: React.FC<HomePathMapProps> = ({ className }) => {
  const { user } = useAuth();
  const [graph, setGraph] = useState<CurriculumGraph | null>(null);
  const [homeCopy, setHomeCopy] = useState<CurriculumHomeCopy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedLens, setSelectedLens] = useState<Set<string>>(new Set());
  const [gradeRange, setGradeRange] = useState<[number, number]>([1, 12]);
  const [masteryRange, setMasteryRange] = useState<[number, number]>([0, 1]);
  const [onlyMyPath, setOnlyMyPath] = useState(false);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pinnedNodeIds, setPinnedNodeIds] = useState<Set<string>>(new Set());
  const [focusPathNodeIds, setFocusPathNodeIds] = useState<Set<string>>(new Set());
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const suppressClickRef = useRef(false);

  const togglePin = useCallback((nodeId: string) => {
    setPinnedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        setLoading(true);
        const [baseGraph, copy] = await Promise.all([
          fetchCurriculumGraph(),
          fetchCurriculumHomeCopy(),
        ]);
        let resolvedGraph = baseGraph;
        if (user?.id) {
          try {
            resolvedGraph = await fetchUserCurriculumGraph(user.id);
          } catch (personalizeError) {
            console.warn('Failed to load personalized graph, using base graph', personalizeError);
          }
        }
        if (ignore) {
          return;
        }
        setGraph(resolvedGraph);
        setHomeCopy(copy);
        setError(null);
      } catch (loadError) {
        if (!ignore) {
          setError(loadError as Error);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [user?.id]);

  const lensOptions = useMemo(() => {
    const set = new Set<string>();
    if (graph) {
      for (const node of graph.nodes) {
        for (const lens of node.lens) {
          set.add(lens);
        }
      }
    }
    return Array.from(set);
  }, [graph]);

  const palette = graph?.meta.palette ?? {};

  const nodeById = useMemo(() => {
    if (!graph) {
      return new Map<string, CurriculumGraphNode>();
    }
    return new Map(graph.nodes.map((node) => [node.id, node]));
  }, [graph]);

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!graph) {
      return map;
    }
    for (const edge of graph.edges) {
      if (!map.has(edge.source)) {
        map.set(edge.source, new Set());
      }
      if (!map.has(edge.target)) {
        map.set(edge.target, new Set());
      }
      map.get(edge.source)!.add(edge.target);
      map.get(edge.target)!.add(edge.source);
    }
    return map;
  }, [graph]);

  const graphNodeIds = useMemo(() => new Set(nodeById.keys()), [nodeById]);

  useEffect(() => {
    if (!graph) {
      setPinnedNodeIds(new Set());
      setFocusPathNodeIds(new Set());
      return;
    }
    setPinnedNodeIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (graphNodeIds.has(id)) {
          next.add(id);
        }
      }
      return next.size === prev.size ? prev : next;
    });
    setFocusPathNodeIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (graphNodeIds.has(id)) {
          next.add(id);
        }
      }
      return next.size === prev.size ? prev : next;
    });
  }, [graph, graphNodeIds]);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>, nodeId: string) => {
    if (event.button !== 0) {
      return;
    }
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      togglePin(nodeId);
      longPressTriggeredRef.current = true;
      suppressClickRef.current = true;
    }, 500);
  };

  const handlePointerClear = () => {
    clearLongPressTimer();
    const triggered = longPressTriggeredRef.current;
    longPressTriggeredRef.current = false;
    if (!triggered) {
      suppressClickRef.current = false;
    }
  };

  const focusPathForNode = useCallback(
    (nodeId: string) => {
      if (!graph) {
        return;
      }
      const visited = new Set<string>([nodeId]);
      let frontier: string[] = [nodeId];
      for (let depth = 0; depth < 2; depth += 1) {
        const nextFrontier: string[] = [];
        for (const current of frontier) {
          const neighbors = adjacency.get(current);
          if (!neighbors) {
            continue;
          }
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              nextFrontier.push(neighbor);
            }
          }
        }
        if (nextFrontier.length === 0) {
          break;
        }
        frontier = nextFrontier;
      }
      setFocusPathNodeIds((prev) => {
        const sameSize = prev.size === visited.size;
        if (sameSize) {
          let identical = true;
          for (const id of visited) {
            if (!prev.has(id)) {
              identical = false;
              break;
            }
          }
          if (identical) {
            return new Set();
          }
        }
        return visited;
      });
    },
    [adjacency, graph]
  );

  const focusExistingNode = (targetId: string | undefined) => {
    if (!targetId) {
      return;
    }
    const element = nodeRefs.current.get(targetId);
    element?.focus();
    setFocusedNodeId(targetId);
  };

  const handleNodeKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    node: CurriculumGraphNode,
    laneNodes: CurriculumGraphNode[],
    step: 'S1' | 'S2' | 'S3',
    position: number
  ) => {
    switch (event.key) {
      case 'Enter':
      case ' ': {
        event.preventDefault();
        setSelectedNodeId(node.id);
        setFocusedNodeId(node.id);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const target = laneNodes[position - 1] ?? laneNodes[laneNodes.length - 1];
        focusExistingNode(target?.id);
        break;
      }
      case 'ArrowDown': {
        event.preventDefault();
        const target = laneNodes[position + 1] ?? laneNodes[0];
        focusExistingNode(target?.id);
        break;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        const currentStepIndex = STEP_ORDER.indexOf(step);
        if (currentStepIndex > 0) {
          const prevStep = STEP_ORDER[currentStepIndex - 1];
          const prevLane = lanes.get(prevStep) ?? [];
          const target = prevLane[position] ?? prevLane[prevLane.length - 1];
          focusExistingNode(target?.id);
        }
        break;
      }
      case 'ArrowRight': {
        event.preventDefault();
        const currentStepIndex = STEP_ORDER.indexOf(step);
        if (currentStepIndex < STEP_ORDER.length - 1) {
          const nextStep = STEP_ORDER[currentStepIndex + 1];
          const nextLane = lanes.get(nextStep) ?? [];
          const target = nextLane[position] ?? nextLane[0];
          focusExistingNode(target?.id);
        }
        break;
      }
      case 'p':
      case 'P': {
        event.preventDefault();
        togglePin(node.id);
        break;
      }
      case 'f':
      case 'F': {
        event.preventDefault();
        focusPathForNode(node.id);
        break;
      }
      case 'Escape': {
        event.preventDefault();
        setFocusPathNodeIds(new Set());
        setFocusedNodeId(null);
        break;
      }
      default:
        break;
    }
  };

  const visibleNodes = useMemo(() => {
    if (!graph) {
      return [] as CurriculumGraphNode[];
    }

    const filtered = graph.nodes.filter((node) => {
      if (pinnedNodeIds.has(node.id)) {
        return true;
      }
      if (!isLensMatch(node, selectedLens)) {
        return false;
      }
      const bandRange = parseGradeBand(node.grade_band);
      if (!overlaps(bandRange, gradeRange)) {
        return false;
      }
      if (node.mastery < masteryRange[0] || node.mastery > masteryRange[1]) {
        return false;
      }
      return true;
    });

    if (!onlyMyPath) {
      return filtered;
    }

    const unlocked = filtered.filter(
      (node) => node.mastery > 0 || node.lrc?.passed || pinnedNodeIds.has(node.id)
    );
    if (unlocked.length === 0) {
      const byStep = new Map<string, CurriculumGraphNode[]>();
      for (const step of STEP_ORDER) {
        byStep.set(step, []);
      }
      for (const node of filtered) {
        const lane = byStep.get(node.step) ?? [];
        if (lane.length < 2) {
          lane.push(node);
          byStep.set(node.step, lane);
        }
      }
      return Array.from(byStep.values()).flat();
    }

    const unlockedIds = new Set(unlocked.map((node) => node.id));
    for (const edge of graph.edges) {
      if (unlockedIds.has(edge.source) || unlockedIds.has(edge.target)) {
        unlockedIds.add(edge.source);
        unlockedIds.add(edge.target);
      }
    }
    return filtered.filter((node) => unlockedIds.has(node.id));
  }, [graph, gradeRange, masteryRange, onlyMyPath, pinnedNodeIds, selectedLens]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const visibleEdges = useMemo(() => {
    if (!graph) {
      return [] as CurriculumGraphEdge[];
    }
    return graph.edges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
  }, [graph, visibleNodeIds]);

  const lanes = useMemo(() => {
    const laneMap = new Map<'S1' | 'S2' | 'S3', CurriculumGraphNode[]>();
    for (const step of STEP_ORDER) {
      laneMap.set(step, []);
    }
    for (const node of visibleNodes) {
      const lane = laneMap.get(node.step) ?? [];
      lane.push(node);
      laneMap.set(node.step, lane);
    }
    for (const step of STEP_ORDER) {
      const lane = laneMap.get(step);
      if (lane) {
        lane.sort((a, b) => a.label.localeCompare(b.label, 'ko'));
      }
    }
    return laneMap;
  }, [visibleNodes]);

  const registerNodeRef = useCallback((nodeId: string, element: HTMLDivElement | null) => {
    if (!element) {
      nodeRefs.current.delete(nodeId);
      return;
    }
    nodeRefs.current.set(nodeId, element);
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    setViewportSize({ width: rect.width, height: rect.height });
  }, [lanes]);

  useEffect(() => {
    function handleResize() {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      setViewportSize({ width: rect.width, height: rect.height });
    }
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const [edgePositions, setEdgePositions] = useState<EdgePosition[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      setEdgePositions([]);
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const positions: EdgePosition[] = [];
    for (const edge of visibleEdges) {
      const sourceEl = nodeRefs.current.get(edge.source);
      const targetEl = nodeRefs.current.get(edge.target);
      if (!sourceEl || !targetEl) {
        continue;
      }
      const sourceRect = sourceEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      positions.push({
        id: edge.id,
        type: edge.type,
        lens: edge.lens,
        x1: sourceRect.right - containerRect.left,
        y1: sourceRect.top + sourceRect.height / 2 - containerRect.top,
        x2: targetRect.left - containerRect.left,
        y2: targetRect.top + targetRect.height / 2 - containerRect.top,
      });
    }
    setEdgePositions(positions);
  }, [visibleEdges, viewportSize]);

  const selectedNode = useMemo(() => {
    if (!graph || !selectedNodeId) {
      return null;
    }
    return graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  }, [graph, selectedNodeId]);

  const emphasizedNodeIds = useMemo(() => {
    const set = new Set<string>();
    if (focusedNodeId) {
      set.add(focusedNodeId);
    }
    if (selectedNodeId) {
      set.add(selectedNodeId);
    }
    for (const id of pinnedNodeIds) {
      set.add(id);
    }
    for (const id of focusPathNodeIds) {
      set.add(id);
    }
    return set;
  }, [focusedNodeId, selectedNodeId, pinnedNodeIds, focusPathNodeIds]);

  const emphasizedEdgeIds = useMemo(() => {
    if (!graph) {
      return new Set<string>();
    }
    const set = new Set<string>();
    if (emphasizedNodeIds.size === 0) {
      return set;
    }
    for (const edge of graph.edges) {
      if (emphasizedNodeIds.has(edge.source) || emphasizedNodeIds.has(edge.target)) {
        set.add(edge.id);
      }
    }
    return set;
  }, [graph, emphasizedNodeIds]);

  const selectedCopy = selectedNode && homeCopy?.nodes[selectedNode.id];

  const recommendedFallback = useMemo(() => {
    if (!lanes) {
      return [] as CurriculumGraphNode[];
    }
    const picks: CurriculumGraphNode[] = [];
    for (const step of STEP_ORDER) {
      const lane = lanes.get(step) ?? [];
      picks.push(...lane.slice(0, 2));
    }
    return picks;
  }, [lanes]);

  if (loading) {
    return (
      <div className={cx('home-path-map', className)}>
        <div className="home-path-map__loading">연결 지도를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cx('home-path-map', className)}>
        <div className="home-path-map__error">
          시각화 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </div>
      </div>
    );
  }

  if (!graph || !homeCopy) {
    return null;
  }

  const activeNodeIds = new Set(visibleNodes.map((node) => node.id));
  const showEmptyState = activeNodeIds.size === 0;

  return (
    <div className={cx('home-path-map', className)}>
      <div className="home-path-map__filters" role="region" aria-label="경로 필터">
        <div className="home-path-map__filter-group">
          <header>렌즈</header>
          <div className="home-path-map__chips">
            {lensOptions.map((lens) => {
              const active = selectedLens.has(lens);
              return (
                <button
                  key={lens}
                  type="button"
                  className={cx('home-path-map__chip', {
                    'home-path-map__chip--active': active,
                  })}
                  style={{
                    borderColor: palette[lens] ?? '#ccc',
                    color: active ? '#fff' : palette[lens] ?? '#555',
                    backgroundColor: active ? palette[lens] ?? '#555' : 'transparent',
                  }}
                  onClick={() => {
                    setSelectedLens((prev) => {
                      const next = new Set(prev);
                      if (next.has(lens)) {
                        next.delete(lens);
                      } else {
                        next.add(lens);
                      }
                      return next;
                    });
                  }}
                >
                  {lens}
                </button>
              );
            })}
          </div>
        </div>
        <div className="home-path-map__filter-group">
          <header>학년대</header>
          <div className="home-path-map__slider">
            <label>
              최소 {gradeRange[0]}
              <input
                type="range"
                min={1}
                max={12}
                value={gradeRange[0]}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  setGradeRange(([_, max]) => [Math.min(value, max), max]);
                }}
              />
            </label>
            <label>
              최대 {gradeRange[1]}
              <input
                type="range"
                min={1}
                max={12}
                value={gradeRange[1]}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  setGradeRange(([min]) => [min, Math.max(value, min)]);
                }}
              />
            </label>
          </div>
        </div>
        <div className="home-path-map__filter-group">
          <header>마스터리</header>
          <div className="home-path-map__slider">
            <label>
              최소 {(masteryRange[0] * 100).toFixed(0)}%
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(masteryRange[0] * 100)}
                onChange={(event) => {
                  const nextMin = Number.parseInt(event.target.value, 10) / 100;
                  setMasteryRange(([_, max]) => [Math.min(nextMin, max), max]);
                }}
              />
            </label>
            <label>
              최대 {(masteryRange[1] * 100).toFixed(0)}%
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(masteryRange[1] * 100)}
                onChange={(event) => {
                  const nextMax = Number.parseInt(event.target.value, 10) / 100;
                  setMasteryRange(([min]) => [min, Math.max(nextMax, min)]);
                }}
              />
            </label>
          </div>
        </div>
        <label className="home-path-map__toggle">
          <input
            type="checkbox"
            checked={onlyMyPath}
            onChange={(event) => setOnlyMyPath(event.target.checked)}
          />
          내 경로만 보기
        </label>
      </div>
      <div className="home-path-map__content">
        <div className="home-path-map__canvas" ref={containerRef}>
          <svg
            className="home-path-map__edges"
            width={viewportSize.width}
            height={viewportSize.height}
          >
            {edgePositions.map((edge) => {
              const color = palette[edge.lens] ?? '#999999';
              const isEmphasized = emphasizedEdgeIds.has(edge.id);
              const weight = graph?.edges.find((item) => item.id === edge.id)?.weight ?? 0.4;
              const clampedWeight = Math.max(0, Math.min(1, weight));
              const strokeWidth = (isEmphasized ? 2.2 : 1.6) + clampedWeight * (isEmphasized ? 4 : 3);
              const dashArray = edge.type === 'transfer' ? '6 6' : undefined;
              const opacity = (isEmphasized ? 0.85 : 0.55) + clampedWeight * 0.25;
              return (
                <line
                  key={edge.id}
                  x1={edge.x1}
                  y1={edge.y1}
                  x2={edge.x2}
                  y2={edge.y2}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                  strokeLinecap="round"
                  className={cx('home-path-map__edge', {
                    'home-path-map__edge--focused': isEmphasized,
                  })}
                  style={{ opacity }}
                />
              );
            })}
          </svg>

          <div className="home-path-map__lanes">
            {STEP_ORDER.map((step) => {
              const laneNodes = lanes.get(step) ?? [];
              return (
                <div key={step} className="home-path-map__lane" aria-label={`${step} 단계`}>
                  <div className="home-path-map__lane-header">{step}</div>
                  <div className="home-path-map__lane-body">
                    {laneNodes.map((node, index) => {
                      const copy = homeCopy.nodes[node.id];
                      const masteryClass = classifyMastery(node.mastery);
                      const isActive = activeNodeIds.has(node.id);
                      return (
                        <div
                          key={node.id}
                          ref={(element) => registerNodeRef(node.id, element)}
                          className={cx('home-path-map__node', {
                            'home-path-map__node--focused': node.id === focusedNodeId,
                            'home-path-map__node--inactive': !isActive,
                            'home-path-map__node--pinned': pinnedNodeIds.has(node.id),
                          })}
                          onPointerDown={(event) => handlePointerDown(event, node.id)}
                          onPointerUp={handlePointerClear}
                          onPointerCancel={handlePointerClear}
                          onPointerLeave={(event) => {
                            handlePointerClear();
                            if (event.pointerType !== 'mouse') {
                              setFocusedNodeId(null);
                            }
                          }}
                          onMouseEnter={() => setFocusedNodeId(node.id)}
                          onMouseLeave={() => setFocusedNodeId(null)}
                          onFocus={() => setFocusedNodeId(node.id)}
                          onBlur={() => setFocusedNodeId(null)}
                          onClick={() => {
                            if (suppressClickRef.current) {
                              suppressClickRef.current = false;
                              longPressTriggeredRef.current = false;
                              return;
                            }
                            setSelectedNodeId(node.id);
                          }}
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            focusPathForNode(node.id);
                            setSelectedNodeId(node.id);
                            setFocusedNodeId(node.id);
                          }}
                          onKeyDown={(event) => handleNodeKeyDown(event, node, laneNodes, step, index)}
                          role="button"
                          tabIndex={0}
                          aria-selected={node.id === selectedNodeId}
                          data-pinned={pinnedNodeIds.has(node.id) ? 'true' : undefined}
                        >
                          <div className="home-path-map__node-header">
                            <div className="home-path-map__node-heading">
                              <span
                                className="home-path-map__node-icon"
                                style={{ backgroundColor: palette[node.lens[0]] ?? '#444' }}
                                aria-hidden
                              >
                                {LENS_ICONS[node.lens[0]] ?? '🔶'}
                              </span>
                              <strong>{copy?.label ?? node.label}</strong>
                            </div>
                            <MasteryRing
                              value={node.mastery}
                              paletteColor={palette[node.lens[0]] ?? '#2563eb'}
                            />
                          </div>
                          <div className="home-path-map__node-meta">
                            <span
                              className={`home-path-map__mastery-badge home-path-map__mastery-badge--${masteryClass}`}
                            >
                              {masteryClass === 'high'
                                ? '전이가 잘 이어지고 있어요'
                                : masteryClass === 'medium'
                                  ? '절반을 넘었어요'
                                  : '지금 막 출발했어요'}
                            </span>
                            <span className="home-path-map__grade" aria-label={`권장 학년대 ${node.grade_band}`}>
                              {node.grade_band}
                            </span>
                          </div>
                          <p className="home-path-map__micro-skills">
                            {node.micro_skills.slice(0, 2).join(' · ')}
                            {node.micro_skills.length > 2 ? ' +' : ''}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {showEmptyState && (
            <div className="home-path-map__empty">
              <h3>시작해볼까요?</h3>
              <p>필터를 조정해 연결 경로를 확인해보세요.</p>
              <div className="home-path-map__empty-suggestions">
                {recommendedFallback.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNodeId(node.id)}
                    style={{ borderColor: palette[node.lens[0]] ?? '#888' }}
                  >
                    {homeCopy.nodes[node.id]?.label ?? node.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <aside className="home-path-map__drawer" aria-live="polite">
          {selectedNode && selectedCopy ? (
            (() => {
              const outgoing = graph
                ? graph.edges
                    .filter((edge) => edge.source === selectedNode.id)
                    .map((edge) => nodeById.get(edge.target))
                    .filter((target): target is CurriculumGraphNode => Boolean(target))
                : [];
              const recommendedNext = outgoing.slice(0, 3);
              const isPinned = pinnedNodeIds.has(selectedNode.id);
              return (
                <div className="home-path-map__drawer-content">
                  <header>
                    <div className="home-path-map__drawer-title">
                      <h3>{selectedCopy.label}</h3>
                      <button
                        type="button"
                        className="home-path-map__pin-toggle"
                        onClick={() => togglePin(selectedNode.id)}
                      >
                        {isPinned ? '핀 해제' : '핀 고정'}
                      </button>
                    </div>
                    <p>{selectedCopy.tooltip}</p>
                  </header>

                  <section className="home-path-map__drawer-card">
                    <h4>오늘의 이유</h4>
                    <p>
                      이 노드를 공부하면 이어지는 고학년 개념이 더 쉽게 연결돼요. 아래 연결을 눌러 경로를 살펴보세요.
                    </p>
                    {recommendedNext.length > 0 ? (
                      <div className="home-path-map__drawer-next">
                        <span className="home-path-map__drawer-label">다음 연결</span>
                        <ul>
                          {recommendedNext.map((target) => (
                            <li key={target.id}>{target.label ?? target.concept}</li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          className="home-path-map__cta"
                          onClick={() => {
                            const target = recommendedNext[0];
                            if (target) {
                              setSelectedNodeId(target.id);
                              focusExistingNode(target.id);
                            }
                          }}
                        >
                          다음 스텝 살펴보기
                        </button>
                      </div>
                    ) : (
                      <div className="home-path-map__drawer-next home-path-map__drawer-next--empty">
                        <span className="home-path-map__drawer-label">다음 연결</span>
                        <p>이 스텝이 최종 단계예요. 복습으로 전이를 단단히 해볼까요?</p>
                      </div>
                    )}
                  </section>

                  <section>
                    <h4>렌즈</h4>
                    <div className="home-path-map__chips">
                      {selectedNode.lens.map((lens) => (
                        <span
                          key={lens}
                          className="home-path-map__chip home-path-map__chip--static"
                          style={{ backgroundColor: palette[lens] ?? '#444' }}
                        >
                          {LENS_ICONS[lens] ?? lens}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h4>미시 스킬</h4>
                    <ul>
                      {selectedNode.micro_skills.map((skill) => (
                        <li key={skill}>{skill}</li>
                      ))}
                    </ul>
                  </section>

                  <section className="home-path-map__drawer-footer">
                    <div>
                      <span className="home-path-map__drawer-label">학년대</span>
                      <span>{selectedNode.grade_band}</span>
                    </div>
                    <div>
                      <span className="home-path-map__drawer-label">마스터리</span>
                      <span>{(selectedNode.mastery * 100).toFixed(0)}%</span>
                    </div>
                  </section>
                </div>
              );
            })()
          ) : (
            <div className="home-path-map__drawer-empty">
              <h3>노드를 선택하면</h3>
              <p>“오늘의 이유” 카드와 다음 경로가 여기에 나타납니다.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default HomePathMap;
