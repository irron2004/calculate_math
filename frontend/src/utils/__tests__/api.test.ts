import { afterEach, describe, expect, it, vi } from 'vitest';

describe('fetchSkillTree (seed mode)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
    vi.resetModules();
  });

  it('returns the starter skill tree without hitting the network by default', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;
    vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const { SKILL_TREE_SEED_VERSION } = await import('../../constants/skillTreeSeed');
    const { fetchSkillTree } = await import('../api');
    const payload = await fetchSkillTree();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(payload.version).toBe(SKILL_TREE_SEED_VERSION);
    expect(Array.isArray((payload as any).skills)).toBe(true);
    expect((payload as any).skills).not.toHaveLength(0);
    expect(payload.graph?.nodes?.length ?? 0).toBeGreaterThan(0);
  });
});
