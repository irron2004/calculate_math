import type { CurriculumConcept, LRCEvaluation } from '../../types';

export const conceptFixtures: CurriculumConcept[] = [
  {
    id: 'ALG-AP',
    name: '등차 수열 기초',
    lens: ['difference'],
    prerequisites: [],
    transfers: ['ALG-LIN'],
    summary: '등차 구조를 이해합니다.',
    stage_span: ['S1', 'S2', 'S3'],
    focus_keywords: ['시작값', '차이']
  },
  {
    id: 'RAT-PRO',
    name: '비율과 비례',
    lens: ['ratio'],
    prerequisites: ['ALG-AP'],
    transfers: ['RAT-INV'],
    summary: '비례 관계를 다룹니다.',
    stage_span: ['S1', 'S2', 'S3'],
    focus_keywords: ['단위율']
  },
  {
    id: 'GEO-LIN',
    name: '좌표와 직선',
    lens: ['scale', 'difference'],
    prerequisites: ['ALG-AP', 'RAT-PRO'],
    transfers: ['CAL-CHANGE'],
    summary: '기울기와 절편을 연결합니다.',
    stage_span: ['S1', 'S2', 'S3'],
    focus_keywords: ['기울기', '절편']
  }
];

export const reinforceEvaluation: LRCEvaluation = {
  passed: false,
  status: 'near-miss',
  recommendation: 'reinforce',
  metrics: {
    accuracy: { value: 0.88, threshold: 0.9, met: false },
    rt_percentile: { value: 0.7, threshold: 0.6, met: true },
    rubric: { value: 0.82, threshold: 0.75, met: true }
  },
  focus_concept: 'RAT-PRO',
  evaluated_at: new Date().toISOString()
};

export const remediateEvaluation: LRCEvaluation = {
  passed: false,
  status: 'retry',
  recommendation: 'remediate',
  metrics: {
    accuracy: { value: 0.6, threshold: 0.9, met: false },
    rt_percentile: { value: 0.4, threshold: 0.6, met: false },
    rubric: { value: 0.5, threshold: 0.75, met: false }
  },
  focus_concept: 'ALG-AP',
  evaluated_at: new Date().toISOString()
};
