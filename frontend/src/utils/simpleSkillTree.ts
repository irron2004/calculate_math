import type {
  SkillTreeEdge,
  SkillTreeGraphSpec,
  SkillTreeGroup,
  SkillTreeNode,
} from '../types';

export type SimpleSkillSpec = {
  id: string;
  name: string;
  prereq: string[];
};

const DEFAULT_TREE_ID = 'simple-skill-tree';

const normalisePrereq = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
};

export const extractSimpleSkillList = (payload: unknown): SimpleSkillSpec[] | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const candidate = (payload as { skills?: unknown }).skills;
  if (!Array.isArray(candidate) || candidate.length === 0) {
    return null;
  }

  const parsed: SimpleSkillSpec[] = [];
  for (const entry of candidate) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const { id, name, prereq } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || typeof name !== 'string') {
      return null;
    }
    parsed.push({
      id,
      name,
      prereq: normalisePrereq(prereq),
    });
  }

  if (!parsed.length) {
    return null;
  }

  return parsed;
};

export const buildSimpleSkillTree = (
  skills: SimpleSkillSpec[],
  options?: { version?: string },
): {
  nodes: SkillTreeNode[];
  edges: SkillTreeEdge[];
  groups: SkillTreeGroup[];
  graph: SkillTreeGraphSpec;
  unlockedMap: Record<string, boolean>;
  palette: Record<string, string>;
} => {
  const version = options?.version ?? 'simple-skill-list.v1';
  const nameLookup = new Map<string, string>();
  skills.forEach((skill) => nameLookup.set(skill.id, skill.name));

  const prereqLookup = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  skills.forEach((skill) => {
    const prereqs = normalisePrereq(skill.prereq);
    prereqLookup.set(skill.id, prereqs);
    prereqs.forEach((req) => {
      if (!dependents.has(req)) {
        dependents.set(req, []);
      }
      dependents.get(req)!.push(skill.id);
    });
  });

  const indegree = new Map<string, number>();
  skills.forEach((skill) => indegree.set(skill.id, prereqLookup.get(skill.id)?.length ?? 0));

  const tiers = new Map<string, number>();
  const queue: string[] = skills
    .filter((skill) => (indegree.get(skill.id) ?? 0) === 0)
    .map((skill) => skill.id);

  while (queue.length) {
    const current = queue.shift() as string;
    const currentTier = tiers.get(current) ?? 1;

    (dependents.get(current) ?? []).forEach((child) => {
      const nextTier = currentTier + 1;
      const existingTier = tiers.get(child) ?? 1;
      if (nextTier > existingTier) {
        tiers.set(child, nextTier);
      }

      const remaining = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, remaining);
      if (remaining <= 0) {
        queue.push(child);
      }
    });
  }

  let maxTier = 1;
  skills.forEach((skill) => {
    if (!tiers.has(skill.id)) {
      tiers.set(skill.id, 1);
    }
    maxTier = Math.max(maxTier, tiers.get(skill.id) ?? 1);
  });

  const edges: SkillTreeEdge[] = [];
  prereqLookup.forEach((prereqs, skillId) => {
    prereqs.forEach((reqId) => {
      if (nameLookup.has(reqId)) {
        edges.push({ from: reqId, to: skillId });
      }
    });
  });

  const unlockedMap: Record<string, boolean> = {};
  const tierColumnCounter = new Map<number, number>();
  const gridLookup = new Map<string, { row: number; col: number }>();

  const nodes: SkillTreeNode[] = skills
    .slice()
    .sort((a, b) => (tiers.get(a.id) ?? 1) - (tiers.get(b.id) ?? 1) || a.name.localeCompare(b.name, 'ko'))
    .map((skill) => {
      const prereqs = prereqLookup.get(skill.id) ?? [];
      const tier = tiers.get(skill.id) ?? maxTier;
      const col = (tierColumnCounter.get(tier) ?? 0) + 1;
      tierColumnCounter.set(tier, col);
      gridLookup.set(skill.id, { row: tier, col });
      const isUnlocked = prereqs.length === 0;
      unlockedMap[skill.id] = isUnlocked;

      return {
        id: skill.id,
        label: skill.name,
        course: DEFAULT_TREE_ID,
        group: DEFAULT_TREE_ID,
        tier,
        lens: [],
        primary_color: undefined,
        requires: prereqs.map((reqId) => ({
          skill_id: reqId,
          label: nameLookup.get(reqId) ?? reqId,
          domain: '',
          lens: [],
          min_level: 1,
          current_level: 0,
          met: false,
        })),
        teaches: [],
        xp: { per_try: 0, per_correct: 0 },
        lrc_min: {},
        misconceptions: [],
        state: {
          value: isUnlocked ? 'available' : 'locked',
          completed: false,
          available: isUnlocked,
          unlocked: isUnlocked,
        },
        session: null,
        progress: {
          xp_earned: 0,
          unlocked: isUnlocked,
          completed: false,
        },
      };
    });

  const graph: SkillTreeGraphSpec = {
    version,
    trees: [{ id: DEFAULT_TREE_ID, label: '학습 스킬 트리', order: 1 }],
    nodes: nodes.map((node) => ({
      id: node.id,
      tree: node.group,
      tier: node.tier,
      label: node.label,
      lens: node.lens,
      requires: (node.requires ?? []).map((req) => ({
        skill_id: req.skill_id,
        min_level: req.min_level ?? 1,
      })),
      xp: node.xp,
      boss: false,
      grid: {
        row: gridLookup.get(node.id)?.row ?? node.tier,
        col: gridLookup.get(node.id)?.col ?? 1,
      },
    })),
    edges,
    meta: { simple_skill_list: true },
  };

  const groups: SkillTreeGroup[] = [
    {
      id: DEFAULT_TREE_ID,
      label: '수학 로드맵',
      order: 1,
      course_ids: [],
    },
  ];

  const palette = {
    core: '#38bdf8',
  };

  return {
    nodes,
    edges,
    groups,
    graph,
    unlockedMap,
    palette,
  };
};
