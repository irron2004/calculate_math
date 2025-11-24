import { ArrowLeft } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type {
  SkillNodeProgress,
  SkillSummary,
  SkillTreeEdge,
  SkillTreeGraphSpec,
  SkillTreeGraphTree,
  SkillTreeGroup,
  SkillTreeNode,
  SkillTreeNodeState,
  SkillTreeProgress,
} from '../types';
import { fetchSkillTree } from '../utils/api';
import {
  trackExperimentExposure,
  trackSkillTreeContrastToggled,
  trackSkillTreeFocusMode,
  trackSkillTreeZoomChanged,
} from '../utils/analytics';
import { registerCourseConcept, resetCourseConceptOverrides } from '../utils/skillMappings';
import { buildSimpleSkillTree, extractSimpleSkillList } from '../utils/simpleSkillTree';
import SkillTreeGraph, { type SkillTreeGraphNodeView } from './SkillTreeGraph';
import { useUnlockFx } from '../hooks/useUnlockFx';
import { formatList, t } from '../utils/i18n';
import { SKILL_STATE_META, type SkillState } from '../constants/skillStates';
import './SkillTreePage.css';

type ExperimentAssignment = {
  name: string;
  variant: 'tree' | 'list';
  source: string;
  requestId: string | null;
  rollout: number | null;
  bucket: string | number | null;
};

const TEXT = {
  totalXpLabel: '총 XP',
  lastUpdatedLabel: '업데이트',
};

const createEmptyProgress = (): SkillTreeProgress => ({
  user_id: null,
  updated_at: null,
  total_xp: 0,
  nodes: {},
  skills: {},
});

const deriveSkillState = (
  state: SkillTreeNodeState,
  progressEntry: SkillNodeProgress | null | undefined,
  unlocked: boolean,
): SkillState => {
  if (state.value === 'mastered' || state.mastered) {
    return 'mastered';
  }
  if (progressEntry?.completed || state.completed) {
    return 'completed';
  }
  if (unlocked || state.unlocked || state.available || state.value === 'unlocked' || state.value === 'unlockable' || state.value === 'available') {
    const attempts = progressEntry?.attempts ?? 0;
    const xpEarned = progressEntry?.xp_earned ?? 0;
    if (attempts > 0 || xpEarned > 0) {
      return 'unlocked';
    }
    return 'unlockable';
  }
  return 'locked';
};

const normaliseProgress = (raw?: SkillTreeProgress | null): SkillTreeProgress => ({
  user_id: raw?.user_id ?? null,
  updated_at: raw?.updated_at ?? null,
  total_xp: raw?.total_xp ?? 0,
  nodes: raw?.nodes ?? {},
  skills: raw?.skills ?? {},
});

const lensDisplay = (
  lens: string,
  palette: Record<string, string>,
  key?: string | number
) => {
  const color = palette[lens];
  const style = color
    ? { borderColor: color, color }
    : undefined;
  return (
    <span
      key={key ?? lens}
      className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide"
      style={style}
    >
      {lens}
    </span>
  );
};

type SelectedSkillPanelProps = {
  node: SkillTreeGraphNodeView | null;
  projection: SkillTreeNode | null;
  onStart: (node: SkillTreeGraphNodeView) => void;
  onClear: () => void;
};

