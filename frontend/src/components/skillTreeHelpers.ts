import type {
  CurriculumGraph,
  CurriculumGraphEdge,
  CurriculumGraphNode
} from '../types';

export type SkillTreeNodeStatus = 'completed' | 'available' | 'locked';

export type SkillTreeNode = {
  id: string;
  label: string;
  step: string;
  mastery: number;
  microSkills: string[];
  status: SkillTreeNodeStatus;
  prerequisites: string[];
};

export type SkillTreeBranch = {
  conceptId: string;
  label: string;
  lens: string[];
  color: string | null;
  nodes: SkillTreeNode[];
};

const STEP_SEQUENCE = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];

const stepPriority = (step: string): number => {
  const index = STEP_SEQUENCE.indexOf(step);
  return index === -1 ? STEP_SEQUENCE.length : index;
};

const NORMALISED_EDGE_TYPES: ReadonlySet<CurriculumGraphEdge['type']> = new Set([
  'transfer',
  'prereq'
]);

const normaliseLabel = (label: string): string => {
  const [prefix] = label.split('·');
  return prefix?.trim() || label;
};

const dedupe = <T,>(items: Iterable<T>): T[] => {
  return Array.from(new Set(items));
};

export type BuildSkillTreeOptions = {
  conceptNames?: Record<string, string>;
};

export const buildSkillTree = (
  graph: CurriculumGraph,
  completedNodes: string[],
  options: BuildSkillTreeOptions = {}
): SkillTreeBranch[] => {
  const completedSet = new Set(completedNodes);
  const palette = graph.meta?.palette ?? {};
  const conceptNames = options.conceptNames ?? {};

  const nodeById = new Map<string, CurriculumGraphNode>();
  graph.nodes.forEach((node) => nodeById.set(node.id, node));

  const prerequisites = new Map<string, string[]>();
  graph.edges
    .filter((edge) => NORMALISED_EDGE_TYPES.has(edge.type))
    .forEach((edge) => {
      const current = prerequisites.get(edge.target) ?? [];
      current.push(edge.source);
      prerequisites.set(edge.target, current);
    });

  const branchAccumulator = new Map<
    string,
    {
      conceptId: string;
      lens: string[];
      rawNodes: CurriculumGraphNode[];
    }
  >();

  graph.nodes.forEach((node) => {
    const existing = branchAccumulator.get(node.concept);
    if (existing) {
      existing.rawNodes.push(node);
      existing.lens.push(...node.lens);
      return;
    }
    branchAccumulator.set(node.concept, {
      conceptId: node.concept,
      lens: [...node.lens],
      rawNodes: [node]
    });
  });

  const branches: SkillTreeBranch[] = [];

  branchAccumulator.forEach((entry) => {
    const { conceptId, rawNodes } = entry;
    const primaryLens = dedupe(entry.lens);
    const lensKey = primaryLens[0] ?? undefined;
    const branchColor = lensKey ? palette[lensKey] ?? null : null;

    const branchLabel =
      conceptNames[conceptId] ??
      (rawNodes.length ? normaliseLabel(rawNodes[0].label) : conceptId);

    const nodes: SkillTreeNode[] = rawNodes
      .map((node) => {
        const prereqIds = prerequisites.get(node.id) ?? [];
        const completed = completedSet.has(node.id);
        const allPrereqsMet =
          prereqIds.length === 0 || prereqIds.every((id) => completedSet.has(id));
        const status: SkillTreeNodeStatus = completed
          ? 'completed'
          : allPrereqsMet
          ? 'available'
          : 'locked';

        const prerequisiteLabels = prereqIds
          .map((id) => {
            const source = nodeById.get(id);
            return source ? `${normaliseLabel(source.label)} ${source.step}` : id;
          })
          .sort();

        return {
          id: node.id,
          label: normaliseLabel(node.label),
          step: node.step,
          mastery: node.mastery ?? 0,
          microSkills: node.micro_skills ?? [],
          status,
          prerequisites: prerequisiteLabels
        };
      })
      .sort((a, b) => {
        const stepDiff = stepPriority(a.step) - stepPriority(b.step);
        if (stepDiff !== 0) {
          return stepDiff;
        }
        return a.label.localeCompare(b.label, 'ko');
      });

    branches.push({
      conceptId,
      label: branchLabel,
      lens: primaryLens,
      color: branchColor,
      nodes
    });
  });

  return branches.sort((a, b) => a.label.localeCompare(b.label, 'ko'));
};

