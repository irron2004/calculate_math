export type CurriculumNodeType = 'subject' | 'grade' | 'domain' | 'standard'

export type CurriculumNode = {
  id: string
  type: CurriculumNodeType
  grade?: number
  domain_code?: string
}

export type ProgressionEdge = {
  id: string
  edgeType: 'progression'
  source: string
  target: string
  domainCode: string
  fromGrade: number
  toGrade: number
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)
}

function compareString(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function buildProgressionEdges(nodes: ReadonlyArray<CurriculumNode>): ProgressionEdge[] {
  const nodesByDomainCodeThenGrade = new Map<string, Map<number, CurriculumNode>>()

  for (const node of nodes) {
    if (node.type !== 'domain') {
      continue
    }

    if (typeof node.domain_code !== 'string' || node.domain_code.trim().length === 0) {
      continue
    }

    if (!isInteger(node.grade)) {
      continue
    }

    const domainCode = node.domain_code.trim()
    const grade = node.grade

    const byGrade = nodesByDomainCodeThenGrade.get(domainCode) ?? new Map<number, CurriculumNode>()
    const existing = byGrade.get(grade)

    if (!existing || compareString(node.id, existing.id) < 0) {
      byGrade.set(grade, node)
    }

    nodesByDomainCodeThenGrade.set(domainCode, byGrade)
  }

  const edges: ProgressionEdge[] = []
  const seen = new Set<string>()

  const domainCodes = Array.from(nodesByDomainCodeThenGrade.keys()).sort(compareString)
  for (const domainCode of domainCodes) {
    const byGrade = nodesByDomainCodeThenGrade.get(domainCode)
    if (!byGrade) {
      continue
    }

    const grades = Array.from(byGrade.keys()).sort((a, b) => a - b)
    for (let index = 0; index < grades.length - 1; index += 1) {
      const fromGrade = grades[index]
      const toGrade = grades[index + 1]

      // "인접 학년"만 연결한다(결측 grade는 안전하게 스킵).
      if (toGrade !== fromGrade + 1) {
        continue
      }

      const sourceNode = byGrade.get(fromGrade)
      const targetNode = byGrade.get(toGrade)

      if (!sourceNode || !targetNode) {
        continue
      }

      const key = `${sourceNode.id}->${targetNode.id}`
      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      edges.push({
        id: `progression:${domainCode}:${sourceNode.id}->${targetNode.id}`,
        edgeType: 'progression',
        source: sourceNode.id,
        target: targetNode.id,
        domainCode,
        fromGrade,
        toGrade
      })
    }
  }

  return edges
}
