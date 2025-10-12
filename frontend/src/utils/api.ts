import type {
  APISession,
  CurriculumConcept,
  CurriculumGraph,
  CurriculumHomeCopy,
  GeneratedItem,
  LRCEvaluation,
  ProblemAttemptResponse,
  SkillTreeResponse,
  UserProgressMetrics,
  TemplateSummary
} from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/math-api/api';

// API 호출 유틸리티 함수
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API 호출 실패: ${response.status}`);
  }

  return response.json();
}

// 세션 생성 (20문제 세트)
export async function createSession(token?: string): Promise<APISession> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return apiCall<APISession>('/v1/sessions', {
    method: 'POST',
    headers,
  });
}

// 문제 답안 제출
export async function submitAnswer(
  problemId: string | number,
  chosenAnswer: number
): Promise<ProblemAttemptResponse> {
  return apiCall<ProblemAttemptResponse>(`/problems/${problemId}/attempts`, {
    method: 'POST',
    body: JSON.stringify({
      answer: chosenAnswer,
    }),
  });
}

// 일일 통계 조회
export async function getDailyStats(days: number = 30) {
  return apiCall(`/v1/stats/daily?days=${days}`, {
    method: 'GET',
  });
}

export async function fetchUserMetrics(token?: string): Promise<UserProgressMetrics> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return apiCall<UserProgressMetrics>('/v1/metrics/me', {
    method: 'GET',
    headers,
  });
}

export async function fetchConcepts(step?: string): Promise<CurriculumConcept[]> {
  const query = step ? `?step=${encodeURIComponent(step)}` : '';
  return apiCall<CurriculumConcept[]>(`/v1/concepts${query}`);
}

export async function fetchTemplates(
  concept?: string,
  step?: string
): Promise<TemplateSummary[]> {
  const params = new URLSearchParams();
  if (concept) {
    params.append('concept', concept);
  }
  if (step) {
    params.append('step', step);
  }
  const query = params.toString();
  return apiCall<TemplateSummary[]>(`/v1/templates${query ? `?${query}` : ''}`);
}

export async function generateTemplateInstance(
  templateId: string,
  payload?: { seed?: number; context?: string }
): Promise<GeneratedItem> {
  return apiCall<GeneratedItem>(`/v1/templates/${templateId}/generate`, {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  });
}

export async function fetchCurriculumGraph(): Promise<CurriculumGraph> {
  return apiCall<CurriculumGraph>('/v1/graph/current');
}

export async function fetchCurriculumHomeCopy(): Promise<CurriculumHomeCopy> {
  return apiCall<CurriculumHomeCopy>('/v1/graph/home-copy');
}

export async function fetchUserCurriculumGraph(userId: string): Promise<CurriculumGraph> {
  return apiCall<CurriculumGraph>(`/v1/graph/user/${encodeURIComponent(userId)}`);
}

export async function evaluateLRC(payload: {
  accuracy: number;
  rt_percentile: number;
  rubric: number;
  user_id?: string;
  focus_concept?: string;
}): Promise<LRCEvaluation> {
  const body: Record<string, unknown> = {
    accuracy: payload.accuracy,
    rt_percentile: payload.rt_percentile,
    rubric: payload.rubric,
  };
  if (payload.user_id) {
    body.user_id = payload.user_id;
  }
  if (payload.focus_concept) {
    body.focus_concept = payload.focus_concept;
  }

  return apiCall<LRCEvaluation>('/v1/lrc/evaluate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchLatestLRC(userId: string): Promise<LRCEvaluation | null> {
  const response = await fetch(`${API_BASE_URL}/v1/lrc/last?user_id=${encodeURIComponent(userId)}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`LRC 조회 실패: ${response.status}`);
  }
  return response.json();
}

export async function fetchSkillTree(): Promise<SkillTreeResponse> {
  return apiCall<SkillTreeResponse>('/v1/skills/tree');
}
