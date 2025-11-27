import type { SkillTreeEdge, SkillTreeGraphTree, SkillTreeRequirement } from '../types';
import type { SkillTreeGraphNodeView } from '../components/SkillTreeGraph';
import rawData from '../data/skill_tree_course_steps_l5.json';

// Raw spec types (lightweight to match the JSON structure)
type RawNode = {
  id: string;
  type: 'course_step' | 'skill';
  label?: string;
  domain?: string;
  tier?: number;
  outcomes?: string[];
};

type RawEdge = {
  from: string;
  to: string;
  type: string;
};

type RawGraph = {
  version: string;
  nodes: RawNode[];
  edges: RawEdge[];
};

const palette: Record<string, string> = {
  '대수': '#2563eb',
  '도형과 측정': '#0ea5e9',
  '수와 연산': '#22c55e',
  fallback: '#94a3b8'
};

const parseTier = (node: RawNode): number => {
  if (typeof node.tier === 'number') {
    return Math.max(1, node.tier);
  }
  const match = node.id.match(/_(\d+)/);
  return match ? Math.max(1, Number(match[1])) : 1;
};

const detectLens = (node: RawNode): string[] => {
  if (node.domain) {
    return [node.domain];
  }
  const prefix = node.id.split('_')[0];
  return prefix ? [prefix] : [];
};

const makeRequirement = (source: SkillTreeGraphNodeView): SkillTreeRequirement => ({
  skill_id: source.id,
  label: source.label,
  domain: source.lens[0] ?? '요구 스킬',
  lens: source.lens,
  min_level: 1,
  current_level: 0,
  met: false
});

export type CourseSkillTreeGraph = {
  version: string;
  nodes: SkillTreeGraphNodeView[];
  edges: SkillTreeEdge[];
  trees: SkillTreeGraphTree[];
  palette: Record<string, string>;
};

export const buildCourseSkillTreeGraph = (): CourseSkillTreeGraph => {
  const raw = rawData as RawGraph;
  const baseTree: SkillTreeGraphTree = { id: 'course-l5', label: '레벨 5 코스 트리', order: 1 };

  const nodeMap = new Map<string, SkillTreeGraphNodeView>();

  raw.nodes.forEach((node) => {
    const lens = detectLens(node);
    const tier = parseTier(node);
    const label = node.label ?? node.id;

    const view: SkillTreeGraphNodeView = {
      id: node.id,
      tree: baseTree.id,
      tier,
      label,
      lens,
      boss: node.type === 'course_step' ? false : undefined,
      grid: { row: 0, col: 0 },
      xp: { per_try: 0, per_correct: 0 },
      requires: [],
      teaches: [],
      state: { value: 'unlocked', completed: false, available: true, unlocked: true },
      resolvedState: 'unlocked',
      progress: null,
    };

    nodeMap.set(node.id, {
      ...view,
      nodeType: node.type,
      outcomes: node.outcomes ?? [],
    });
  });

  const edges: SkillTreeEdge[] = raw.edges.map((edge) => ({ from: edge.from, to: edge.to }));

  // Enrich target nodes with requirement metadata for UI chips
  raw.edges
    .filter((edge) => edge.type === 'requires')
    .forEach((edge) => {
      const source = nodeMap.get(edge.from);
      const target = nodeMap.get(edge.to);
      if (!source || !target) {
        return;
      }
      target.requires = [...(target.requires ?? []), makeRequirement(source)];
    });

  const nodes = Array.from(nodeMap.values());

  return {
    version: raw.version,
    nodes,
    edges,
    trees: [baseTree],
    palette
  };
};
