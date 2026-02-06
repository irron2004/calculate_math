export const CLEAR_THRESHOLD = 0.8

export type AttemptSessionStatus = 'DRAFT' | 'SUBMITTED'

export type AttemptResponse = {
  problemId: string
  inputRaw: string
  updatedAt: string // ISO8601
  // 레벨 2: 풀이 과정 기록
  timeSpentMs: number
  answerEditCount: number
  scratchpadStrokesJson: string | null
}

export type TagAccuracy = {
  tag: string
  totalCount: number
  correctCount: number
  accuracy: number
}

export type PerProblemGradingV1 = {
  isCorrect: boolean
  expectedAnswer?: string
  explanation?: string
  // 레벨 2: 풀이 과정 기록 (Eval에서 확인용)
  timeSpentMs?: number
  answerEditCount?: number
  scratchpadStrokesJson?: string | null
}

export type GradingResultV1 = {
  totalCount: number
  correctCount: number
  accuracy: number // correctCount/totalCount (0~1)
  cleared: boolean // accuracy >= CLEAR_THRESHOLD
  perProblem: Record<string, PerProblemGradingV1>
  perTag?: TagAccuracy[] // 태그별 정답률 (태그가 있는 경우에만)
}

export type AttemptSessionV1 = {
  nodeId: string
  sessionId: string
  status: AttemptSessionStatus
  responses: Record<string, AttemptResponse> // key=problemId
  grading?: GradingResultV1 // status==="SUBMITTED"에서만 생성/저장
  createdAt: string // ISO8601
  updatedAt: string // ISO8601
}

export type AttemptSessionStoreV1 = {
  version: 1
  sessionsById: Record<string, AttemptSessionV1>
  draftSessionIdByNodeId: Record<string, string> // nodeId -> sessionId
}

export type NodeStatus = 'CLEARED' | 'IN_PROGRESS' | 'AVAILABLE' | 'LOCKED'

export type NodeProgressV1 = {
  nodeId: string
  status: NodeStatus
  bestAccuracy: number | null
  lastAttemptAt: string | null
  clearedAt: string | null
  lockedReasons?: { missingPrereqNodeIds: string[] }
}

export type LearningGraphNode = {
  id: string
  isStart?: boolean
  order?: number
}

export type LearningGraphEdge = {
  sourceId: string
  targetId: string
  type: 'requires' | 'prepares_for'
}

export type LearningGraphV1 = {
  nodes: LearningGraphNode[]
  edges: LearningGraphEdge[]
}
