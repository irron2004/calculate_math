type TranslationValues = Record<string, unknown>;

type TranslationDictionary = Record<string, string>;

const KO_SKILL: TranslationDictionary = {
  'skill.state.locked': '잠김',
  'skill.state.unlockable': '열림 가능',
  'skill.state.unlocked': '열림',
  'skill.state.completed': '완료',
  'skill.state.mastered': '마스터',
  'skill.tooltip.locked': '선행 스킬을 먼저 완료하세요: {{requires}}',
  'skill.tooltip.unlockable': '지금 시작할 수 있습니다.',
  'skill.tooltip.unlocked': '학습을 진행 중입니다.',
  'skill.tooltip.completed': '이 스킬을 완료했습니다.',
  'skill.tooltip.mastered': '축하합니다! 이 스킬을 마스터했습니다.',
};

const DEFAULT_LOCALE = 'ko';

const REGISTRY: Record<string, TranslationDictionary> = {
  ko: KO_SKILL,
};

const interpolate = (template: string, values: TranslationValues): string => {
  return template.replace(/{{(\w+)}}/g, (_, key: string) => {
    const value = values[key];
    return value === undefined || value === null ? '' : String(value);
  });
};

export function t(key: string, values: TranslationValues = {}, locale: string = DEFAULT_LOCALE): string {
  const dictionary = REGISTRY[locale] ?? REGISTRY[DEFAULT_LOCALE];
  const template = dictionary[key];
  if (!template) {
    return key;
  }
  return interpolate(template, values);
}

export function formatList(items: string[]): string {
  if (!items.length) {
    return '';
  }
  if (items.length === 1) {
    return items[0] ?? '';
  }
  return `${items.slice(0, -1).join(', ')} 그리고 ${items[items.length - 1]}`;
}
