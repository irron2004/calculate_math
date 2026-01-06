export type CurriculumNodeType = 'subject' | 'grade' | 'domain' | 'standard'

export type CurriculumNode = {
  id: string
  type: CurriculumNodeType
  title: string
  parent_id?: string
  children_ids: string[]
  subject?: string
  grade_band?: string
  grade?: number
  domain?: string
  domain_code?: string
  official_code?: string
  text?: string
  source?: Record<string, unknown>
}

export type CurriculumData = {
  meta?: Record<string, unknown>
  nodes: CurriculumNode[]
}
