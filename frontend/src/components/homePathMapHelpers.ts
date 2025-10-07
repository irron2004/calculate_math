export type GradeRange = [number, number];

export function gradeTokenToValue(token: string): number {
  if (!token) {
    return Number.POSITIVE_INFINITY;
  }
  const prefix = token[0]?.toUpperCase();
  const level = Number.parseInt(token.slice(1), 10);
  if (Number.isNaN(level)) {
    return Number.POSITIVE_INFINITY;
  }
  switch (prefix) {
    case 'E':
      return level;
    case 'G':
      return 6 + level;
    default:
      return Number.POSITIVE_INFINITY;
  }
}

export function parseGradeBand(band: string): GradeRange {
  const [startToken, endToken] = band.split('-');
  const start = gradeTokenToValue(startToken);
  const end = gradeTokenToValue(endToken ?? startToken);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return [1, 12];
  }
  return [Math.min(start, end), Math.max(start, end)];
}

export function overlaps([minA, maxA]: GradeRange, [minB, maxB]: GradeRange): boolean {
  return Math.max(minA, minB) <= Math.min(maxA, maxB);
}

export function classifyMastery(value: number): 'low' | 'medium' | 'high' {
  if (value >= 0.75) {
    return 'high';
  }
  if (value >= 0.4) {
    return 'medium';
  }
  return 'low';
}
