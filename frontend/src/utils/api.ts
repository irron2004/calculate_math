import type {
  APISession,
  CurriculumConcept,
  CurriculumGraph,
  CurriculumHomeCopy,
  GeneratedItem,
  LRCEvaluation,
  PracticeSessionConfigPayload,
  ProblemAttemptResponse,
  ProblemDetailResponse,
  SkillProgressResponse,
  SkillTreeResponse,
  SkillProblemListResponse,
  TemplateSummary,
  UserProgressMetrics,
} from '../types';
import { STARTER_SKILL_TREE, SKILL_TREE_SEED_VERSION } from '../constants/skillTreeSeed';
import { buildSimpleSkillTree } from './simpleSkillTree';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

if (typeof window !== 'undefined' && !import.meta.env.VITE_API_BASE_URL) {
  console.warn(
    '[API] VITE_API_BASE_URL가 설정되지 않아 기본 경로 "/api"를 사용합니다. 배포 환경에서 백엔드 라우팅이 다르면 .env.production을 업데이트하세요.',
  );
}

// API 호출 유틸리티 함수
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
    ...options,
  });

  if (!response.ok) {
    let bodyPreview: string | undefined;
    try {
      const text = await response.clone().text();
      bodyPreview = text.trim().slice(0, 200);
    } catch (error) {
      bodyPreview = undefined;
    }
    console.error('[API] 호출 실패', {
      url,
      status: response.status,
      statusText: response.statusText,
      bodyPreview,
    });
    throw new Error(
      `API 호출 실패: ${response.status} ${response.statusText} @ ${url}${
        bodyPreview ? ` → ${bodyPreview}` : ''
      }`,
    );
  }

  return response.json();
}

const skillTreeMode = (import.meta.env.VITE_SKILL_TREE_MODE ?? 'seed').toLowerCase();
const useSeedSkillTree = skillTreeMode === 'seed';
const allowSeedFallback = useSeedSkillTree || skillTreeMode === 'auto-seed';

const seedSkillTree = buildSimpleSkillTree(STARTER_SKILL_TREE, {
  version: SKILL_TREE_SEED_VERSION,
});
const seedSkillTreePayload: SkillTreeResponse = {
  version: SKILL_TREE_SEED_VERSION,
  palette: seedSkillTree.palette,
  groups: seedSkillTree.groups,
  nodes: seedSkillTree.nodes,
  edges: seedSkillTree.edges,
  skills: STARTER_SKILL_TREE as unknown as SkillTreeResponse['skills'],
  progress: {
    user_id: null,
    updated_at: null,
    total_xp: 0,
    nodes: {},
    skills: {},
  },
  graph: seedSkillTree.graph,
  unlocked: seedSkillTree.unlockedMap,
  experiment: {
    name: 'seed_only',
    variant: 'tree',
    source: 'seed',
    request_id: null,
    rollout: null,
    bucket: null,
  },
};

// 세션 생성 (20문제 세트)
export async function createSession(
  token?: string,
  config?: PracticeSessionConfigPayload
): Promise<APISession> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const options: RequestInit = {
    method: 'POST',
    headers,
  };
  if (config && Object.keys(config).length) {
    options.body = JSON.stringify({ config });
  }
  return apiCall<APISession>('/v1/sessions', options);
}

export async function updateSkillProgress(
  courseStepId: string,
  payload?: {
    correct?: boolean;
    attempts?: number;
    userId?: string | null;
  }
): Promise<SkillProgressResponse> {
  return apiCall<SkillProgressResponse>('/v1/skills/progress', {
    method: 'POST',
    body: JSON.stringify({
      course_step_id: courseStepId,
      correct: payload?.correct ?? true,
      attempts: payload?.attempts ?? 1,
      user_id: payload?.userId ?? undefined,
    }),
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
  if (useSeedSkillTree) {
    console.info('[API] 스킬 트리를 시드 데이터로 로드합니다.');
    return seedSkillTreePayload;
  }
  try {
    return await apiCall<SkillTreeResponse>('/v1/skills/tree');
  } catch (error) {
    if (allowSeedFallback) {
      console.warn('[API] 스킬 트리 API 호출 실패 → 시드 데이터로 대체합니다.', error);
      return seedSkillTreePayload;
    }
    throw error;
  }
}

export async function fetchSkillProblems(
  skillId: string,
  options?: { limit?: number }
): Promise<SkillProblemListResponse> {
  const params = new URLSearchParams();
  if (options?.limit) {
    params.set('limit', String(options.limit));
  }
  const query = params.toString();
  return apiCall<SkillProblemListResponse>(
    `/v1/skills/${encodeURIComponent(skillId)}/problems${query ? `?${query}` : ''}`
  );
}

export async function fetchProblemDetail(
  problemId: string,
  options?: { revealAnswer?: boolean }
): Promise<ProblemDetailResponse> {
  const params = new URLSearchParams();
  if (options?.revealAnswer) {
    params.set('reveal_answer', 'true');
  }
  const query = params.toString();
  return apiCall<ProblemDetailResponse>(
    `/v1/problems/${encodeURIComponent(problemId)}${query ? `?${query}` : ''}`
  );
}
