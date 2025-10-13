import { ArrowLeft } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type {
  BipartiteCourseStepNode,
  BipartiteGraph,
  BipartiteGraphEdge,
  BipartiteSkillNode,
  SkillNode,
  SkillTreeProgress,
  SkillNodeProgress,
  AtomicSkillProgress,
} from '../types';
import { trackExperimentExposure } from '../utils/analytics';
import { fetchSkillTree } from '../utils/api';
import { resolveConceptStep } from '../utils/skillMappings';

type TierGroup = {
  tier: number;
  nodes: SkillNode[];
};

type CourseTierGroup = {
  tier: number;
  nodes: BipartiteCourseStepNode[];
};

type AtomicDomainGroup = {
  domain: string;
  nodes: BipartiteSkillNode[];
};

type ExperimentAssignment = {
  name: string;
  variant: 'tree' | 'list';
  source: string;
  requestId: string | null;
  rollout: number | null;
  bucket: string | number | null;
};

type RequirementEntry = {
  skill: BipartiteSkillNode;
  minLevel: number;
};

type TeachesEntry = {
  skill: BipartiteSkillNode;
  deltaLevel: number;
};

type TaughtByEntry = {
  course: BipartiteCourseStepNode;
  deltaLevel: number;
};

const statusClass =
  'rounded-2xl border p-4 transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500';

const TEXT = {
  requirementsLabel: '필요 스킬',
  teachesLabel: '강화 스킬',
  taughtByLabel: '학습 코스',
  totalXpLabel: '총 XP',
  lastUpdatedLabel: '업데이트',
  lockedTooltip: '해당 스킬은 아직 잠금 상태입니다.',
  unlocked: '해제됨',
  locked: '잠김',
  completed: '완료',
  available: '진행 가능',
};

const createEmptyProgress = (): SkillTreeProgress => ({
  user_id: null,
  updated_at: null,
  total_xp: 0,
  nodes: {},
  skills: {},
});

const normaliseProgress = (raw?: SkillTreeProgress | null): SkillTreeProgress => ({
  user_id: raw?.user_id ?? null,
  updated_at: raw?.updated_at ?? null,
  total_xp: raw?.total_xp ?? 0,
  nodes: raw?.nodes ?? {},
  skills: raw?.skills ?? {},
});

