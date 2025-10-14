import { ArrowLeft } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type {
  SkillNodeProgress,
  SkillSummary,
  SkillTreeGroup,
  SkillTreeNode,
  SkillTreeProgress,
  SkillTreeRequirement,
  SkillTreeTeaching,
} from '../types';
import { fetchSkillTree } from '../utils/api';
import { trackExperimentExposure } from '../utils/analytics';
import { registerCourseConcept, resetCourseConceptOverrides, resolveConceptStep } from '../utils/skillMappings';

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
  requirementsLabel: '필요 스킬',
  teachesLabel: '강화 스킬',
  lockedTooltip: '해당 스텝은 아직 잠금 상태입니다.',
  startButton: '학습 시작',
  locked: '잠김',
  available: '진행 가능',
  completed: '완료',
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  locked: 'border-slate-700 text-slate-300 bg-slate-900/80',
  available: 'border-sky-500/60 text-sky-300 bg-sky-500/10',
  completed: 'border-emerald-500/60 text-emerald-300 bg-emerald-500/10',
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

type GroupTierView = {
  group: SkillTreeGroup;
  tiers: Array<{ tier: number; nodes: SkillTreeNode[] }>;
};

const formatXpSummary = (progress?: SkillNodeProgress): string | null => {
  if (!progress) {
    return null;
  }
  if (progress.xp_required && progress.xp_required > 0) {
    return `${progress.xp_earned.toLocaleString()} / ${progress.xp_required.toLocaleString()} XP`;
  }
  return `${progress.xp_earned.toLocaleString()} XP`;
};

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

