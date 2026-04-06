import type { StudentProfileSummary } from '../auth/types'
import type { AdminHomeworkProblem } from './types'

type HomeworkProblemTemplate = AdminHomeworkProblem & {
  meta: {
    tags: string[]
    difficulty: number // 1~5
    gradeHint: number // 1~6
  }
}

const HOMEWORK_LIBRARY_V1: HomeworkProblemTemplate[] = [
  {
    id: 't_place_value_1',
    type: 'objective',
    question: '7,203에서 백의 자리 숫자는?',
    options: ['7', '2', '0', '3'],
    answer: '2',
    meta: { tags: ['place_value'], difficulty: 1, gradeHint: 2 }
  },
  {
    id: 't_place_value_2',
    type: 'objective',
    question: '4,560에서 십의 자리 숫자는?',
    options: ['4', '5', '6', '0'],
    answer: '3',
    meta: { tags: ['place_value'], difficulty: 2, gradeHint: 3 }
  },
  {
    id: 't_add_carry_1',
    type: 'subjective',
    question: '58 + 37 = ?',
    answer: '95',
    meta: { tags: ['add_carry'], difficulty: 2, gradeHint: 2 }
  },
  {
    id: 't_add_carry_2',
    type: 'subjective',
    question: '126 + 89 = ?',
    answer: '215',
    meta: { tags: ['add_carry'], difficulty: 3, gradeHint: 3 }
  },
  {
    id: 't_sub_borrow_1',
    type: 'subjective',
    question: '73 - 48 = ?',
    answer: '25',
    meta: { tags: ['sub_borrow'], difficulty: 2, gradeHint: 3 }
  },
  {
    id: 't_sub_borrow_2',
    type: 'subjective',
    question: '402 - 168 = ?',
    answer: '234',
    meta: { tags: ['sub_borrow'], difficulty: 4, gradeHint: 4 }
  },
  {
    id: 't_multiply_1',
    type: 'subjective',
    question: '8 × 6 = ?',
    answer: '48',
    meta: { tags: ['multiply_basic'], difficulty: 2, gradeHint: 3 }
  },
  {
    id: 't_multiply_2',
    type: 'subjective',
    question: '12 × 7 = ?',
    answer: '84',
    meta: { tags: ['multiply_basic'], difficulty: 3, gradeHint: 4 }
  },
  {
    id: 't_divide_1',
    type: 'subjective',
    question: '56 ÷ 7 = ?',
    answer: '8',
    meta: { tags: ['divide_basic'], difficulty: 3, gradeHint: 3 }
  },
  {
    id: 't_divide_2',
    type: 'subjective',
    question: '81 ÷ 9 = ?',
    answer: '9',
    meta: { tags: ['divide_basic'], difficulty: 3, gradeHint: 3 }
  },
  {
    id: 't_divide_remainder_1',
    type: 'subjective',
    question: '17 ÷ 5의 나머지는?',
    answer: '2',
    meta: { tags: ['divide_remainder'], difficulty: 4, gradeHint: 4 }
  },
  {
    id: 't_fraction_1',
    type: 'objective',
    question: '다음 중 3/6과 같은 것은?',
    options: ['1/3', '1/2', '2/3', '3/2'],
    answer: '2',
    meta: { tags: ['fraction_basic'], difficulty: 3, gradeHint: 4 }
  },
  {
    id: 't_fraction_2',
    type: 'objective',
    question: '다음 중 1/4보다 큰 것은?',
    options: ['1/8', '1/6', '1/3', '1/9'],
    answer: '3',
    meta: { tags: ['fraction_basic'], difficulty: 4, gradeHint: 4 }
  },
  {
    id: 't_pattern_1',
    type: 'subjective',
    question: '3, 6, 9, 12, (  ) 다음 수는?',
    answer: '15',
    meta: { tags: ['pattern'], difficulty: 2, gradeHint: 3 }
  },
  {
    id: 't_pattern_2',
    type: 'subjective',
    question: '1, 4, 7, 10, (  ) 다음 수는?',
    answer: '13',
    meta: { tags: ['pattern'], difficulty: 2, gradeHint: 3 }
  },
  {
    id: 't_geometry_perimeter_1',
    type: 'subjective',
    question: '가로 6cm, 세로 4cm인 직사각형의 둘레는?',
    answer: '20',
    meta: { tags: ['geometry_perimeter'], difficulty: 2, gradeHint: 3 }
  },
  {
    id: 't_geometry_perimeter_2',
    type: 'subjective',
    question: '한 변이 8cm인 정사각형의 둘레는?',
    answer: '32',
    meta: { tags: ['geometry_perimeter'], difficulty: 2, gradeHint: 3 }
  },
  {
    id: 't_word_problem_1',
    type: 'subjective',
    question: '사과가 19개 있어요. 7개를 먹으면 남은 사과는 몇 개?',
    answer: '12',
    meta: { tags: ['word_problem', 'sub_borrow'], difficulty: 1, gradeHint: 2 }
  },
  {
    id: 't_word_problem_2',
    type: 'subjective',
    question: '쿠키가 24개 있어요. 4명에게 똑같이 나누면 한 명당 몇 개?',
    answer: '6',
    meta: { tags: ['word_problem', 'divide_basic'], difficulty: 3, gradeHint: 3 }
  }
]

