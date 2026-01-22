import type { CurriculumNode } from './types'
import type { CurriculumIssue } from './validateTypes'

export function validateCurriculum(nodes: ReadonlyArray<CurriculumNode>): CurriculumIssue[]

export function sortCurriculumIssues(issues: ReadonlyArray<CurriculumIssue>): CurriculumIssue[]
