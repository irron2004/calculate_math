export type StudentProfile = {
  studentId: string
  survey: Record<string, unknown>
  placement: Record<string, unknown>
  estimatedLevel: string
  weakTagsTop3: string[]
  createdAt: string
  updatedAt: string
}

export type StudentProfileUpsertInput = {
  survey: Record<string, unknown>
  placement: Record<string, unknown>
  estimatedLevel: string
  weakTagsTop3: string[]
}

