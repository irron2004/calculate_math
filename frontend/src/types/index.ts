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

export type APISession = {
  session_id: number;
  problems: APIProblem[];
};

export type APIProblemResponse = {
  problem_id: number;
  chosen_answer: number;
  correct_answer: number;
  is_correct: boolean;
  attempt_no: number;
  message: string;
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