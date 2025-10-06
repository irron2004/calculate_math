import type { CurriculumConcept, LRCEvaluation } from '../types';

export const DEFAULT_STEP_ORDER: ReadonlyArray<'S1' | 'S2' | 'S3'> = ['S1', 'S2', 'S3'];

export type LRCRecommendation = 'promote' | 'reinforce' | 'remediate' | string;

export function reorderConcepts(
  concepts: CurriculumConcept[],
  preferred: string[],
  focusConceptId?: string | null
): CurriculumConcept[] {
  const selection: CurriculumConcept[] = [];
  const seen = new Set<string>();

  if (focusConceptId) {
    const focus = concepts.find((concept) => concept.id === focusConceptId);
    if (focus) {
      selection.push(focus);
      seen.add(focus.id);
    }
  }

  for (const candidate of preferred) {
    if (seen.has(candidate)) {
      continue;
    }
    const concept = concepts.find((item) => item.id === candidate);
    if (concept) {
      selection.push(concept);
      seen.add(concept.id);
    }
  }

  for (const concept of concepts) {
    if (!seen.has(concept.id)) {
      selection.push(concept);
      seen.add(concept.id);
    }
  }

  return selection;
}

export function stepsForConcept(
  recommendation: LRCRecommendation | undefined,
  isFocus: boolean,
  stepOrder: ReadonlyArray<string> = DEFAULT_STEP_ORDER
): string[] {
  if (!isFocus) {
    return Array.from(stepOrder);
  }
  switch (recommendation) {
    case 'reinforce':
      return ['S1', 'S2', 'S2'];
    case 'remediate':
      return ['S1', 'S1', 'S1'];
    default:
      return Array.from(stepOrder);
  }
}

export function limitPracticeToFocus(recommendation: LRCRecommendation | undefined): boolean {
  return recommendation === 'remediate';
}

export function resolveFocusConcept(latest: LRCEvaluation | null | undefined, fallback: string | null): string | null {
  if (latest?.focus_concept) {
    return latest.focus_concept;
  }
  return fallback ?? null;
}
