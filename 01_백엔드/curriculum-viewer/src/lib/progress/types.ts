export type NodeStatus = 'complete' | 'in-progress' | 'not-started' | 'no-content'

export type StandardProgress = {
  total: number
  submitted: number
  correct: number
  status: NodeStatus
}

export type ProgressStats = {
  completedStandards: number
  eligibleStandardCount: number
  overallCompletionRate: number | null
  totalSubmittedProblems: number
  totalCorrectProblems: number
  averageAccuracy: number | null
  latestUpdatedAt: string | null
}

export type DomainStat = {
  domainId: string
  domainKey: string
  eligibleStandardCount: number
  completedStandards: number
  completionRate: number | null
  domainTotal: number
  domainSubmitted: number
  domainCorrect: number
  domainMastery: number | null
}

export type Recommendation = {
  nodeId: string
  domainKey: string
} | null

