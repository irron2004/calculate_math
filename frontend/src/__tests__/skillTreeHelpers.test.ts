import { describe, expect, it } from 'vitest';

import type { CurriculumGraph } from '../types';
import { buildSkillTree } from '../components/skillTreeHelpers';

const sampleGraph: CurriculumGraph = {
  meta: {
    palette: {
      ratio: '#2563eb',
      difference: '#f97316'
    }
  },
  nodes: [
    {
      id: 'ALG-PR-S1',
      label: '비율·S1',
      concept: 'ALG-PR',
      step: 'S1',
      lens: ['ratio'],
      grade_band: 'E3-E5',
      micro_skills: ['배합표', '단위율(1의 값)'],
      mastery: 0.2
    },
    {
      id: 'ALG-PR-S2',
      label: '비례함수·S2',
      concept: 'ALG-PR',
      step: 'S2',
      lens: ['ratio'],
      grade_band: 'E4-E6',
      micro_skills: ['y=kx'],
      mastery: 0.1
    },
    {
      id: 'GEO-TRI-S1',
      label: '삼각형 합동·S1',
      concept: 'GEO-TRI',
      step: 'S1',
      lens: ['difference'],
      grade_band: 'E5-G1',
      micro_skills: ['합동 판별'],
      mastery: 0.6
    }
  ],
  edges: [
    {
      id: 'e1',
      source: 'ALG-PR-S1',
      target: 'ALG-PR-S2',
      type: 'transfer',
      lens: 'ratio',
      weight: 0.5
    }
  ]
};

describe('buildSkillTree', () => {
  it('groups curriculum nodes by concept and infers statuses', () => {
    const result = buildSkillTree(sampleGraph, ['ALG-PR-S1'], {
      conceptNames: {
        'ALG-PR': '비례'
      }
    });

    expect(result).toHaveLength(2);
    const algebraBranch = result.find((branch) => branch.conceptId === 'ALG-PR');
    expect(algebraBranch).toBeDefined();
    expect(algebraBranch?.label).toBe('비례');
    expect(algebraBranch?.color).toBe('#2563eb');
    expect(algebraBranch?.nodes).toHaveLength(2);

    const [s1, s2] = algebraBranch?.nodes ?? [];
    expect(s1.status).toBe('completed');
    expect(s2.status).toBe('available');
    expect(s2.prerequisites).toContain('비율 S1');
  });

  it('marks nodes without prerequisites as available when not completed', () => {
    const result = buildSkillTree(sampleGraph, []);
    const geoBranch = result.find((branch) => branch.conceptId === 'GEO-TRI');
    expect(geoBranch).toBeDefined();
    expect(geoBranch?.nodes[0].status).toBe('available');
  });
});