const SelectedSkillPanel: React.FC<SelectedSkillPanelProps> = ({ node, projection, onStart, onClear }) => {
  if (!node) {
    return (
      <aside className="skill-panel">
        <div className="skill-panel-header">
          <div>
            <p className="panel-kicker">선택한 스킬</p>
            <h3 className="panel-title">트리에서 스킬을 선택하세요</h3>
          </div>
        </div>
        <ul className="panel-list">
          <li>왼쪽 트리에서 관심 있는 노드를 클릭합니다.</li>
          <li>필요한 선행 스킬과 연결된 상위 개념을 확인합니다.</li>
          <li>바로 연습을 시작하거나 다른 경로를 탐색합니다.</li>
        </ul>
      </aside>
    );
  }

  const requires = node.requires ?? [];
  const teaches = node.teaches ?? [];
  const conceptLabel =
    projection?.session?.concept && projection.session.step
      ? `${projection.session.concept} · 단계 ${projection.session.step}`
      : '연결 개념을 준비 중입니다.';

  return (
    <aside className="skill-panel">
      <div className="skill-panel-header">
        <div>
          <p className="panel-kicker">선택한 스킬</p>
          <h3 className="panel-title">{node.label}</h3>
          <p className="panel-sub">트리 {node.tree} · Tier {node.tier}</p>
        </div>
        <button className="text-button small" type="button" onClick={onClear}>
          선택 해제
        </button>
      </div>

      <div className="panel-tags">
        {node.boss ? <span className="badge badge-warning">BOSS</span> : null}
        {node.lens.map((lens, index) => (
          <span key={`${node.id}-lens-${index}`} className="badge">
            {lens}
          </span>
        ))}
        <span className="badge">상태: {SKILL_STATE_META[node.resolvedState]?.badgeKey ? t(SKILL_STATE_META[node.resolvedState].badgeKey) : node.resolvedState}</span>
      </div>

      <div className="panel-summary">
        <p className="summary-title">이 스킬은 무엇인가요?</p>
        <p className="summary-body">
          {conceptLabel}
        </p>
        <p className="summary-body subtle">
          XP {node.xp.per_try}/{node.xp.per_correct} · 현재 상태 {node.resolvedState}
        </p>
      </div>

      <div className="panel-section">
        <div className="panel-section-head">
          <h4>필요한 선행 스킬</h4>
        </div>
        <ul className="panel-list">
          {requires.length === 0 ? <li>필요 조건 없음</li> : null}
          {requires.map((req) => (
            <li key={`${node.id}-req-${req.skill_id}`}>
              <span>{req.label}</span>
              <span className="pill">Lv {req.current_level ?? 0}/{req.min_level}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel-section">
        <div className="panel-section-head">
          <h4>이후에 이어지는 스킬</h4>
        </div>
        <ul className="panel-list">
          {teaches.length === 0 ? <li>진행도와 XP가 상승합니다.</li> : null}
          {teaches.map((teach) => (
            <li key={`${node.id}-teach-${teach.skill_id}`}>
              <span>{teach.label}</span>
              <span className="pill">+{teach.delta_level} Lv</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel-section">
        <div className="panel-section-head">
          <h4>예시 문제</h4>
        </div>
        <p className="summary-body subtle">
          예시 문제를 통해 난이도를 가볍게 확인한 뒤 바로 연습을 시작하세요.
        </p>
        <button className="primary-button full" type="button" onClick={() => onStart(node)}>
          이 스킬 연습 시작하기
        </button>
      </div>
    </aside>
  );
};

const SkillTreePage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [palette, setPalette] = useState<Record<string, string>>({});
  const [nodes, setNodes] = useState<SkillTreeNode[]>([]);
  const [edges, setEdges] = useState<SkillTreeEdge[]>([]);
  const [courseGroups, setCourseGroups] = useState<SkillTreeGroup[]>([]);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [uiGraph, setUiGraph] = useState<SkillTreeGraphSpec | null>(null);
  const [unlockedMap, setUnlockedMap] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState<SkillTreeProgress>(createEmptyProgress());
  const [experiment, setExperiment] = useState<ExperimentAssignment | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSimpleSkillTree, setIsSimpleSkillTree] = useState(false);
  const isMountedRef = useRef(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [highContrast, setHighContrast] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [recentlyUnlocked, setRecentlyUnlocked] = useState<string[]>([]);
  const prevUnlockedRef = useRef<Record<string, boolean>>({});
  const focusTrackedRef = useRef<string | null>(null);

useUnlockFx(recentlyUnlocked);

  const handleZoomChange = useCallback(
    (value: number) => {
      setZoom(value);
      trackSkillTreeZoomChanged(value);
    },
    [],
  );

  const handleContrastToggle = useCallback(
    (next: boolean) => {
      setHighContrast(next);
      trackSkillTreeContrastToggled(next);
    },
    [],
  );

  const handleZoomInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      handleZoomChange(Number.isFinite(value) ? value : 1);
    },
    [handleZoomChange],
  );

  const resetZoom = useCallback(() => {
    handleZoomChange(1);
  }, [handleZoomChange]);

  const handleContrastCheckbox = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handleContrastToggle(event.target.checked);
    },
    [handleContrastToggle],
  );

  const handleResetFocus = useCallback(() => {
    setFocusNodeId(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
    setFocusNodeId(null);
  }, []);

  const loadSkillTree = useCallback(
    async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const payload = await fetchSkillTree();
      if (!isMountedRef.current) {
        return;
      }

      const simpleSkills = extractSimpleSkillList(payload);
      if (simpleSkills) {
        const simple = buildSimpleSkillTree(simpleSkills);
        setVersion(simple.graph.version ?? null);
        setPalette(simple.palette);
        setNodes(simple.nodes);
        setEdges(simple.edges);
        setCourseGroups(simple.groups);
        setSkills([]);
        setUiGraph(simple.graph);
        setUnlockedMap(simple.unlockedMap);
        prevUnlockedRef.current = simple.unlockedMap;
        setRecentlyUnlocked([]);
        setProgress(createEmptyProgress());
        setExperiment(null);
        setIsSimpleSkillTree(true);
        setError(null);
        if (!silent) {
          setSelectedNodeId(null);
          setFocusNodeId(null);
        }
        return;
      }

      setIsSimpleSkillTree(false);
      setVersion(payload.version ?? null);
      setPalette(payload.palette ?? {});
      const nodeList = Array.isArray(payload.nodes) ? payload.nodes : [];
      resetCourseConceptOverrides();
      nodeList.forEach((node) => {
        if (node.session?.concept) {
          registerCourseConcept(node.course, node.session.concept);
        }
      });
      setNodes(nodeList);
      setEdges(Array.isArray(payload.edges) ? payload.edges : []);
      setCourseGroups(Array.isArray(payload.groups) ? payload.groups : []);
      setSkills(Array.isArray(payload.skills) ? payload.skills : []);
      setUiGraph(payload.graph ?? null);
      const nextUnlocked = payload.unlocked ?? {};
      const previousUnlocked = prevUnlockedRef.current;
      const newlyUnlockedIds = Object.keys(nextUnlocked).filter(
        (id) => nextUnlocked[id] && !previousUnlocked[id],
      );
      if (newlyUnlockedIds.length) {
        setRecentlyUnlocked(newlyUnlockedIds);
      } else if (!silent) {
        setRecentlyUnlocked([]);
      }
      prevUnlockedRef.current = nextUnlocked;
      setUnlockedMap(nextUnlocked);
      setProgress(normaliseProgress(payload.progress));
      if (!silent) {
        setSelectedNodeId(null);
        setFocusNodeId(null);
      }

      if (payload.experiment) {
        const assignment: ExperimentAssignment = {
          name: payload.experiment.name,
          variant: payload.experiment.variant === 'list' ? 'list' : 'tree',
          source: payload.experiment.source ?? 'unknown',
          requestId: payload.experiment.request_id ?? null,
          rollout: payload.experiment.rollout ?? null,
          bucket: payload.experiment.bucket ?? null,
        };
        setExperiment(assignment);
        if (!silent) {
          trackExperimentExposure({
            experiment: assignment.name,
            variant: assignment.variant,
            source: assignment.source,
            bucket: assignment.bucket ?? undefined,
            requestId: assignment.requestId ?? undefined,
            rollout: assignment.rollout ?? undefined,
            surface: 'skill_tree_page',
          });
        }
      } else {
        setExperiment(null);
      }

      setError(payload.error?.message ?? null);
    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }
      const message = err instanceof Error ? err.message : '스킬 트리를 불러오지 못했습니다.';
      setError(message);
      if (!silent) {
        setExperiment(null);
      }
    } finally {
      if (!isMountedRef.current) {
        return;
      }
      if (silent) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  },
  [
    setVersion,
    setPalette,
    setNodes,
    setEdges,
    setCourseGroups,
    setSkills,
    setUiGraph,
    setUnlockedMap,
    setProgress,
    setSelectedNodeId,
    setFocusNodeId,
    setIsSimpleSkillTree,
    setRecentlyUnlocked,
    setIsLoading,
    setIsRefreshing,
    setExperiment,
    setError,
    buildSimpleSkillTree,
    extractSimpleSkillList,
    resetCourseConceptOverrides,
    registerCourseConcept,
    trackExperimentExposure,
    fetchSkillTree,
  ],
);

useEffect(() => {
  void loadSkillTree();
}, [loadSkillTree]);

useEffect(() => {
  return () => {
    isMountedRef.current = false;
  };
}, []);

useEffect(() => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const handleProgressUpdate = () => {
    void loadSkillTree({ silent: true });
  };
  window.addEventListener('skill-tree:progress-updated', handleProgressUpdate);
  return () => {
    window.removeEventListener('skill-tree:progress-updated', handleProgressUpdate);
  };
}, [loadSkillTree]);

