export type CurriculumIssueCode =
  | 'duplicate_id'
  | 'missing_parent'
  | 'missing_child'
  | 'parent_missing_child'
  | 'child_wrong_parent'
  | 'type_hierarchy'
  | 'orphan'
  | 'cycle'

export type CurriculumIssueSeverity = 'error' | 'warning'

export type CurriculumIssue = {
  code: CurriculumIssueCode
  severity: CurriculumIssueSeverity
  message: string
  nodeId?: string
  relatedId?: string
}

