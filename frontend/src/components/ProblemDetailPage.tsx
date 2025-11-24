import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import type { ProblemDetailResponse } from '../types';
import { fetchProblemDetail, submitAnswer } from '../utils/api';

const ProblemDetailPage = () => {
  const { problemId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<ProblemDetailResponse | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const skillId = useMemo(() => searchParams.get('skill'), [searchParams]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!problemId) {
        setError('problemId가 없습니다.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await fetchProblemDetail(problemId);
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
  }, [problemId]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!problemId) {
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const numeric = Number(answer);
      if (Number.isNaN(numeric)) {
        setResult('정답은 숫자로 입력해주세요.');
        return;
      }
      const res = await submitAnswer(problemId, numeric);
      setResult(res.is_correct ? '정답입니다! 🎉' : `오답입니다. 정답: ${res.correct_answer}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '제출 중 오류가 발생했습니다.';
      setResult(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-slate-200">
        <p>문제를 불러오는 중입니다…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-slate-200">
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
    <div className="mx-auto max-w-3xl space-y-4 p-6 text-slate-200">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Problem</p>
          <h1 className="text-2xl font-semibold text-white">{data.question}</h1>
          <p className="text-sm text-slate-400">
            카테고리: {data.category}
            {skillId ? ` · 스킬 ${skillId}` : null}
          </p>
        </div>
        <div className="flex gap-2">
          {skillId ? (
            <button
              type="button"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white"
              onClick={() => navigate(`/skills/${skillId}/problems`)}
            >
              문제 목록
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white"
            onClick={() => navigate('/skills')}
          >
            스킬 트리
          </button>
        </div>
      </header>

      {data.hint ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
          힌트: {data.hint}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm text-slate-300">
          정답 입력
          <input
            type="number"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-white focus:border-sky-500 focus:outline-none"
            placeholder="정답을 숫자로 입력하세요"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-900/40 transition hover:-translate-y-0.5 hover:bg-sky-400 disabled:opacity-60"
        >
          {submitting ? '제출 중…' : '제출하기'}
        </button>
      </form>

      {result ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-200">
          {result}
        </div>
      ) : null}
    </div>
  );
};

export default ProblemDetailPage;
