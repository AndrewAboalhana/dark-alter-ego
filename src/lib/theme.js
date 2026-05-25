export const C = {
  bg: '#0A0A0F',
  card: '#13131A',
  card2: '#1A1A25',
  border: '#ffffff12',
  red: '#FF3B5C',
  purple: '#9B5DE5',
  cyan: '#00BBF9',
  gold: '#FFD93D',
  green: '#00F5A0',
  text: '#F0F0FF',
  muted: '#8888AA',
}

export const AVATARS = ['😈', '🎭', '🃏', '💀', '🦹', '🐍', '🌑', '👁️', '🔱', '⚡']
export const ANON_NAMES = [
  'الظل', 'المجهول', 'الغريب', 'العابر', 'الصامت',
  'الخفي', 'الآخر', 'المقنع', 'الليلي', 'النمر'
]
export const ANON_COLORS = [
  '#FF3B5C', '#9B5DE5', '#00BBF9', '#FFD93D', '#00F5A0',
  '#FF6B35', '#F72585', '#4CC9F0', '#7209B7', '#3A86FF'
]

export const LEVEL_CONFIG = {
  1: { label: 'دافئ', color: '#FFD93D', time: 45, emoji: '🟡' },
  2: { label: 'ساخن', color: '#FF6B35', time: 35, emoji: '🟠' },
  3: { label: 'حارق', color: '#FF3B5C', time: 25, emoji: '🔴' },
  4: { label: 'جهنمي', color: '#9B5DE5', time: 20, emoji: '⚫' },
}

export const EVIL_LEVELS = [
  { min: 0, max: 20, label: 'بريء تماماً', emoji: '😇', color: '#00F5A0' },
  { min: 21, max: 40, label: 'فيك شيطنة خفيفة', emoji: '😏', color: '#FFD93D' },
  { min: 41, max: 60, label: 'الجانب المظلم صاحي', emoji: '😈', color: '#FF6B35' },
  { min: 61, max: 80, label: 'شيطان محترف', emoji: '😈', color: '#FF3B5C' },
  { min: 81, max: 100, label: 'أنت الشر نفسه', emoji: '💀', color: '#9B5DE5' },
]

export const getEvilLevel = (score) =>
  EVIL_LEVELS.find(l => score >= l.min && score <= l.max) || EVIL_LEVELS[0]
