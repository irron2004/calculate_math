import { ArrowLeft } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { SkillNode } from '../types';
import { trackExperimentExposure } from '../utils/analytics';
import { fetchSkillTree } from '../utils/api';
import { resolveConceptStep } from '../utils/skillMappings';

type TierGroup = {
  tier: number;
  nodes: SkillNode[];
};

type ExperimentAssignment = {
  name: string;
  variant: 'tree' | 'list';
  source: string;
  requestId: string | null;
  rollout: number | null;
  bucket: string | number | null;
};

const statusClass = 'rounded-2xl border p-4 transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500';

export const SkillTreePage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<SkillNode[]>([]);
  const [experiment, setExperiment] = useState<ExperimentAssignment | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setExperiment(null);
    fetchSkillTree()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setNodes(payload.graph.nodes ?? []);
        setError(null);
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
        setExperiment(nextExperiment);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '스킬 트리를 불러오지 못했습니다.');
          setExperiment(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
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

  const sortedByLabel = useMemo(() => {
    return [...nodes].sort((a, b) => a.label.localeCompare(b.label, 'ko'));
  }, [nodes]);

  const variant: 'tree' | 'list' = experiment?.variant === 'list' ? 'list' : 'tree';

  useEffect(() => {
    if (!experiment) {
      return;
    }
    trackExperimentExposure({
      experiment: experiment.name,
      variant: experiment.variant,
      source: experiment.source,
      bucket: experiment.bucket ?? undefined,
      requestId: experiment.requestId ?? undefined,
      rollout: experiment.rollout ?? undefined,
      surface: 'skill_tree_page',
    });
  }, [experiment]);

  const handleStartSkill = (skillId: string) => {
    const mapping = resolveConceptStep(skillId);
    if (!mapping) {
      window.alert('이 스킬은 아직 세션과 연결되지 않았습니다.');
      return;
    }
    navigate(`/game?skill=${encodeURIComponent(skillId)}&concept=${encodeURIComponent(mapping.concept)}&step=${mapping.step}`);
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
      data-experiment-variant={variant}
    >
      <header className="flex flex-col gap-3 text-white">
        <button onClick={() => navigate(-1)} className="inline-flex w-max items-center gap-2 text-sm text-slate-300 hover:text-white" type="button">
          <ArrowLeft size={18} /> 돌아가기
        </button>
        <h1 className="text-3xl font-semibold">스킬 트리</h1>
        <p className="text-sm text-slate-300">
          {variant === 'list'
            ? '리스트 보기로 렌즈와 티어를 빠르게 확인하고 바로 학습을 시작하세요.'
            : '노드를 선택하면 해당 스킬에 맞춘 학습 세션으로 이동합니다. 잠금 조건은 ALL 방식으로 모든 선행 스킬을 완료해야 합니다.'}
        </p>
      </header>

      {variant === 'list' ? (
        <div className="flex flex-col gap-4" data-testid="skill-tree-list">
          {sortedByLabel.map((node) => (
            <article
              key={node.id}
              className={`${statusClass} bg-slate-900/70 text-left text-slate-100 hover:bg-slate-800/80`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Tier {node.tier} · {node.kind.toUpperCase()}
                  </span>
                  <p className="text-lg font-semibold text-white">{node.label}</p>
                  {node.keywords?.length ? (
                    <p className="text-xs text-slate-400">키워드: {node.keywords.join(', ')}</p>
                  ) : null}
                </div>
                <button
                  onClick={() => handleStartSkill(node.id)}
                  className="inline-flex items-center justify-center rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-900/30 transition hover:-translate-y-0.5 hover:bg-sky-400"
                  type="button"
                >
                  학습 시작
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="rounded-full border border-slate-700 px-3 py-1">
                  경험치 +{node.xp_per_correct}
                </span>
                <span className="rounded-full border border-slate-700 px-3 py-1">
                  시도당 {node.xp_per_try} XP
                </span>
                {node.lens.map((lens) => (
                  <span key={lens} className="rounded-full border border-slate-700 px-3 py-1 uppercase text-slate-200">
                    {lens}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          {tierGroups.map((group) => (
            <section key={group.tier} className="flex flex-col gap-4">
              <h2 className="rounded-full bg-slate-800/80 px-4 py-2 text-center text-sm font-semibold text-slate-200">
                Tier {group.tier}
              </h2>
              <div className="flex flex-col gap-3">
                {group.nodes.map((node) => (
                  <button
                    key={node.id}
                    className={`${statusClass} bg-slate-900/70 text-left text-slate-100 hover:bg-slate-800/80`}
                    onClick={() => handleStartSkill(node.id)}
                    type="button"
                  >
                    <span className="text-sm font-semibold">{node.label}</span>
                    <span className="mt-1 block text-xs text-slate-300">{node.kind.toUpperCase()}</span>
                    {node.keywords?.length ? (
                      <span className="mt-2 block text-xs text-slate-400">{node.keywords.join(', ')}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default SkillTreePage;
