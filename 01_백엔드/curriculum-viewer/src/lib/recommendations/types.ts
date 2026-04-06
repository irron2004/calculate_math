export type RecommendationItem = {
  nodeId: string
  reason: string
  score: number
}

export type RecommendationsResponse = {
  items: RecommendationItem[]
}
