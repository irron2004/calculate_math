import { describe, expect, it } from 'vitest';

import { countKeywordMatches } from '../utils/text';

describe('text utilities', () => {
  it('matches keywords ignoring case and spacing', () => {
    const matches = countKeywordMatches('기울기는 한 번에 늘어나는 값, 공차와 같아요!', ['기울기', '공차']);
    expect(matches).toBe(2);
  });

  it('counts each keyword once even when repeated', () => {
    const matches = countKeywordMatches('공차는 일정하고 공차를 유지합니다.', ['공차', '공차']);
    expect(matches).toBe(1);
  });

  it('returns zero when text does not contain keywords', () => {
    const matches = countKeywordMatches('높이는 일정하게 증가합니다.', ['기울기']);
    expect(matches).toBe(0);
  });

  it('normalises unicode and punctuation boundaries', () => {
    const matches = countKeywordMatches('a1+d(n-1) 공식을 썼어요.', ['A1 + D (n-1)']);
    expect(matches).toBe(1);
  });
});
