import type { CurriculumData } from './types'
import type { CurriculumIssue } from './validateTypes'

export type CurriculumSchemaIssueCode =
  | 'invalid_root'
  | 'invalid_nodes'
  | 'invalid_node'
  | 'invalid_field'

export type CurriculumSchemaIssue = {
  code: CurriculumSchemaIssueCode
  message: string
  nodeId?: string
  field?: string
}

export type CurriculumValidationResult = {
  data: CurriculumData | null
  issues: CurriculumIssue[]
  schemaIssues: CurriculumSchemaIssue[]
}

export function validateCurriculumData(payload: unknown): CurriculumValidationResult

export function formatSchemaIssue(issue: CurriculumSchemaIssue): string
