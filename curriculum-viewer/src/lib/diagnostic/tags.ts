export const TAG_LABELS_KO: Record<string, string> = {
  place_value: '자리값',
  add_carry: '받아올림 덧셈',
  sub_borrow: '받아내림 뺄셈',
  multiply_basic: '곱셈',
  divide_basic: '나눗셈',
  divide_remainder: '나머지',
  fraction_basic: '분수',
  word_problem: '문장제',
  pattern: '규칙',
  geometry_perimeter: '둘레'
}

export function formatTagKo(tag: string): string {
  return TAG_LABELS_KO[tag] ?? tag
}

