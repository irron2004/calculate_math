import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, afterEach, vi } from 'vitest';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

describe('AuthContext', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores user and token when login succeeds', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        user_id: 1,
        nickname: 'tester',
        role: 'student',
        message: '로그인 성공',
        session_token: 'token-123',
        expires_at: Date.now() / 1000 + 3600
      })
    } as Response;
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>
    });

    await act(async () => {
      const outcome = await result.current.login('tester', 'secret');
      expect(outcome.success).toBe(true);
      expect(outcome.user?.username).toBe('tester');
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.current.user?.username).toBe('tester');
    expect(result.current.token).toBe('token-123');
    expect(result.current.error).toBeNull();
  });

  it('exposes error message when login fails', async () => {
    const mockResponse = {
      ok: false,
      json: async () => ({
        detail: { message: '잘못된 비밀번호입니다.' }
      })
    } as Response;
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>
    });

    await act(async () => {
      const outcome = await result.current.login('tester', 'wrong');
      expect(outcome.success).toBe(false);
      expect(outcome.error).toBe('잘못된 비밀번호입니다.');
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.error).toBe('잘못된 비밀번호입니다.');
  });
});
