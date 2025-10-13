export type User = {
  id: string;
  username: string;
  role: 'student' | 'parent' | 'teacher' | 'guest';
  name: string;
  grade?: number;
  parentId?: string;
  children?: string[];
};

export type AttemptMetrics = {
  total: number;
  correct: number;
  accuracy_rate: number;
  streak_days: number;
  last_attempt_at?: string | null;
};

export type ProgressBreakdown = {
  total_xp: number;
  unlocked_nodes: number;
  completed_nodes: number;
  mastered_skills: number;
};

export type UserProgressMetrics = {
  user_id: string;
  attempts: AttemptMetrics;
  progress: ProgressBreakdown;
  skill_levels: Record<string, number>;
};

export type APIProblem = {
  id: number;
  left: number;
  right: number;
  answer: number;
  options: number[];
};

export type CurriculumConcept = {
  id: string;
  name: string;
  lens: string[];
  prerequisites: string[];
  transfers: string[];
  summary: string;
  stage_span: string[];
  focus_keywords: string[];
};

export type TemplateSummary = {
  id: string;
  concept: string;
  step: string;
  lens: string[];
  representation: string;
  context_pack: string[];
  rubric_keywords: string[];
  parameter_names: string[];
};

export type CurriculumGraphNode = {
  id: string;
  label: string;
  concept: string;
  step: 'S1' | 'S2' | 'S3';
  lens: string[];
  grade_band: string;
  micro_skills: string[];
  mastery: number;
  lrc?: {
    acc: number;
    rt_pct: number;
    expl: number;
    passed: boolean;
  } | null;
};

export type CurriculumGraphEdge = {
  id: string;
  source: string;
  target: string;
  type: 'prereq' | 'transfer';
  lens: string;
  weight: number;
  evidence?: {
    n?: number;
    uplift?: number;
    conf?: number;
  };
};

export type CurriculumGraphMeta = {
  palette: Record<string, string>;
  user?: {
    id: string;
    mastery_source?: string;
  };
};

export type CurriculumGraph = {
  meta: CurriculumGraphMeta;
  nodes: CurriculumGraphNode[];
  edges: CurriculumGraphEdge[];
};

export type CourseSessionConfig = {
  concept: string | null;
  step: 'S1' | 'S2' | 'S3' | null;
  problem_count: number | null;
  generator: string | null;
  parameters: Record<string, unknown>;
};

export type SkillTreeRequirement = {
  skill_id: string;
  label: string;
  domain: string;
  lens: string[];
  min_level: number;
  current_level: number;
  met: boolean;
};

export type SkillTreeTeaching = {
  skill_id: string;
  label: string;
  domain: string;
  lens: string[];
  delta_level: number;
};

export type SkillTreeNodeState = {
  value: 'locked' | 'available' | 'completed';
  completed: boolean;
  available: boolean;
  unlocked: boolean;
};

export type SkillTreeNode = {
  id: string;
  label: string;
  course: string;
  group: string;
  tier: number;
  lens: string[];
  primary_color?: string | null;
  session: CourseSessionConfig | null;
  requires: SkillTreeRequirement[];
  teaches: SkillTreeTeaching[];
  xp: {
    per_try: number;
    per_correct: number;
  };
  lrc_min: Record<string, number>;
  misconceptions: string[];
  state: SkillTreeNodeState;
  progress: SkillNodeProgress;
};

export type SkillTreeGroup = {
  id: string;
  label: string;
  order: number;
  course_ids: string[];
};

export type SkillTreeEdge = {
  from: string;
  to: string;
};

export type SkillSummary = {
  id: string;
  label: string;
  domain: string;
  lens: string[];
  levels: number;
  level: number;
  xp: {
    per_try: number;
    per_correct: number;
    earned: number;
  };
};

export type SkillTreeExperiment = {
  name: string;
  variant: 'tree' | 'list';
  source: string;
  request_id?: string | null;
  rollout?: number | null;
  bucket?: number | string | null;
};

export type SkillNodeProgress = {
  xp_earned: number;
  xp_required?: number | null;
  level?: number | null;
  unlocked: boolean;
  completed: boolean;
  lrc_status?: string | null;
  lrc_metrics?: Record<string, number>;
  attempts?: number | null;
};

export type AtomicSkillProgress = {
  level: number;
  xp: number;
};

export type SkillTreeProgress = {
  user_id?: string | null;
  updated_at?: string | null;
  total_xp: number;
  nodes: Record<string, SkillNodeProgress>;
  skills: Record<string, AtomicSkillProgress>;
};

export type SkillTreeResponse = {
  version: string | null;
  palette: Record<string, string>;
  groups: SkillTreeGroup[];
  nodes: SkillTreeNode[];
  edges: SkillTreeEdge[];
  skills: SkillSummary[];
  progress: SkillTreeProgress;
  experiment?: SkillTreeExperiment;
  error?: {
    message: string;
    kind: string;
  };
};

export type CurriculumHomeCopy = {
  version: string;
  nodes: Record<
    string,
    {
      label: string;
      tooltip: string;
    }
  >;
};

export type GeneratedItem = {
  id: string;
  template_id: string;
  concept: string;
  step: string;
  prompt: string;
  explanation: string;
  answer: number;
  options: number[];
  context: string;
  lens: string[];
  representation: string;
  rubric_keywords: string[];
  variables: Record<string, unknown>;
  difficulty_est?: number | null;
  tags?: Record<string, unknown>;
};

export type LRCMetric = {
  value: number;
  threshold: number;
  met: boolean;
};

export type LRCStatus = 'gold' | 'silver' | 'pending' | 'retry';

export type LRCRecommendation = 'promote' | 'reinforce' | 'remediate' | string;

export type LRCEvaluation = {
  passed: boolean;
  status: LRCStatus;
  recommendation: LRCRecommendation;
  metrics: Record<string, LRCMetric>;
  focus_concept?: string | null;
  evaluated_at?: string | null;
};

export type APISession = {
  session_id: number;
  problems: APIProblem[];
};

export type ProblemAttemptResponse = {
  attempt_id: number;
  problem_id: string;
  category: string;
  submitted_answer: number;
  correct_answer: number;
  is_correct: boolean;
  attempted_at: string;
};

export type MathProblem = {
  id: string;
  question: string;
  answer: number;
  options?: number[];
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'addition' | 'subtraction' | 'multiplication' | 'division';
  grade: number;
};

export type GameSession = {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  problems: MathProblem[];
  answers: { problemId: string; answer: number; correct: boolean; timeSpent: number }[];
  score: number;
  totalProblems: number;
  correctAnswers: number;
};

export type StudentProgress = {
  userId: string;
  totalSessions: number;
  totalProblems: number;
  correctAnswers: number;
  averageScore: number;
  timeSpent: number;
  lastPlayed: Date;
  grade: number;
};

export type ParentNotification = {
  id: string;
  parentId: string;
  childId: string;
  type: 'session_complete' | 'achievement' | 'reminder';
  message: string;
  timestamp: Date;
  read: boolean;
};

export type TeacherReport = {
  studentId: string;
  studentName: string;
  grade: number;
  progress: StudentProgress;
  recentSessions: GameSession[];
}; 
