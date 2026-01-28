export function slugifyLabel(label: string): string {
  const normalized = label.trim().toLowerCase().normalize('NFKC')
  if (!normalized) return ''

  // Keep Unicode letters/numbers, replace everything else with underscores.
  const slug = normalized
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  return slug
}

export function generateProposedNodeId(label: string, existingIds: Iterable<string>): string | null {
  const slug = slugifyLabel(label)
  if (!slug) return null

  const baseId = `P_TU_${slug}`
  const existing = existingIds instanceof Set ? existingIds : new Set(existingIds)

  if (!existing.has(baseId)) return baseId

  let suffix = 2
  while (existing.has(`${baseId}_${suffix}`)) {
    suffix += 1
  }

  return `${baseId}_${suffix}`
}
