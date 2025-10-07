import { describe, expect, it } from 'vitest';

import {
  gradeTokenToValue,
  overlaps,
  parseGradeBand
} from '../components/homePathMapHelpers';

describe('HomePathMap helpers', () => {
  it('converts grade tokens to sortable numeric values', () => {
    expect(gradeTokenToValue('E3')).toBe(3);
    expect(gradeTokenToValue('G1')).toBe(7);
    expect(gradeTokenToValue('G3')).toBe(9);
  });

  it('parses grade band ranges with sensible defaults', () => {
    expect(parseGradeBand('E3-E5')).toEqual([3, 5]);
    expect(parseGradeBand('G1-G2')).toEqual([7, 8]);
    expect(parseGradeBand('UNKNOWN')).toEqual([1, 12]);
  });

  it('detects overlap between grade ranges', () => {
    expect(overlaps([1, 4], [3, 6])).toBe(true);
    expect(overlaps([1, 2], [3, 4])).toBe(false);
  });
});