const SkillTreePage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [palette, setPalette] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<SkillTreeGroup[]>([]);
  const [nodes, setNodes] = useState<SkillTreeNode[]>([]);
  const [edges, setEdges] = useState<SkillTreeResponse['edges']>([]);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [progress, setProgress] = useState<SkillTreeProgress>(createEmptyProgress());
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

        setVersion(payload.version ?? null);
        setPalette(payload.palette ?? {});
        setGroups(Array.isArray(payload.groups) ? payload.groups : []);
        const nodeList = Array.isArray(payload.nodes) ? payload.nodes : [];
        resetCourseConceptOverrides();
        nodeList.forEach((node) => {
          if (node.session?.concept) {
            registerCourseConcept(node.course, node.session.concept);
          }
        });
        setNodes(nodeList);
        setEdges(Array.isArray(payload.edges) ? payload.edges : []);
        setSkills(Array.isArray(payload.skills) ? payload.skills : []);
        setProgress(normaliseProgress(payload.progress));

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
          trackExperimentExposure({
            experiment: assignment.name,
            variant: assignment.variant,
            source: assignment.source,
            bucket: assignment.bucket ?? undefined,
            requestId: assignment.requestId ?? undefined,
            rollout: assignment.rollout ?? undefined,
            surface: 'skill_tree_page',
          });
        } else {
          setExperiment(null);
        }

        setError(payload.error?.message ?? null);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : '스킬 트리를 불러오지 못했습니다.';
          setError(message);
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

  const groupLookup = useMemo(() => {
    const map = new Map<string, SkillTreeGroup>();
    groups.forEach((group) => map.set(group.id, group));
    return map;
  }, [groups]);

  const groupedView: GroupTierView[] = useMemo(() => {
    const tierMap = new Map<string, Map<number, SkillTreeNode[]>>();
    nodes.forEach((node) => {
      const groupId = node.group;
      const tiers = tierMap.get(groupId) ?? new Map<number, SkillTreeNode[]>();
      const list = tiers.get(node.tier) ?? [];
      list.push(node);
      tiers.set(node.tier, list);
      tierMap.set(groupId, tiers);
    });

    const groupIds = new Set<string>([
      ...tierMap.keys(),
      ...groups.map((group) => group.id),
    ]);

    return Array.from(groupIds).map((groupId) => {
      const base =
        groupLookup.get(groupId) ??
        ({
          id: groupId,
          label: groupId === 'general' ? '기타' : groupId,
          order: Number.MAX_SAFE_INTEGER,
          course_ids: [],
        } as SkillTreeGroup);
      const tiers = Array.from(tierMap.get(groupId)?.entries() ?? [])
        .sort((a, b) => a[0] - b[0])
        .map(([tier, tierNodes]) => ({
          tier,
          nodes: tierNodes.slice().sort((a, b) => a.label.localeCompare(b.label, 'ko')),
        }));
      return { group: base, tiers };
    }).sort((a, b) => a.group.order - b.group.order);
  }, [groups, groupLookup, nodes]);

  const determineStepFromNode = (node: SkillTreeNode): 'S1' | 'S2' | 'S3' => {
    const fromId = node.id.match(/S([123])/);
    if (fromId) {
      const step = `S${fromId[1]}` as 'S1' | 'S2' | 'S3';
      return step;
    }
    const fromLabel = node.label.match(/S([123])/);
    if (fromLabel) {
      const step = `S${fromLabel[1]}` as 'S1' | 'S2' | 'S3';
      return step;
    }
    return 'S1';
  };

  const handleStartCourse = (node: SkillTreeNode) => {
    if (!node.state.available) {
      window.alert(TEXT.lockedTooltip);
      return;
    }
    const mapping = resolveConceptStep(node.id);
    const conceptId = node.session?.concept ?? mapping?.concept ?? 'ALG-AP';
    const fallbackStep = determineStepFromNode(node);
    const step = (node.session?.step ?? mapping?.step ?? fallbackStep) as 'S1' | 'S2' | 'S3';
    const params = new URLSearchParams();
    params.set('skill', node.id);
    if (conceptId) {
      params.set('concept', conceptId);
    }
    if (step) {
      params.set('step', step);
    }
    if (node.session) {
      params.set('session', JSON.stringify(node.session));
    }
    navigate(`/game?${params.toString()}`);
  };

  const renderRequirementChips = (requirements: SkillTreeRequirement[]) => {
    if (!requirements.length) {
      return null;
    }
    return (
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
        <span className="font-semibold text-slate-200">{TEXT.requirementsLabel}</span>
        {requirements.map((item) => (
          <span
            key={`req-${item.skill_id}`}
            className={`rounded-full border px-3 py-1 ${
              item.met
                ? 'border-emerald-500/60 text-emerald-300'
                : 'border-slate-700 text-slate-400'
            }`}
          >
            {item.label} Lv {item.current_level}/{item.min_level}
          </span>
        ))}
      </div>
    );
  };

  const renderTeachingChips = (teaches: SkillTreeTeaching[]) => {
    if (!teaches.length) {
      return null;
    }
    return (
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
        <span className="font-semibold text-slate-200">{TEXT.teachesLabel}</span>
        {teaches.map((item) => (
          <span
            key={`teach-${item.skill_id}`}
            className="rounded-full border border-slate-700 px-3 py-1"
          >
            {item.label} +Lv{item.delta_level}
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
          각 카드에서 필요한 원자 스킬과 강화되는 스킬을 확인하고 학습을 시작해보세요.
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
        </div>
      </header>

      {groupedView.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center text-slate-300">
          표시할 스킬 트리 데이터가 없습니다.
        </div>
      ) : (
        groupedView.map(({ group, tiers }) => (
          <section key={`group-${group.id}`} className="space-y-5">
            <header className="flex flex-col gap-1 text-white">
              <h2 className="text-2xl font-semibold">{group.label}</h2>
              <p className="text-xs text-slate-400">
                포함 코스: {group.course_ids.length ? group.course_ids.join(', ') : '미지정'}
              </p>
            </header>

            {tiers.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                해당 그룹에 속하는 스킬이 없습니다.
              </div>
            ) : (
              tiers.map((tier) => (
                <div key={`group-${group.id}-tier-${tier.tier}`} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-200">Tier {tier.tier}</h3>
                    <span className="text-xs text-slate-400">{tier.nodes.length} 단계</span>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {tier.nodes.map((node) => {
                      const statusClasses =
                        STATUS_BADGE_CLASSES[node.state.value] ?? STATUS_BADGE_CLASSES.locked;
                      const xpSummary = formatXpSummary(node.progress);
                      const lrcStatus = node.progress?.lrc_status ?? 'pending';
                      return (
                        <article
                          key={node.id}
                          className={`rounded-2xl border p-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
                            node.state.value === 'locked'
                              ? 'border-slate-800 bg-slate-950/60 text-slate-300 opacity-70'
                              : 'border-sky-500/30 bg-slate-900/80 text-slate-100 shadow-lg shadow-sky-900/20'
                          }`}
                          data-node-id={node.id}
                          data-node-state={node.state.value}
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs uppercase tracking-wide text-slate-400">
                                  {node.course} · Tier {node.tier}
                                </p>
                                <h4 className="text-lg font-semibold text-white">{node.label}</h4>
                              </div>
                              <span className={`rounded-full border px-3 py-1 text-xs ${statusClasses}`}>
                                {TEXT[node.state.value]}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {node.lens.map((lens, index) => lensDisplay(lens, palette, index))}
                            </div>
                            <div className="text-xs text-slate-400">
                              <span className="font-semibold text-slate-200">LRC</span>{' '}
                              {lrcStatus}
                            </div>
                            {xpSummary ? (
                              <div className="text-xs text-slate-400">{xpSummary}</div>
                            ) : null}
                          </div>

                          {renderRequirementChips(node.requires)}
                          {renderTeachingChips(node.teaches)}

                          {node.misconceptions.length ? (
                            <details className="mt-3 text-xs text-slate-400">
                              <summary className="cursor-pointer text-slate-300">자주 틀리는 개념</summary>
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.7rem] text-slate-400">
                                {node.misconceptions.map((item) => (
                                  <li key={`${node.id}-mc-${item}`}>{item}</li>
                                ))}
                              </ul>
                            </details>
                          ) : null}

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleStartCourse(node)}
                              disabled={!node.state.available}
                              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
                                node.state.available
                                  ? 'bg-sky-500 text-slate-900 shadow-lg shadow-sky-900/30 hover:-translate-y-0.5 hover:bg-sky-400'
                                  : 'cursor-not-allowed bg-slate-800/80 text-slate-500'
                              }`}
                            >
                              {TEXT.startButton}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </section>
        ))
      )}

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

      {edges.length ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
          <h4 className="text-sm font-semibold text-slate-200">학습 전이 경로</h4>
          <p className="mt-2">
            총 {edges.length}개의 전이(edge)가 정의되어 있습니다. 스텝을 완료하면 연결된 다음 스텝이
            강조됩니다.
          </p>
        </section>
      ) : null}
    </div>
  );
};

export default SkillTreePage;