function parseEstimatedLevel(level: string): { grade: number; band: number } | null {
  const match = /^E(\d+)-(\d+)$/.exec(level.trim())
  if (!match) return null
  const grade = Number(match[1])
  const band = Number(match[2])
  if (!Number.isFinite(grade) || !Number.isFinite(band)) return null
  return { grade, band }
}

function intersects(a: string[], b: string[]): boolean {
  const set = new Set(a)
  return b.some((x) => set.has(x))
}

export function recommendHomeworkProblems(
  profile: StudentProfileSummary,
  desiredCount = 10
): AdminHomeworkProblem[] {
  const weakTags = (profile.weakTagsTop3 ?? []).filter(Boolean)
  const parsed = profile.estimatedLevel ? parseEstimatedLevel(profile.estimatedLevel) : null
  const targetDifficulty = parsed ? Math.min(Math.max(parsed.band + 1, 1), 5) : 3

  const pick = (candidates: HomeworkProblemTemplate[], limit: number) => {
    const picked: HomeworkProblemTemplate[] = []
    for (const item of candidates) {
      if (picked.length >= limit) break
      picked.push(item)
    }
    return picked
  }

  const chosen: HomeworkProblemTemplate[] = []

  const pickForTags = (tags: string[]) => {
    for (const tag of tags) {
      const primary = HOMEWORK_LIBRARY_V1.filter(
        (p) => p.meta.tags.includes(tag) && Math.abs(p.meta.difficulty - targetDifficulty) <= 1
      )
      for (const item of pick(primary, 3)) {
        if (chosen.find((x) => x.id === item.id)) continue
        if (chosen.length >= desiredCount) return
        chosen.push(item)
      }
    }
  }

  pickForTags(weakTags)

  if (chosen.length < desiredCount && weakTags.length > 0) {
    const secondary = HOMEWORK_LIBRARY_V1.filter(
      (p) => intersects(p.meta.tags, weakTags) && !chosen.find((x) => x.id === p.id)
    ).sort((a, b) => a.meta.difficulty - b.meta.difficulty)
    for (const item of secondary) {
      if (chosen.length >= desiredCount) break
      chosen.push(item)
    }
  }

  if (chosen.length < desiredCount) {
    const fillers = HOMEWORK_LIBRARY_V1.filter((p) => !chosen.find((x) => x.id === p.id)).sort(
      (a, b) => a.meta.difficulty - b.meta.difficulty
    )
    for (const item of fillers) {
      if (chosen.length >= desiredCount) break
      chosen.push(item)
    }
  }

  const sliced = chosen.slice(0, desiredCount)
  return sliced.map((problem, index) => ({
    id: `p${index + 1}`,
    type: problem.type,
    question: problem.question,
    options: problem.options,
    answer: problem.answer
  }))
}
