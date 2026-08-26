export const AVATAR_SOURCES = ['auto', 'clawd', 'upload'] as const;
export type AvatarSource = (typeof AVATAR_SOURCES)[number];

export const CLAWD_AVATAR_PRESETS = [
  { id: 'idle', file: 'clawd-idle-look.svg', zh: '待机', en: 'Idle' },
  { id: 'bubble', file: 'clawd-idle-bubble.svg', zh: '冒泡', en: 'Thought Bubble' },
  { id: 'thinking', file: 'clawd-working-thinking.svg', zh: '思考', en: 'Thinking' },
  { id: 'typing', file: 'clawd-working-typing.svg', zh: '打字', en: 'Typing' },
  { id: 'building', file: 'clawd-working-building.svg', zh: '搭建', en: 'Building' },
  { id: 'headphones', file: 'clawd-headphones-groove.svg', zh: '戴耳机', en: 'Groove' },
  { id: 'juggling', file: 'clawd-working-juggling.svg', zh: '抛接', en: 'Juggling' },
  { id: 'sweeping', file: 'clawd-working-sweeping.svg', zh: '打扫', en: 'Sweeping' },
  { id: 'carrying', file: 'clawd-working-carrying.svg', zh: '搬运', en: 'Carrying' },
  { id: 'debugger', file: 'clawd-working-debugger.svg', zh: '调试', en: 'Debugger' },
  { id: 'wizard', file: 'clawd-working-wizard.svg', zh: '施法', en: 'Wizard' },
  { id: 'ultrathink', file: 'clawd-working-ultrathink.svg', zh: '深度思考', en: 'Ultrathink' },
  { id: 'boss', file: 'clawd-working-typing-boss.svg', zh: '老板模式', en: 'Boss' },
  { id: 'happy', file: 'clawd-happy.svg', zh: '开心', en: 'Happy' },
  { id: 'error', file: 'clawd-error.svg', zh: '出错', en: 'Error' },
  { id: 'notification', file: 'clawd-notification.svg', zh: '提醒', en: 'Notification' },
  { id: 'reading', file: 'clawd-idle-reading.svg', zh: '阅读', en: 'Reading' },
  { id: 'yawn', file: 'clawd-idle-yawn.svg', zh: '打哈欠', en: 'Yawn' },
  { id: 'doze', file: 'clawd-idle-doze.svg', zh: '打盹', en: 'Doze' },
  { id: 'sleeping', file: 'clawd-sleeping.svg', zh: '睡觉', en: 'Sleeping' },
  { id: 'wake', file: 'clawd-wake.svg', zh: '醒来', en: 'Waking' },
] as const;

export type ClawdAvatarPresetId = (typeof CLAWD_AVATAR_PRESETS)[number]['id'];
export const DEFAULT_CLAWD_AVATAR_PRESET: ClawdAvatarPresetId = 'idle';

const AVATAR_SOURCE_SET = new Set<string>(AVATAR_SOURCES);
const CLAWD_AVATAR_PRESET_SET = new Set<string>(CLAWD_AVATAR_PRESETS.map((preset) => preset.id));

export function isAvatarSource(value: unknown): value is AvatarSource {
  return typeof value === 'string' && AVATAR_SOURCE_SET.has(value);
}

export function isClawdAvatarPreset(value: unknown): value is ClawdAvatarPresetId {
  return typeof value === 'string' && CLAWD_AVATAR_PRESET_SET.has(value);
}
