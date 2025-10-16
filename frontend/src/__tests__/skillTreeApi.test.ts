import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SkillTreeResponse } from '../types';

describe('fetchSkillTree API helper', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    const unstubAllGlobals = (vi as unknown as { unstubAllGlobals?: () => void }).unstubAllGlobals;
    if (typeof unstubAllGlobals === 'function') {
      unstubAllGlobals();
    } else {
      delete (globalThis as { fetch?: unknown }).fetch;
    }
  });

  it('requests the skill tree payload with credentials and returns parsed data', async () => {
    const sampleResponse: SkillTreeResponse = {
      version: '2024.10',
      palette: { arithmetic: '#000000' },
      groups: [],
      nodes: [],
      edges: [],
      skills: [],
      progress: {
        user_id: null,
        updated_at: null,
        total_xp: 0,
        nodes: {},
        skills: {},
      },
      graph: null,
      unlocked: {},
      experiment: {
        name: 'skill_tree_layout',
        variant: 'tree',
        source: 'assignment',
      },
    };

    const json = vi.fn().mockResolvedValue(sampleResponse);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json,
      clone: () => ({ text: async () => '' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchSkillTree, API_BASE_URL } = await import('../utils/api');

    const result = await fetchSkillTree();

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/v1/skills/tree`,
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );
    expect(json).toHaveBeenCalledTimes(1);
    expect(result).toEqual(sampleResponse);
  });

  it('throws a descriptive error when the backend response is unsuccessful', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      clone: () => ({ text: async () => 'backend unavailable' }),
      json: async () => {
        throw new Error('Should not be called');
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchSkillTree, API_BASE_URL } = await import('../utils/api');

    await expect(fetchSkillTree()).rejects.toThrow(
      `API 호출 실패: 502 Bad Gateway @ ${API_BASE_URL}/v1/skills/tree → backend unavailable`
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/v1/skills/tree`,
      expect.objectContaining({ credentials: 'include' })
    );
  });
});

