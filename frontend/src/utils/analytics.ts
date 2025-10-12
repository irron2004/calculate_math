export type StepID = 'S1' | 'S2' | 'S3';

interface BasePayload {
  [key: string]: unknown;
}

const normalizePayload = (payload: BasePayload): Record<string, unknown> => {
  return Object.entries(payload).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    if (value === undefined || value === null) {
      return accumulator;
    }
    accumulator[key] = value;
    return accumulator;
  }, {});
};

const emitEvent = (eventName: string, payload: BasePayload) => {
  if (typeof window === 'undefined') {
    return;
  }
  const analytics = window.analytics;
  if (!analytics || typeof analytics.trackEvent !== 'function') {
    return;
  }
  analytics.trackEvent(eventName, normalizePayload(payload));
};

export type SkillViewSource =
  | 'initial'
  | 'concept_tab'
  | 'skill_node'
  | 'auto_progress'
  | 'resume'
  | 'restart'
  | 'query_param'
  | 'unknown';

export interface SkillViewedPayload {
  conceptId: string;
  conceptName: string;
  step: StepID;
  nodeId: string;
  source: SkillViewSource;
  sequenceIndex: number | null;
  available: boolean;
  completed: boolean;
  lens?: string | null;
  problemCount?: number;
  problemsSource?: 'generated' | 'session_fallback' | 'local_fallback';
}

export const trackSkillViewed = (payload: SkillViewedPayload) => {
  emitEvent('skill_viewed', {
    concept_id: payload.conceptId,
    concept_name: payload.conceptName,
    step: payload.step,
    node_id: payload.nodeId,
    source: payload.source,
    sequence_index: payload.sequenceIndex,
    available: payload.available,
    completed: payload.completed,
    lens: payload.lens,
    problem_count: payload.problemCount,
    problems_source: payload.problemsSource,
  });
};

export interface SkillUnlockedPayload {
  conceptId: string;
  conceptName: string;
  unlockedStep: StepID;
  previousStep: StepID;
  nodeId: string;
  sequenceIndex: number | null;
  lens?: string | null;
}

export const trackSkillUnlocked = (payload: SkillUnlockedPayload) => {
  emitEvent('skill_unlocked', {
    concept_id: payload.conceptId,
    concept_name: payload.conceptName,
    unlocked_step: payload.unlockedStep,
    previous_step: payload.previousStep,
    node_id: payload.nodeId,
    sequence_index: payload.sequenceIndex,
    lens: payload.lens,
  });
};

export interface BossPassedPayload {
  conceptId: string;
  conceptName: string;
  step: StepID;
  nodeId: string;
  sequenceIndex: number | null;
  status: string;
  recommendation: string;
  metrics: Record<string, number>;
  score: number;
  totalQuestions: number;
  correctCount: number;
}

export const trackBossPassed = (payload: BossPassedPayload) => {
  emitEvent('boss_passed', {
    concept_id: payload.conceptId,
    concept_name: payload.conceptName,
    step: payload.step,
    node_id: payload.nodeId,
    sequence_index: payload.sequenceIndex,
    status: payload.status,
    recommendation: payload.recommendation,
    metrics: payload.metrics,
    score: payload.score,
    total_questions: payload.totalQuestions,
    correct_count: payload.correctCount,
  });
};

export interface SessionStartedPayload {
  conceptId: string;
  conceptName: string;
  step: StepID;
  nodeId: string;
  sequenceIndex: number | null;
  triggeredBy: 'skill_node';
  available: boolean;
  completed: boolean;
  lens?: string | null;
}

export const trackSessionStartedFromTree = (payload: SessionStartedPayload) => {
  emitEvent('session_started_from_tree', {
    concept_id: payload.conceptId,
    concept_name: payload.conceptName,
    step: payload.step,
    node_id: payload.nodeId,
    sequence_index: payload.sequenceIndex,
    triggered_by: payload.triggeredBy,
    available: payload.available,
    completed: payload.completed,
    lens: payload.lens,
  });
};

export type AnalyticsEvents =
  | SkillViewedPayload
  | SkillUnlockedPayload
  | BossPassedPayload
  | SessionStartedPayload;

export interface ExperimentExposurePayload {
  experiment: string;
  variant: string;
  source?: string;
  bucket?: string | number | null;
  requestId?: string | null;
  rollout?: number | null;
  surface?: string;
}

export const trackExperimentExposure = (payload: ExperimentExposurePayload) => {
  emitEvent('experiment_exposure', {
    experiment: payload.experiment,
    variant: payload.variant,
    source: payload.source,
    bucket: payload.bucket,
    request_id: payload.requestId,
    rollout: payload.rollout,
    surface: payload.surface,
  });
};

