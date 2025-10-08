export function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function countKeywordMatches(text: string, keywords: readonly string[] | undefined): number {
  if (!text || !keywords || !keywords.length) {
    return 0;
  }

  const normalized = normalizeText(text);
  const normalizedCompact = normalized.replace(/\s+/g, '');
  const seen = new Set<string>();
  let matches = 0;

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword || seen.has(normalizedKeyword)) {
      continue;
    }

    seen.add(normalizedKeyword);
    const normalizedKeywordCompact = normalizedKeyword.replace(/\s+/g, '');

    if (
      normalized.includes(normalizedKeyword) ||
      normalizedCompact.includes(normalizedKeywordCompact)
    ) {
      matches += 1;
    }
  }

  return matches;
}
