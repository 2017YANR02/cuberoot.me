import type { GroupId } from './types';

export interface GroupMeta {
  id: GroupId;
  label_en: string;
  label_zh: string;
}

export const GROUPS: GroupMeta[] = [
  { id: 'competition', label_en: 'Competition & Stats', label_zh: '比赛与统计' },
  { id: 'timer',       label_en: 'Timers',              label_zh: '计时器' },
  { id: 'learning',    label_en: 'Learning & Community',label_zh: '学习与社区' },
  { id: 'algorithms',  label_en: 'Algorithms',          label_zh: '公式与训练' },
  { id: 'events',      label_en: 'Per-Event',           label_zh: '异形与分项' },
  { id: 'recon',       label_en: 'Reconstructions',     label_zh: '复盘' },
  { id: 'simulators',  label_en: 'Simulators',          label_zh: '模拟器' },
  { id: 'solvers',     label_en: 'Solvers & Theory',    label_zh: '求解器与理论' },
  { id: 'cubers',      label_en: 'Cubers & Patterns',   label_zh: '魔友与图案' },
  { id: 'shop',        label_en: 'Shop',                label_zh: '商店' },
];
