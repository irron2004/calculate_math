export interface LensBadge {
  id: string;
  icon: string;
  label: string;
}

const LENS_META: Record<string, LensBadge> = {
  difference: { id: 'difference', icon: '🔺', label: '차분' },
  accumulation: { id: 'accumulation', icon: '⬛', label: '누적' },
  ratio: { id: 'ratio', icon: '➗', label: '비율' },
  scale: { id: 'scale', icon: '📏', label: '스케일' },
  random: { id: 'random', icon: '🎲', label: '무작위' },
  transform: { id: 'transform', icon: '🔄', label: '변환' },
  vector: { id: 'vector', icon: '🧭', label: '벡터' }
};

const FALLBACK_BADGE: LensBadge = { id: 'unknown', icon: '❓', label: '렌즈' };

export function getLensBadge(id: string): LensBadge {
  return LENS_META[id] ?? { ...FALLBACK_BADGE, id };
}

export function getLensBadges(ids: readonly string[] | string[] | undefined): LensBadge[] {
  if (!ids || !ids.length) {
    return [FALLBACK_BADGE];
  }
  return ids.map((lens) => getLensBadge(lens));
}

export function getLensBadgeTokens(ids: readonly string[] | string[] | undefined): string {
  return getLensBadges(ids)
    .map((badge) => `${badge.icon} ${badge.label}`)
    .join(', ');
}

export const LENS_META_MAP = LENS_META;
