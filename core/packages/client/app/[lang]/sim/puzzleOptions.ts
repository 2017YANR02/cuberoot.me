// Lightweight catalog shared by the simulator menu and icon gallery.
import { eventDisplayName } from '@/lib/wca-events';
import { PG_PUZZLES } from './pgCatalog';

// WCA-standard event names reuse the site-wide single source (lib/wca-events
// eventDisplayName — same labels the /wca/records page renders: 三阶/3×3, SQ1,
// 金字塔/Pyra, 斜转/Skewb, 五魔/Mega...). Non-WCA puzzles below keep bespoke names.
export const SIM_FIXED_PUZZLE_OPTIONS = [
  { value: 'nxn',      iconClass: 'event-333', labelZh: 'NxN',    labelEn: 'NxN' },
  { value: 'custom',   iconClass: 'puzzle-custom', labelZh: '自定义切割', labelEn: 'Puzzle Cuts' },
  { value: 'sq1',      iconClass: 'event-sq1', labelZh: eventDisplayName('sq1', true), labelEn: eventDisplayName('sq1', false) },
  { value: 'sq2',      iconClass: 'unofficial-sq2', labelZh: 'SQ2', labelEn: 'SQ2' },
  { value: 'sq4',      iconClass: 'unofficial-sq4', labelZh: 'SQ4', labelEn: 'SQ4' },
  { value: 'ivy',      iconClass: 'unofficial-ivy', labelZh: '枫叶', labelEn: 'Ivy' },
  { value: 'pyraminx', iconClass: 'event-pyram', labelZh: eventDisplayName('pyram', true), labelEn: eventDisplayName('pyram', false) },
  { value: 'skewb',    iconClass: 'event-skewb', labelZh: eventDisplayName('skewb', true), labelEn: eventDisplayName('skewb', false) },
  { value: 'megaminx', iconClass: 'event-minx',  labelZh: eventDisplayName('minx', true), labelEn: eventDisplayName('minx', false) },
  { value: 'clock',    iconClass: 'event-clock', labelZh: eventDisplayName('clock', true), labelEn: eventDisplayName('clock', false) },
  { value: 'fto',      iconClass: 'puzzle-fto', labelZh: eventDisplayName('fto', true), labelEn: eventDisplayName('fto', false) },
  { value: 'dino',     iconClass: 'unofficial-dino', labelZh: '恐龙', labelEn: 'Dino' },
  { value: 'redi',     iconClass: 'unofficial-redi', labelZh: '热帝', labelEn: 'Redi' },
  { value: 'rex',      iconClass: 'unofficial-rex', labelZh: '八轴魔星', labelEn: 'Rex Cube' },
  { value: 'heli',     iconClass: 'unofficial-helicopter', labelZh: '直升机', labelEn: 'Helicopter' },
  { value: 'gear',     iconClass: 'puzzle-gear', labelZh: '齿轮', labelEn: 'Gear Cube' },
  { value: 'ghost',    iconClass: 'unofficial-ghost', labelZh: '鬼魔', labelEn: 'Ghost Cube' },
  { value: 'mirror',   iconClass: 'unofficial-333_mirror_blocks', labelZh: '镜面', labelEn: 'Mirror' },
  { value: 'mirror2',  iconClass: 'unofficial-222_mirror_blocks', labelZh: '二阶镜面', labelEn: 'Mirror 2x2' },
  { value: 'pyraminx_duo', iconClass: 'unofficial-pyraminx_duo', labelZh: '二重奏', labelEn: 'Pyraminx Duo' },
  { value: 'kilominx', iconClass: 'unofficial-kilominx', labelZh: '二阶五魔', labelEn: 'Kilominx' },
  { value: 'magic', iconClass: 'event-magic', labelZh: '八板', labelEn: 'Rubik’s Magic' },
  { value: 'mmagic', iconClass: 'event-mmagic', labelZh: '十二板', labelEn: 'Master Magic' },
  { value: 'sphere', textLabel: 'Sphere', labelZh: '球形', labelEn: 'Sphere Cube' },
] as const;

// Engine puzzles above + cubing.js PuzzleGeometry puzzles (explore set, rendered
// via TwistyPlayer — see pgCatalog.ts). The PG entries are appended at runtime so
// the catalog stays the single source of truth.
export const ALL_PUZZLE_TYPE_OPTIONS: { value: string; iconClass?: string; textLabel?: string; labelZh: string; labelEn: string }[] = [
  ...SIM_FIXED_PUZZLE_OPTIONS,
  ...PG_PUZZLES.map((p) => ({ value: p.id, iconClass: p.icon || undefined, textLabel: 'textLabel' in p ? p.textLabel : undefined, labelZh: p.zh, labelEn: p.en })),
];

