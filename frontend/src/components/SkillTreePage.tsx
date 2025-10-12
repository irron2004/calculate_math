import { ArrowLeft } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { SkillNode } from '../types';
import { fetchSkillTree } from '../utils/api';
import { resolveConceptStep } from '../utils/skillMappings';

type TierGroup = {
  tier: number;
  nodes: SkillNode[];
};

const statusClass = 'rounded-2xl border p-4 transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500';

export const SkillTreePage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<SkillNode[]>([]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchSkillTree()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setNodes(payload.graph.nodes ?? []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '스킬 트리를 불러오지 못했습니다.');
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
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-3 text-white">
        <button onClick={() => navigate(-1)} className="inline-flex w-max items-center gap-2 text-sm text-slate-300 hover:text-white" type="button">
          <ArrowLeft size={18} /> 돌아가기
        </button>
        <h1 className="text-3xl font-semibold">스킬 트리</h1>
        <p className="text-sm text-slate-300">
          노드를 선택하면 해당 스킬에 맞춘 학습 세션으로 이동합니다. 잠금 조건은 ALL 방식으로 모든 선행 스킬을 완료해야 합니다.
        </p>
      </header>

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
    </div>
  );
};

export default SkillTreePage;
