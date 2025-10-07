export type User = {
  id: string;
  username: string;
  role: 'student' | 'parent' | 'teacher' | 'guest';
  name: string;
  grade?: number;
  parentId?: string;
  children?: string[];
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
};

export type LRCMetric = {
  value: number;
  threshold: number;
  met: boolean;
};

export type LRCEvaluation = {
  passed: boolean;
  status: string;
  recommendation: string;
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
