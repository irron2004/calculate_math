export type PlacementAnswerType = 'numeric' | 'text' | 'choice'
export type PlacementQuestionType = 'objective' | 'subjective'

export type PlacementQuestion = {
  id: string
  type: PlacementQuestionType
  prompt: string
  options?: string[]
  answer: string
  answerType: PlacementAnswerType
  tags: string[]
  difficulty: number // 1~5
  gradeHint: number // 1~6
  estimatedTimeSec: number
}

export const PLACEMENT_QUESTIONS_V1: PlacementQuestion[] = [
  {
    id: 'q1_place_value_tens',
    type: 'objective',
    prompt: '372에서 십의 자리 숫자는?',
    options: ['3', '7', '2', '0'],
    answer: '2',
    answerType: 'choice',
    tags: ['place_value'],
    difficulty: 1,
    gradeHint: 2,
    estimatedTimeSec: 20
  },
  {
    id: 'q2_add_carry',
    type: 'subjective',
    prompt: '48 + 27 = ?',
    answer: '75',
    answerType: 'numeric',
    tags: ['add_carry'],
    difficulty: 2,
    gradeHint: 2,
    estimatedTimeSec: 25
  },
  {
    id: 'q3_sub_borrow',
    type: 'subjective',
    prompt: '52 - 38 = ?',
    answer: '14',
    answerType: 'numeric',
    tags: ['sub_borrow'],
    difficulty: 2,
    gradeHint: 3,
    estimatedTimeSec: 30
  },
  {
    id: 'q4_multiply_basic',
    type: 'subjective',
    prompt: '6 × 7 = ?',
    answer: '42',
    answerType: 'numeric',
    tags: ['multiply_basic'],
    difficulty: 2,
    gradeHint: 3,
    estimatedTimeSec: 20
  },
  {
    id: 'q5_divide_basic',
    type: 'subjective',
    prompt: '42 ÷ 6 = ?',
    answer: '7',
    answerType: 'numeric',
    tags: ['divide_basic'],
    difficulty: 3,
    gradeHint: 3,
    estimatedTimeSec: 25
  },
  {
    id: 'q6_fraction_equivalence',
    type: 'objective',
    prompt: '다음 중 1/2와 같은 것은?',
    options: ['2/4', '3/4', '1/4', '4/1'],
    answer: '1',
    answerType: 'choice',
    tags: ['fraction_basic'],
    difficulty: 3,
    gradeHint: 4,
    estimatedTimeSec: 30
  },
  {
    id: 'q7_word_problem_divide',
    type: 'subjective',
    prompt: '사탕이 24개 있어요. 3명에게 똑같이 나누면 한 명당 몇 개?',
    answer: '8',
    answerType: 'numeric',
    tags: ['word_problem', 'divide_basic'],
    difficulty: 3,
    gradeHint: 3,
    estimatedTimeSec: 40
  },
  {
    id: 'q8_pattern_arithmetic',
    type: 'subjective',
    prompt: '2, 5, 8, 11, (  ) 다음 수는?',
    answer: '14',
    answerType: 'numeric',
    tags: ['pattern'],
    difficulty: 2,
    gradeHint: 3,
    estimatedTimeSec: 25
  },
  {
    id: 'q9_perimeter_square',
    type: 'subjective',
    prompt: '한 변이 5cm인 정사각형의 둘레는?',
    answer: '20',
    answerType: 'numeric',
    tags: ['geometry_perimeter'],
    difficulty: 2,
    gradeHint: 3,
    estimatedTimeSec: 25
  },
  {
    id: 'q10_place_value_zero',
    type: 'objective',
    prompt: '3,405에서 십의 자리 숫자는?',
    options: ['3', '4', '0', '5'],
    answer: '3',
    answerType: 'choice',
    tags: ['place_value'],
    difficulty: 2,
    gradeHint: 3,
    estimatedTimeSec: 25
  },
  {
    id: 'q11_word_problem_add',
    type: 'subjective',
    prompt: '연필이 38자루 있어요. 27자루를 더 사면 모두 몇 자루?',
    answer: '65',
    answerType: 'numeric',
    tags: ['word_problem', 'add_carry'],
    difficulty: 1,
    gradeHint: 2,
    estimatedTimeSec: 35
  },
  {
    id: 'q12_divide_remainder',
    type: 'subjective',
    prompt: '25 ÷ 4의 나머지는?',
    answer: '1',
    answerType: 'numeric',
    tags: ['divide_remainder'],
    difficulty: 4,
    gradeHint: 4,
    estimatedTimeSec: 35
  }
]

