import { SkillGraphSchemaError, type SkillGraphIssue } from './schema'

export type SkillGraphErrorModel = {
  message: string
  issues: SkillGraphIssue[]
}

export function normalizeSkillGraphSchemaError(error: unknown): SkillGraphErrorModel | null {
  if (error instanceof SkillGraphSchemaError) {
    return { message: error.message, issues: error.issues }
  }

  return null
}

