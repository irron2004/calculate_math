type ConceptStep = {
  concept: string;
  step: 'S1' | 'S2' | 'S3';
};

export const skillToConceptStep: Record<string, ConceptStep> = {
  num_pv_s1: { concept: 'ALG-AP', step: 'S1' },
  num_pv_s2: { concept: 'ALG-AP', step: 'S1' },
  num_pv_s3: { concept: 'ALG-AP', step: 'S2' },
  add_1d: { concept: 'ALG-AP', step: 'S1' },
  add_2d_nc: { concept: 'ALG-AP', step: 'S2' },
  add_2d_c: { concept: 'ALG-AP', step: 'S3' },
  sub_1d: { concept: 'ALG-AP', step: 'S1' },
  sub_2d_b: { concept: 'ALG-AP', step: 'S2' },
  mul_table: { concept: 'RAT-PRO', step: 'S1' },
  div_table: { concept: 'RAT-PRO', step: 'S1' },
  ratio_s1: { concept: 'RAT-PRO', step: 'S1' },
  fraction_s1: { concept: 'RAT-PRO', step: 'S2' },
  ap_s1: { concept: 'ALG-AP', step: 'S2' },
  ap_s2: { concept: 'ALG-AP', step: 'S3' },
  linear_s1: { concept: 'GEO-LIN', step: 'S1' },
  linear_s2: { concept: 'GEO-LIN', step: 'S2' },
  avg_rate_s1: { concept: 'GEO-LIN', step: 'S3' },
  accum_s1: { concept: 'GEO-LIN', step: 'S2' },
};

export function resolveConceptStep(skillId: string): ConceptStep | null {
  return skillToConceptStep[skillId] ?? null;
}