useEffect(() => {
  if (focusTrackedRef.current === focusNodeId) {
    return;
  }
  focusTrackedRef.current = focusNodeId;
  trackSkillTreeFocusMode(focusNodeId ?? null);
}, [focusNodeId]);

  const skillMeta = useMemo(() => {
    const map = new Map<string, SkillSummary>();
    skills.forEach((skill) => map.set(skill.id, skill));
    return map;
  }, [skills]);

  const projectionLookup = useMemo(() => {
    const map = new Map<string, SkillTreeNode>();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

  const nodeProgressMap: Record<string, SkillNodeProgress> = progress.nodes ?? {};
  const skillProgressMap = progress.skills ?? {};

  const resolvedGraph = useMemo<SkillTreeGraphSpec | null>(() => {
    if (uiGraph && Array.isArray(uiGraph.nodes) && uiGraph.nodes.length) {
      return uiGraph;
    }
    if (!nodes.length) {
      return null;
    }

    const sortedGroups = (courseGroups.length
      ? courseGroups
      : [
          {
            id: 'general',
            label: '전체',
            order: 1,
            course_ids: [],
          },
        ]
    )
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const groupedNodes = new Map<string, SkillTreeNode[]>();
    nodes.forEach((node) => {
      const groupId = typeof node.group === 'string' && node.group ? node.group : 'general';
      if (!groupedNodes.has(groupId)) {
        groupedNodes.set(groupId, []);
      }
      groupedNodes.get(groupId)!.push(node);
    });

    const fallbackNodes: SkillTreeGraphSpec['nodes'] = [];
    sortedGroups.forEach((group) => {
      const bucket = groupedNodes.get(group.id) ?? [];
      const tierCounters = new Map<number, number>();
      bucket
        .slice()
        .sort((a, b) => {
          if (a.tier !== b.tier) {
            return a.tier - b.tier;
          }
          return a.label.localeCompare(b.label, 'ko');
        })
        .forEach((node) => {
          const row = Math.max(1, node.tier ?? 1);
          const nextCol = (tierCounters.get(row) ?? 0) + 1;
          tierCounters.set(row, nextCol);
          fallbackNodes.push({
            id: node.id,
            tree: group.id,
            tier: row,
            label: node.label,
            lens: node.lens ?? [],
            requires: (node.requires ?? []).map((req) => ({
              skill_id: req.skill_id,
              min_level: req.min_level ?? 0,
            })),
            xp: node.xp ?? { per_try: 0, per_correct: 0 },
            grid: {
              row,
              col: nextCol,
            },
          });
        });
    });

    if (!fallbackNodes.length) {
      return null;
    }

    return {
      version: version ?? 'fallback',
      trees: sortedGroups.map((group, index) => ({
        id: group.id,
        label: group.label,
        order: group.order ?? index + 1,
      })),
      nodes: fallbackNodes,
      edges: edges.map((edge) => ({ from: edge.from, to: edge.to })),
      meta: { derived_from_projection: true },
    };
  }, [courseGroups, edges, nodes, uiGraph, version]);

  const graphNodesView = useMemo<SkillTreeGraphNodeView[]>(() => {
    if (!resolvedGraph) {
      return [];
    }
    return resolvedGraph.nodes.map((uiNode) => {
      const projectionNode = projectionLookup.get(uiNode.id);

      const requirementSource =
        projectionNode?.requires ??
        uiNode.requires.map((req) => {
          const meta = skillMeta.get(req.skill_id);
          const currentLevel = skillProgressMap[req.skill_id]?.level ?? 0;
          return {
            skill_id: req.skill_id,
            label: meta?.label ?? req.skill_id,
            domain: meta?.domain ?? '',
            lens: meta?.lens ?? [],
            min_level: req.min_level,
            current_level: currentLevel,
            met: currentLevel >= req.min_level,
          };
        });

      const requires = requirementSource.map((req) => {
        const meta = skillMeta.get(req.skill_id);
        const currentLevel = req.current_level ?? skillProgressMap[req.skill_id]?.level ?? 0;
        return {
          ...req,
          label: req.label ?? meta?.label ?? req.skill_id,
          domain: req.domain ?? meta?.domain ?? '',
          lens: req.lens ?? meta?.lens ?? [],
          current_level: currentLevel,
          met: req.met ?? currentLevel >= req.min_level,
        };
      });

      const teaches = projectionNode?.teaches ?? [];
      const unlocked = unlockedMap[uiNode.id] ?? Boolean(projectionNode?.state?.unlocked);
      const baseState: SkillTreeNodeState =
        projectionNode?.state ?? {
          value: unlocked ? 'unlockable' : 'locked',
          completed: false,
          available: unlocked,
          unlocked,
        };
      const progressEntry =
        projectionNode?.progress ?? (nodeProgressMap[uiNode.id] as SkillNodeProgress | undefined);
      const resolvedState = deriveSkillState(baseState, progressEntry, unlocked);
      const normalisedState: SkillTreeNodeState = {
        ...baseState,
        value: resolvedState,
        unlocked: baseState.unlocked || unlocked || resolvedState !== 'locked',
        available: baseState.available || resolvedState !== 'locked',
        completed: baseState.completed || resolvedState === 'completed' || resolvedState === 'mastered',
        mastered: baseState.mastered || resolvedState === 'mastered',
      };

      return {
        id: uiNode.id,
        label: uiNode.label,
        tree: uiNode.tree,
        tier: uiNode.tier,
        lens: uiNode.lens ?? projectionNode?.lens ?? [],
        boss: Boolean(uiNode.boss),
        grid: uiNode.grid,
        xp: uiNode.xp,
        requires,
        teaches,
        state: normalisedState,
        resolvedState,
        progress: progressEntry ?? null,
      };
    });
  }, [resolvedGraph, projectionLookup, skillMeta, skillProgressMap, nodeProgressMap, unlockedMap]);

  const graphEdges = useMemo(() => resolvedGraph?.edges ?? [], [resolvedGraph]);
  const graphTrees = useMemo<SkillTreeGraphTree[]>(() => resolvedGraph?.trees ?? [], [resolvedGraph]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) {
      return null;
    }
    return graphNodesView.find((node) => node.id === selectedNodeId) ?? null;
  }, [graphNodesView, selectedNodeId]);

  useEffect(() => {
    if (selectedNodeId && !selectedNode) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, selectedNode]);

  useEffect(() => {
    if (isLoading || error || !resolvedGraph) {
      return;
    }
    const graphNodeCount = Array.isArray(resolvedGraph.nodes) ? resolvedGraph.nodes.length : 0;
    if (graphNodeCount === 0 || graphNodesView.length === 0) {
      const apiBaseUrl =
        (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || '';
      console.warn('[SkillTree] 그래프 노드가 비어 있습니다.', {
        apiBaseUrl,
        graphNodeCount,
        graphEdgeCount: Array.isArray(resolvedGraph.edges) ? resolvedGraph.edges.length : 0,
        payloadNodeCount: nodes.length,
        derivedFallback: Boolean(resolvedGraph.meta?.derived_from_projection),
      });
    }
  }, [isLoading, error, resolvedGraph, graphNodesView.length, nodes.length]);

  const handleStartCourse = (graphNode: SkillTreeGraphNodeView) => {
    if (graphNode.resolvedState === 'locked') {
      const unmet = graphNode.requires
        .filter((req) => !req.met)
        .map((req) => req.label)
        .filter(Boolean);
      window.alert(
        t(SKILL_STATE_META.locked.tooltipKey, {
          requires: unmet.length ? formatList(unmet) : '없음',
        }),
      );
      return;
    }
    navigate(`/skills/${graphNode.id}/problems`);
  };

  const selectedProjection = selectedNode ? projectionLookup.get(selectedNode.id) ?? null : null;

  if (isLoading) {
    return (
      <div className="mx-auto flex h-full max-w-4xl flex-col gap-6 p-6 text-slate-200">
        <p>스킬 트리를 불러오는 중입니다…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex h-full max-w-4xl flex-col gap-4 p-6 text-slate-200">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
          type="button"
        >
          <ArrowLeft size={18} /> 뒤로 가기
        </button>
        <div className="rounded-2xl border border-red-400/40 bg-red-900/30 p-4 text-red-100">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 p-6"
      data-testid="skill-tree-page"
      data-experiment-variant={experiment?.variant ?? 'tree'}
    >
      <header className="flex flex-col gap-3 text-white">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex w-max items-center gap-2 text-sm text-slate-300 hover:text-white"
          type="button"
        >
          <ArrowLeft size={18} /> 돌아가기
        </button>
        <h1 className="text-3xl font-semibold">스킬 트리</h1>
        <p className="text-sm text-slate-300">
          디아블로 스타일의 트리에서 원하는 노드를 선택해 다양한 학습 경로를 탐색해보세요. 노드를 클릭하면 해당 단계의 학습을 바로 시작할 수 있습니다.
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          <span>
            {TEXT.totalXpLabel} {progress.total_xp.toLocaleString()}
          </span>
          {progress.updated_at ? (
            <span>
              {TEXT.lastUpdatedLabel} {new Date(progress.updated_at).toLocaleString()}
            </span>
          ) : null}
          {version ? <span>버전 {version}</span> : null}
          {isRefreshing ? <span className="text-sky-300">진행도 갱신 중…</span> : null}
        </div>
      </header>

      {isSimpleSkillTree ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
          시작용 스킬 트리를 표시합니다. 선행 관계를 빠르게 확인할 수 있고, 학습 시작은 추후 단계별 업데이트와 함께 활성화됩니다.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800/60 bg-slate-950/40 p-3 text-xs text-slate-300">
        <label className="flex items-center gap-2">
          <span>확대</span>
          <input
            type="range"
            min="0.6"
            max="1.6"
            step="0.1"
            value={zoom}
            onChange={handleZoomInput}
            aria-label="스킬 트리 확대 배율"
          />
          <span>{zoom.toFixed(1)}x</span>
        </label>
        <button
          type="button"
          className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 transition hover:border-slate-500 hover:text-white"
          onClick={resetZoom}
        >
          100%로
        </button>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={highContrast}
            onChange={handleContrastCheckbox}
            aria-label="고대비 모드"
          />
          <span>고대비</span>
        </label>
        <button
          type="button"
          className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 transition hover:border-slate-500 hover:text-white"
          onClick={handleResetFocus}
        >
          포커스 해제
        </button>
      </div>

      <div className="skill-tree-layout">
        <div className="skill-tree-left">
          <div id="live-region" aria-live="polite" className="sr-only" />
          {graphNodesView.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center text-slate-300">
              <p>표시할 스킬 트리 데이터가 없습니다.</p>
              <p className="mt-2 text-xs text-slate-500">
                `/api/v1/skills/tree` 응답의 그래프 노드를 불러오지 못했습니다. 프로덕션 환경 변수 `VITE_API_BASE_URL` 및
                `skills.ui.json` 배포 상태를 확인하고, 자세한 점검 항목은 `docs/skill_tree_feedback.md`를 참고하세요.
              </p>
            </div>
          ) : (
            <SkillTreeGraph
              nodes={graphNodesView}
              edges={graphEdges}
              trees={graphTrees}
              palette={palette}
              onStart={handleStartCourse}
              onSelect={(node) => {
                setSelectedNodeId(node.id);
                setFocusNodeId(node.id);
              }}
              zoom={zoom}
              highContrast={highContrast}
              focusNodeId={focusNodeId}
              dimUnrelated={Boolean(focusNodeId)}
            />
          )}
        </div>
        <SelectedSkillPanel
          node={selectedNode}
          projection={selectedProjection}
          onStart={handleStartCourse}
          onClear={clearSelection}
        />
      </div>

      {skills.length ? (
        <section className="space-y-3">
          <header className="flex items-center justify-between text-white">
            <h3 className="text-xl font-semibold">원자 스킬 진행 현황</h3>
            <span className="text-xs text-slate-400">
              총 {skills.length}개 스킬 · 상위 12개 표시
            </span>
          </header>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {skills
              .slice()
              .sort((a, b) => b.level - a.level || a.label.localeCompare(b.label, 'ko'))
              .slice(0, 12)
              .map((skill) => (
                <div
                  key={skill.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-slate-200"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">{skill.label}</h4>
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                      Lv {skill.level}/{skill.levels}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{skill.domain}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {skill.lens.map((lens, index) => lensDisplay(lens, palette, index))}
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    XP {skill.xp.earned.toLocaleString()} (+{skill.xp.per_correct} / {skill.xp.per_try})
                  </p>
                </div>
              ))}
          </div>
        </section>
      ) : null}

      {graphEdges.length ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
          <h4 className="text-sm font-semibold text-slate-200">학습 전이 경로</h4>
          <p className="mt-2">
            총 {graphEdges.length}개의 전이(edge)가 정의되어 있습니다. 스텝을 완료하면 연결된 다음 스텝이
            강조됩니다.
          </p>
        </section>
      ) : null}
    </div>
  );
};

export default SkillTreePage;