export const SkillTreePage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<SkillNode[]>([]);
  const [courseSteps, setCourseSteps] = useState<BipartiteCourseStepNode[]>([]);
  const [atomicSkills, setAtomicSkills] = useState<BipartiteSkillNode[]>([]);
  const [bipartitePalette, setBipartitePalette] = useState<Record<string, string>>({});
  const [requiresMap, setRequiresMap] = useState<Record<string, RequirementEntry[]>>({});
  const [teachesMap, setTeachesMap] = useState<Record<string, TeachesEntry[]>>({});
  const [taughtByMap, setTaughtByMap] = useState<Record<string, TaughtByEntry[]>>({});
  const [progress, setProgress] = useState<SkillTreeProgress>(createEmptyProgress());
  const [unlockedMap, setUnlockedMap] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'course' | 'skill' | 'atomic'>('skill');
  const [experiment, setExperiment] = useState<ExperimentAssignment | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const payload = await fetchSkillTree();
        if (cancelled) {
          return;
        }
        setNodes(payload.graph.nodes ?? []);

        if (payload.bipartite_graph) {
          const normalized = payload.bipartite_graph as BipartiteGraph;
          const nextCourse: BipartiteCourseStepNode[] = [];
          const nextAtomic: BipartiteSkillNode[] = [];
          (normalized.nodes ?? []).forEach((node) => {
            if (node.type === 'course_step') {
              nextCourse.push(node);
            } else if (node.type === 'skill') {
              nextAtomic.push(node);
            }
          });
          setCourseSteps(nextCourse);
          setAtomicSkills(nextAtomic);
          setBipartitePalette(normalized.palette ?? {});

          const skillLookup = Object.fromEntries(nextAtomic.map((skill) => [skill.id, skill]));
          const courseLookup = Object.fromEntries(nextCourse.map((course) => [course.id, course]));
          const nextRequires: Record<string, RequirementEntry[]> = {};
          const nextTeaches: Record<string, TeachesEntry[]> = {};
          const nextTaughtBy: Record<string, TaughtByEntry[]> = {};

          (normalized.edges ?? []).forEach((edge: BipartiteGraphEdge) => {
            if (edge.type === 'requires') {
              const skill = skillLookup[edge.from];
              if (!skill) {
                return;
              }
              if (!nextRequires[edge.to]) {
                nextRequires[edge.to] = [];
              }
              nextRequires[edge.to].push({ skill, minLevel: edge.min_level ?? 0 });
            } else if (edge.type === 'teaches') {
              const skill = skillLookup[edge.to];
              const course = courseLookup[edge.from];
              if (!skill || !course) {
                return;
              }
              if (!nextTeaches[edge.from]) {
                nextTeaches[edge.from] = [];
              }
              nextTeaches[edge.from].push({ skill, deltaLevel: edge.delta_level ?? 0 });

              if (!nextTaughtBy[edge.to]) {
                nextTaughtBy[edge.to] = [];
              }
              nextTaughtBy[edge.to].push({ course, deltaLevel: edge.delta_level ?? 0 });
            }
          });

          setRequiresMap(nextRequires);
          setTeachesMap(nextTeaches);
          setTaughtByMap(nextTaughtBy);
          setViewMode((prev) => {
            if (prev !== 'skill') {
              return prev;
            }
            if (nextCourse.length > 0) {
              return 'course';
            }
            if (nextAtomic.length > 0) {
              return 'atomic';
            }
            return prev;
          });
        } else {
          setCourseSteps([]);
          setAtomicSkills([]);
          setBipartitePalette({});
          setRequiresMap({});
          setTeachesMap({});
          setTaughtByMap({});
        }

        const normalisedProgress = normaliseProgress(payload.progress as SkillTreeProgress | undefined);
        setProgress(normalisedProgress);
        setUnlockedMap(payload.unlocked ?? {});

        const nextExperiment: ExperimentAssignment | null = payload.experiment
          ? {
              name: payload.experiment.name,
              variant: payload.experiment.variant === 'list' ? 'list' : 'tree',
              source: payload.experiment.source ?? 'unknown',
              requestId: payload.experiment.request_id ?? null,
              rollout: payload.experiment.rollout ?? null,
              bucket: payload.experiment.bucket ?? null,
            }
          : null;
        if (nextExperiment) {
          trackExperimentExposure({
            experiment: nextExperiment.name,
            variant: nextExperiment.variant,
            source: nextExperiment.source,
            bucket: nextExperiment.bucket ?? undefined,
            requestId: nextExperiment.requestId ?? undefined,
            rollout: nextExperiment.rollout ?? undefined,
            surface: 'skill_tree_page',
          });
        }
        setExperiment(nextExperiment);
        if (payload.error && typeof (payload.error as { message?: unknown }).message === 'string') {
          const message = (payload.error as { message?: unknown }).message;
          setError(typeof message === 'string' ? message : null);
        } else {
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '스킬 트리를 불러오지 못했습니다.');
          setExperiment(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const tierGroups: TierGroup[] = useMemo(() => {
    const map = new Map<number, SkillNode[]>();
    nodes.forEach((node) => {
      const list = map.get(node.tier) ?? [];
      list.push(node);
      map.set(node.tier, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([tier, list]) => ({
        tier,
        nodes: list.sort((a, b) => a.label.localeCompare(b.label, 'ko')),
      }));
  }, [nodes]);

  const courseTierGroups: CourseTierGroup[] = useMemo(() => {
    const map = new Map<number, BipartiteCourseStepNode[]>();
    courseSteps.forEach((node) => {
      const list = map.get(node.tier) ?? [];
      list.push(node);
      map.set(node.tier, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([tier, list]) => ({
        tier,
        nodes: list.sort((a, b) => a.label.localeCompare(b.label, 'ko')),
      }));
  }, [courseSteps]);

  const atomicDomainGroups: AtomicDomainGroup[] = useMemo(() => {
    const map = new Map<string, BipartiteSkillNode[]>();
    atomicSkills.forEach((skill) => {
      const key = skill.domain || '기타';
      const list = map.get(key) ?? [];
      list.push(skill);
      map.set(key, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'ko'))
      .map(([domain, list]) => ({
        domain,
        nodes: list.sort((a, b) => a.label.localeCompare(b.label, 'ko')),
      }));
  }, [atomicSkills]);

  const getCourseNodeProgress = (id: string): SkillNodeProgress | undefined => progress.nodes[id];
  const getAtomicSkillProgress = (id: string): AtomicSkillProgress | undefined => progress.skills[id];

  const getUnlockedState = (id: string): boolean => {
    if (unlockedMap[id] !== undefined) {
      return unlockedMap[id];
    }
    const courseState = getCourseNodeProgress(id);
    if (courseState) {
      return courseState.unlocked;
    }
    const skillState = getAtomicSkillProgress(id);
    if (skillState) {
      return skillState.level > 0;
    }
    return false;
  };

  const getCompletionState = (id: string): boolean => getCourseNodeProgress(id)?.completed ?? false;

  const getNodeXpSummary = (entry?: SkillNodeProgress) => {
    if (!entry) {
      return null;
    }
    if (entry.xp_required && entry.xp_required > 0) {
      return `${entry.xp_earned}/${entry.xp_required} XP`;
    }
    return `${entry.xp_earned} XP`;
  };

  const handleStartSkill = (skillId: string) => {
    if (!getUnlockedState(skillId)) {
      window.alert(TEXT.lockedTooltip);
      return;
    }
    const mapping = resolveConceptStep(skillId);
    if (!mapping) {
      window.alert('이 스킬은 아직 세션과 연결되지 않았습니다.');
      return;
    }
    navigate(`/game?skill=${encodeURIComponent(skillId)}&concept=${encodeURIComponent(mapping.concept)}&step=${mapping.step}`);
  };

  const lensChip = (lens: string, key?: string) => {
    const color = bipartitePalette[lens];
    const style = color ? { borderColor: color, color } : undefined;
    return (
      <span
        key={key ?? lens}
        className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase"
        style={style}
      >
        {lens}
      </span>
    );
  };

  const renderRequirements = (courseId: string) => {
    const entries = requiresMap[courseId];
    if (!entries?.length) {
      return null;
    }
    return (
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300" data-testid={`requirements-${courseId}`}>
        <span className="font-semibold text-slate-200">{TEXT.requirementsLabel}</span>
        {entries.map(({ skill, minLevel }) => {
          const current = getAtomicSkillProgress(skill.id)?.level ?? 0;
          const meets = current >= minLevel;
          return (
            <span
              key={`${courseId}-req-${skill.id}`}
              className={`rounded-full border px-3 py-1 ${
                meets ? 'border-emerald-500/60 text-emerald-300' : 'border-slate-700 text-slate-400'
              }`}
            >
              {skill.label} Lv {current}/{minLevel}
            </span>
          );
        })}
      </div>
    );
  };

  const renderTeaches = (courseId: string) => {
    const entries = teachesMap[courseId];
    if (!entries?.length) {
      return null;
    }
    return (
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300" data-testid={`teaches-${courseId}`}>
        <span className="font-semibold text-slate-200">{TEXT.teachesLabel}</span>
        {entries.map(({ skill, deltaLevel }) => (
          <span key={`${courseId}-teach-${skill.id}`} className="rounded-full border border-slate-700 px-3 py-1">
            {skill.label} +Lv{deltaLevel}
          </span>
        ))}
      </div>
    );
  };

  const renderTaughtBy = (skillId: string) => {
    const entries = taughtByMap[skillId];
    if (!entries?.length) {
      return null;
    }
    return (
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300" data-testid={`taught-by-${skillId}`}>
        <span className="font-semibold text-slate-200">{TEXT.taughtByLabel}</span>
        {entries.map(({ course, deltaLevel }) => (
          <span key={`${skillId}-from-${course.id}`} className="rounded-full border border-slate-700 px-3 py-1">
            {course.label} +Lv{deltaLevel}
          </span>
        ))}
      </div>
    );
  };

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
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white" type="button">
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
        <button onClick={() => navigate(-1)} className="inline-flex w-max items-center gap-2 text-sm text-slate-300 hover:text-white" type="button">
          <ArrowLeft size={18} /> 돌아가기
        </button>
        <h1 className="text-3xl font-semibold">스킬 트리</h1>
        <p className="text-sm text-slate-300">
          {experiment?.variant === 'list'
            ? '리스트 보기로 렌즈와 티어를 빠르게 확인하고 바로 학습을 시작하세요.'
            : '노드를 선택하면 해당 스킬에 맞춘 학습 세션으로 이동합니다. 잠금 조건은 ALL 방식으로 모든 선행 스킬을 완료해야 합니다.'}
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
        </div>
      </header>

      {(courseSteps.length > 0 || atomicSkills.length > 0) && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="스킬 뷰 전환">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
              viewMode === 'course'
                ? 'bg-sky-500 text-slate-900 shadow-lg shadow-sky-900/30'
                : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700/70'
            }`}
            onClick={() => setViewMode('course')}
            aria-pressed={viewMode === 'course'}
            data-testid="view-toggle-course"
          >
            코스·스텝
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
              viewMode === 'atomic'
                ? 'bg-sky-500 text-slate-900 shadow-lg shadow-sky-900/30'
                : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700/70'
            }`}
            onClick={() => setViewMode('atomic')}
            aria-pressed={viewMode === 'atomic'}
            data-testid="view-toggle-atomic"
          >
            원자 스킬
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
              viewMode === 'skill'
                ? 'bg-sky-500 text-slate-900 shadow-lg shadow-sky-900/30'
                : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700/70'
            }`}
            onClick={() => setViewMode('skill')}
            aria-pressed={viewMode === 'skill'}
            data-testid="view-toggle-legacy"
          >
            기존 노드
          </button>
        </div>
      )}

      {viewMode === 'course' && courseSteps.length > 0 ? (
        <div className="flex flex-col gap-6" data-testid="course-steps">
          {courseTierGroups.map((group) => (
            <section key={`course-tier-${group.tier}`} className="flex flex-col gap-4">
              <header className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Tier {group.tier}</h2>
                <span className="text-sm text-slate-400">{group.nodes.length} 단계</span>
              </header>
              <div className="grid gap-4 lg:grid-cols-2">
                {group.nodes.map((node) => {
                  const nodeProgress = getCourseNodeProgress(node.id);
                  const isUnlocked = getUnlockedState(node.id);
                  const isCompleted = getCompletionState(node.id);
                  const xpSummary = getNodeXpSummary(nodeProgress);
                  const lrcStatus = nodeProgress?.lrc_status ?? 'pending';
                  const statusLabel = isCompleted ? TEXT.completed : isUnlocked ? TEXT.available : TEXT.locked;
                  return (
                    <article
                      key={node.id}
                      className={`${statusClass} bg-slate-900/70 text-left text-slate-200 ${
                        isUnlocked ? 'hover:bg-slate-800/80' : 'opacity-60'
                      }`}
                    >
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {node.id}
                        </span>
                        <p className="text-lg font-semibold text-white">{node.label}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                          <span
                            className={`rounded-full border px-3 py-1 ${
                              isCompleted
                                ? 'border-emerald-500/70 text-emerald-300'
                                : isUnlocked
                                  ? 'border-sky-500/60 text-sky-300'
                                  : 'border-slate-700 text-slate-400'
                            }`}
                          >
                            {statusLabel}
                          </span>
                          {xpSummary ? (
                            <span className="rounded-full border border-slate-700 px-3 py-1">{xpSummary}</span>
                          ) : null}
                          <span className="rounded-full border border-slate-700 px-3 py-1">
                            LRC {lrcStatus.toUpperCase()}
                          </span>
                        </div>
                        {node.misconceptions.length > 0 ? (
                          <p className="text-xs text-slate-400">오개념: {node.misconceptions.join(', ')}</p>
                        ) : null}
                      </div>
                      {renderRequirements(node.id)}
                      {renderTeaches(node.id)}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                        <span className="rounded-full border border-slate-700 px-3 py-1">
                          시도당 XP {node.xp.per_try}
                        </span>
                        <span className="rounded-full border border-slate-700 px-3 py-1">
                          정답 XP {node.xp.per_correct}
                        </span>
                        {node.lens.map((lens) => lensChip(lens, `${node.id}-${lens}`))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {viewMode === 'atomic' && atomicSkills.length > 0 ? (
        <div className="flex flex-col gap-6" data-testid="atomic-skills">
          {atomicDomainGroups.map((group) => (
            <section key={`domain-${group.domain}`} className="flex flex-col gap-4">
              <header className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">{group.domain}</h2>
                <span className="text-sm text-slate-400">{group.nodes.length} 스킬</span>
              </header>
              <div className="grid gap-4 lg:grid-cols-2">
                {group.nodes.map((skill) => {
                  const skillProgress = getAtomicSkillProgress(skill.id);
                  const levelEarned = skillProgress?.level ?? 0;
                  const xpEarned = skillProgress?.xp ?? 0;
                  const isUnlocked = getUnlockedState(skill.id);
                  return (
                    <article
                      key={skill.id}
                      className={`${statusClass} bg-slate-900/70 text-left text-slate-200 ${
                        isUnlocked ? 'hover:bg-slate-800/80' : 'opacity-60'
                      }`}
                    >
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          목표 레벨 {skill.levels} · {skill.id}
                        </span>
                        <p className="text-lg font-semibold text-white">{skill.label}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                          <span className="rounded-full border border-slate-700 px-3 py-1">
                            현재 레벨 {levelEarned}
                          </span>
                          <span className="rounded-full border border-slate-700 px-3 py-1">
                            누적 XP {xpEarned}
                          </span>
                          <span
                            className={`rounded-full border px-3 py-1 ${
                              isUnlocked ? 'border-sky-500/60 text-sky-300' : 'border-slate-700 text-slate-400'
                            }`}
                          >
                            {isUnlocked ? TEXT.unlocked : TEXT.locked}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                        <span className="rounded-full border border-slate-700 px-3 py-1">
                          시도당 XP {skill.xp_per_try}
                        </span>
                        <span className="rounded-full border border-slate-700 px-3 py-1">
                          정답 XP {skill.xp_per_correct}
                        </span>
                        {skill.lens.map((lens) => lensChip(lens, `${skill.id}-${lens}`))}
                      </div>
                      {renderTaughtBy(skill.id)}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {viewMode === 'skill' &&
        (experiment?.variant === 'list' ? (
          <div className="flex flex-col gap-4" data-testid="skill-tree-list">
            {nodes
              .slice()
              .sort((a, b) => a.label.localeCompare(b.label, 'ko'))
              .map((node) => {
                const nodeProgress = getCourseNodeProgress(node.id);
                const isUnlocked = getUnlockedState(node.id);
                const isCompleted = getCompletionState(node.id);
                const xpSummary = getNodeXpSummary(nodeProgress);
                const statusLabel = isCompleted ? TEXT.completed : isUnlocked ? TEXT.available : TEXT.locked;
                return (
                  <article
                    key={node.id}
                    className={`${statusClass} bg-slate-900/70 text-left text-slate-100 ${
                      isUnlocked ? 'hover:bg-slate-800/80' : 'opacity-60'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Tier {node.tier} · {node.kind.toUpperCase()}
                        </span>
                        <p className="text-lg font-semibold text-white">{node.label}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                          <span
                            className={`rounded-full border px-3 py-1 ${
                              isCompleted
                                ? 'border-emerald-500/70 text-emerald-300'
                                : isUnlocked
                                  ? 'border-sky-500/60 text-sky-300'
                                  : 'border-slate-700 text-slate-400'
                            }`}
                          >
                            {statusLabel}
                          </span>
                          {xpSummary ? (
                            <span className="rounded-full border border-slate-700 px-3 py-1">{xpSummary}</span>
                          ) : null}
                        </div>
                        {node.keywords?.length ? (
                          <p className="text-xs text-slate-400">키워드: {node.keywords.join(', ')}</p>
                        ) : null}
                      </div>
                      <button
                        onClick={() => handleStartSkill(node.id)}
                        className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                          isUnlocked
                            ? 'bg-sky-500 text-slate-900 shadow-lg shadow-sky-900/30 hover:-translate-y-0.5 hover:bg-sky-400'
                            : 'cursor-not-allowed bg-slate-700/60 text-slate-300'
                        }`}
                        type="button"
                        disabled={!isUnlocked}
                        aria-disabled={!isUnlocked}
                      >
                        {isUnlocked ? '학습 시작' : TEXT.locked}
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                      <span className="rounded-full border border-slate-700 px-3 py-1">
                        경험치 +{node.xp_per_correct}
                      </span>
                      <span className="rounded-full border border-slate-700 px-3 py-1">
                        시도당 {node.xp_per_try} XP
                      </span>
                      {node.lens.map((lens) => lensChip(lens, `${node.id}-${lens}`))}
                    </div>
                  </article>
                );
              })}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-5">
            {tierGroups.map((group) => (
              <section key={group.tier} className="flex flex-col gap-4">
                <h2 className="rounded-full bg-slate-800/80 px-4 py-2 text-center text-sm font-semibold text-slate-200">
                  Tier {group.tier}
                </h2>
                <div className="flex flex-col gap-3">
                  {group.nodes.map((node) => {
                    const nodeProgress = getCourseNodeProgress(node.id);
                    const isUnlocked = getUnlockedState(node.id);
                    const isCompleted = getCompletionState(node.id);
                    const statusLabel = isCompleted ? TEXT.completed : isUnlocked ? TEXT.available : TEXT.locked;
                    return (
                      <button
                        key={node.id}
                        className={`${statusClass} bg-slate-900/70 text-left text-slate-100 ${
                          isUnlocked ? 'hover:bg-slate-800/80' : 'cursor-not-allowed opacity-60'
                        }`}
                        onClick={() => handleStartSkill(node.id)}
                        type="button"
                        disabled={!isUnlocked}
                        aria-disabled={!isUnlocked}
                      >
                        <span className="text-sm font-semibold">{node.label}</span>
                        <span className="mt-1 block text-xs text-slate-300">
                          {node.kind.toUpperCase()}
                        </span>
                        <span
                          className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs ${
                            isCompleted
                              ? 'border-emerald-500/70 text-emerald-300'
                              : isUnlocked
                                ? 'border-sky-500/60 text-sky-300'
                                : 'border-slate-700 text-slate-400'
                          }`}
                        >
                          {statusLabel}
                        </span>
                        {nodeProgress ? (
                          <span className="mt-1 block text-xs text-slate-400">
                            XP {nodeProgress.xp_earned}
                          </span>
                        ) : null}
                        {node.keywords?.length ? (
                          <span className="mt-2 block text-xs text-slate-400">
                            {node.keywords.join(', ')}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ))}
    </div>
  );
};

export default SkillTreePage;
