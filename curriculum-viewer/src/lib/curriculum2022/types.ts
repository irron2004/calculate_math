export type ProposedTextbookUnitNodeOrigin = 'manual' | 'research'

export type ProposedTextbookUnitNode = {
  id: string
  nodeType: 'textbookUnit'
  label: string
  proposed: true
  origin: ProposedTextbookUnitNodeOrigin
  note?: string
  reason?: string
}

