import { describe, expect, it } from 'vitest';

import {
  DEFAULT_STEP_ORDER,
  limitPracticeToFocus,
  reorderConcepts,
  resolveFocusConcept,
  stepsForConcept
} from '../utils/curriculum';
import {
  conceptFixtures,
  reinforceEvaluation,
  remediateEvaluation
} from '../tests/fixtures/curriculum';

describe('curriculum utilities', () => {
  it('reorders concepts prioritising focus and preferred list', () => {
    const result = reorderConcepts(conceptFixtures, ['RAT-PRO', 'GEO-LIN'], 'GEO-LIN');
    expect(result[0].id).toBe('GEO-LIN');
    expect(result[1].id).toBe('RAT-PRO');
    expect(result[2].id).toBe('ALG-AP');
  });

  it('falls back to preferred order when focus concept missing', () => {
    const result = reorderConcepts(conceptFixtures, ['RAT-PRO', 'GEO-LIN'], 'UNKNOWN');
    expect(result[0].id).toBe('RAT-PRO');
    expect(result[1].id).toBe('GEO-LIN');
    expect(result[2].id).toBe('ALG-AP');
  });

  it('returns amplified steps for reinforce recommendation on focus concept', () => {
    const steps = stepsForConcept(reinforceEvaluation.recommendation, true, DEFAULT_STEP_ORDER);
    expect(steps).toEqual(['S1', 'S2', 'S2']);
  });

  it('returns remedial steps for remediate recommendation', () => {
    const steps = stepsForConcept(remediateEvaluation.recommendation, true, DEFAULT_STEP_ORDER);
    expect(steps).toEqual(['S1', 'S1', 'S1']);
  });

  it('keeps default step order for non-focus concepts', () => {
    const steps = stepsForConcept(reinforceEvaluation.recommendation, false, DEFAULT_STEP_ORDER);
    expect(steps).toEqual(Array.from(DEFAULT_STEP_ORDER));
  });

  it('limits practice to focus concept only when recommendation is remediate', () => {
    expect(limitPracticeToFocus(reinforceEvaluation.recommendation)).toBe(false);
    expect(limitPracticeToFocus(remediateEvaluation.recommendation)).toBe(true);
  });

  it('resolves focus concept from evaluation, falling back to provided value', () => {
    expect(resolveFocusConcept(reinforceEvaluation, null)).toBe('RAT-PRO');
    expect(resolveFocusConcept(null, 'ALG-AP')).toBe('ALG-AP');
  });
});
