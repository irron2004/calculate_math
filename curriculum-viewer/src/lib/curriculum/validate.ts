import type { CurriculumNode } from './types'
import { validateCurriculum as validateCurriculumCore } from './validateCore.js'
import type { CurriculumIssue } from './validateTypes'

export type { CurriculumIssue, CurriculumIssueCode, CurriculumIssueSeverity } from './validateTypes'

export function validateCurriculum(nodes: ReadonlyArray<CurriculumNode>): CurriculumIssue[] {
  return validateCurriculumCore(nodes)
}
