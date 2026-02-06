export type AuthUser = {
  id: string
  username: string
  name: string
  grade: string
  email: string
  role: 'student' | 'admin'
  status: 'active' | 'disabled' | string
  createdAt: string
  lastLoginAt?: string | null
}

export type RegisterInput = {
  username: string
  password: string
  name: string
  grade: string
  email: string
}

export type LoginInput = {
  username: string
  password: string
}

export type StudentInfo = {
  id: string
  name: string
  grade: string
  email: string
  profile?: StudentProfileSummary | null
}

export type StudentProfileSummary = {
  estimatedLevel: string | null
  weakTagsTop3: string[]
  createdAt: string | null
  updatedAt: string | null
}
