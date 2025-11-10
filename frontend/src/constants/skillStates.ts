export type SkillState = 'locked' | 'unlockable' | 'unlocked' | 'completed' | 'mastered';

type SkillTone = 'gray' | 'blue' | 'sky' | 'green' | 'amber';
type SkillBorderStyle = 'solid' | 'dashed' | 'double';

export type SkillStateMeta = {
  icon: 'lock' | 'sparkles' | 'arrow-right' | 'check-circle' | 'star';
  tone: SkillTone;
  border: SkillBorderStyle;
  badgeKey: `skill.state.${SkillState}`;
  tooltipKey: `skill.tooltip.${SkillState}`;
};

export const SKILL_STATE_META: Record<SkillState, SkillStateMeta> = {
  locked: {
    icon: 'lock',
    tone: 'gray',
    border: 'dashed',
    badgeKey: 'skill.state.locked',
    tooltipKey: 'skill.tooltip.locked',
  },
  unlockable: {
    icon: 'sparkles',
    tone: 'blue',
    border: 'dashed',
    badgeKey: 'skill.state.unlockable',
    tooltipKey: 'skill.tooltip.unlockable',
  },
  unlocked: {
    icon: 'arrow-right',
    tone: 'sky',
    border: 'solid',
    badgeKey: 'skill.state.unlocked',
    tooltipKey: 'skill.tooltip.unlocked',
  },
  completed: {
    icon: 'check-circle',
    tone: 'green',
    border: 'solid',
    badgeKey: 'skill.state.completed',
    tooltipKey: 'skill.tooltip.completed',
  },
  mastered: {
    icon: 'star',
    tone: 'amber',
    border: 'double',
    badgeKey: 'skill.state.mastered',
    tooltipKey: 'skill.tooltip.mastered',
  },
};

export const SKILL_STATE_COLORS: Record<SkillTone, string> = {
  gray: '#9aa3b2',
  blue: '#2563eb',
  sky: '#38bdf8',
  green: '#22c55e',
  amber: '#f59e0b',
};

export const SKILL_STATE_BADGE_CLASS: Record<SkillTone, string> = {
  gray: 'badge--gray',
  blue: 'badge--blue',
  sky: 'badge--sky',
  green: 'badge--green',
  amber: 'badge--amber',
};
