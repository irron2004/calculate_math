import type { APIProblemResponse, APISession } from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/math-api/api';

// API 호출 유틸리티 함수
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API 호출 실패: ${response.status}`);
  }

  return response.json();
}

// 세션 생성 (20문제 세트)
export async function createSession(): Promise<APISession> {
  return apiCall<APISession>('/v1/sessions', {
    method: 'POST',
  });
}

// 문제 답안 제출
export async function submitAnswer(
  problemId: number, 
  chosenAnswer: number, 
  attemptNo: number = 1
): Promise<APIProblemResponse> {
  return apiCall<APIProblemResponse>(`/v1/problems/${problemId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      chosen_answer: chosenAnswer,
      attempt_no: attemptNo,
    }),
  });
}

// 일일 통계 조회
export async function getDailyStats(days: number = 30) {
  return apiCall(`/v1/stats/daily?days=${days}`, {
    method: 'GET',
  });
} 
