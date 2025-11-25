import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import type { SkillProblemListResponse } from '../types';
import { fetchSkillProblems } from '../utils/api';

const SkillProblemListPage = () => {
  const { skillId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<SkillProblemListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const firstProblemId = useMemo(() => data?.items[0]?.id ?? null, [data]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!skillId) {
        setError('skillId가 없습니다.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await fetchSkillProblems(skillId);
        if (mounted) {
          setData(res);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '문제를 불러오지 못했습니다.';
        if (mounted) {
          setError(message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [skillId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-slate-200">
        <p>문제를 불러오는 중입니다…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-slate-200">
        <button
          type="button"
          className="mb-4 text-sm text-slate-300 hover:text-white"
          onClick={() => navigate(-1)}
        >
          ← 돌아가기
        </button>
        <div className="rounded-xl border border-red-500/40 bg-red-900/30 p-4 text-red-100">
          {error ?? '데이터가 없습니다.'}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 text-slate-200">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Skill</p>
          <h1 className="text-2xl font-semibold text-white">{data.skill_id}</h1>
          <p className="text-sm text-slate-400">카테고리: {data.category}</p>
          <p className="text-sm text-slate-400">
            총 {data.total}문제 · 첫 문제부터 순서대로 풀어보세요
          </p>
        </div>
        <div className="flex gap-2">
          {firstProblemId ? (
            <Link
              to={`/problems/${firstProblemId}?skill=${encodeURIComponent(data.skill_id)}`}
              className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-sky-400"
            >
              연속 연습 시작
            </Link>
          ) : null}
          <button
            type="button"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white"
            onClick={() => navigate('/skills')}
          >
            스킬 트리로
          </button>
        </div>
      </header>

      <div className="mb-3 flex items-center justify-between text-sm text-slate-400">
        <span>문제 {data.total}개</span>
        {skillId ? (
          <Link
            className="text-sky-400 hover:text-sky-300"
            to={`/skills/${skillId}/problems?mode=list`}
          >
            목록 새로고침
          </Link>
        ) : null}
      </div>

      <div className="space-y-3">
        {data.items.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 shadow-lg shadow-slate-950/40"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">문제</p>
                <h2 className="text-lg font-semibold text-white">{item.question}</h2>
                {item.hint ? (
                  <p className="mt-1 text-sm text-slate-400">힌트: {item.hint}</p>
                ) : null}
              </div>
              <Link
                to={`/problems/${item.id}?skill=${encodeURIComponent(data.skill_id)}`}
                className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-sky-400"
              >
                풀기
              </Link>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>ID: {item.id}</span>
              <span>스킬: {item.skill_id}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkillProblemListPage;
