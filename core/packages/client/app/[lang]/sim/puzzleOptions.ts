// Lightweight catalog shared by the simulator menu and icon gallery.
import { eventDisplayName } from '@/lib/wca-events';
import { PG_PUZZLES, type PgPuzzleId } from './pgCatalog';

export type SimPuzzle = number | 'sq1' | 'sq2' | 'sq4' | 'ivy' | 'dino' | 'redi' | 'rex' | 'heli' | 'gear' | 'ghost' | 'pyraminx' | 'pyraminx_duo' | 'skewb' | 'megaminx' | 'kilominx' | 'fto' | 'mirror' | 'mirror2' | 'sphere' | 'clock' | 'magic' | 'mmagic' | 'custom' | PgPuzzleId;

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
  { value: 'pyraminx_duo', iconClass: 'unofficial-pyraminx_duo', labelZh: '二重奏', labelEn: 'Pyraminx Duo' },
  { value: 'skewb',    iconClass: 'event-skewb', labelZh: eventDisplayName('skewb', true), labelEn: eventDisplayName('skewb', false) },
  { value: 'megaminx', iconClass: 'event-minx',  labelZh: eventDisplayName('minx', true), labelEn: eventDisplayName('minx', false) },
  { value: 'kilominx', iconClass: 'unofficial-kilominx', labelZh: '二阶五魔', labelEn: 'Kilominx' },
  { value: 'magic', iconClass: 'event-magic', labelZh: '八板', labelEn: 'Rubik’s Magic' },
  { value: 'mmagic', iconClass: 'event-mmagic', labelZh: '十二板', labelEn: 'Master Magic' },
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
  { value: 'sphere', iconClass: 'puzzle-sphere', labelZh: '球形', labelEn: 'Sphere Cube' },
] as const;

// Engine puzzles above + cubing.js PuzzleGeometry puzzles (explore set, rendered
// via TwistyPlayer — see pgCatalog.ts). The PG entries are appended at runtime so
// the catalog stays the single source of truth.
export interface SimPuzzleTypeOption {
  value: string;
  iconClass?: string;
  textLabel?: string;
  labelZh: string;
  labelEn: string;
}

export const ALL_PUZZLE_TYPE_OPTIONS: SimPuzzleTypeOption[] = [
  ...SIM_FIXED_PUZZLE_OPTIONS,
  ...PG_PUZZLES.map((p) => ({ value: p.id, iconClass: p.icon || undefined, textLabel: 'textLabel' in p ? p.textLabel : undefined, labelZh: p.zh, labelEn: p.en })),
];

interface SimPuzzleFamily {
  id: string;
  labelZh: string;
  labelEn: string;
  values: readonly string[];
}

// Presentation order only. Labels, icons and selection values still come from
// ALL_PUZZLE_TYPE_OPTIONS. Current WCA choices keep their original relative order.
const SIM_WCA_PUZZLES = ['nxn', 'sq1', 'pyraminx', 'skewb', 'megaminx', 'clock'] as const;

const SIM_PUZZLE_FAMILIES: readonly SimPuzzleFamily[] = [
  {
    id: 'minx', labelZh: '五魔系列', labelEn: 'Minx family',
    values: ['kilominx', 'gigaminx', 'teraminx', 'petaminx', 'examinx', 'zetaminx', 'yottaminx',
      'pentultimate', 'masterpentultimate', 'elitepentultimate', 'starminx', 'starminx2',
      'starminxcombo', 'pyraminxcrystal', 'masterbrilic', 'chopasaurus', 'megaminxchopasaurus', 'bigchop'],
  },
  {
    id: 'tetrahedron', labelZh: '金字塔与魔金', labelEn: 'Tetrahedral puzzles',
    values: ['masterpyraminx', 'professorpyraminx', 'royalpyraminx', 'emperorpyraminx',
      'pyraminx_duo', 'jingpyraminx', 'tetraminx', 'mastertetraminx', 'professortetraminx',
      'royaltetraminx', 'emperortetraminx', 'pyramorphix', 'mastermorphix', 'masterpyramorphix'],
  },
  { id: 'square', labelZh: 'Square 系列', labelEn: 'Square family', values: ['sq2', 'sq4'] },
  {
    id: 'corner-turning', labelZh: '斜转与角转', labelEn: 'Skewb & corner-turning',
    values: ['masterskewb', 'professorskewb', 'ivy', 'dino', 'redi', 'rex', 'compycube', 'dinoskewb', 'lattice'],
  },
  {
    id: 'edge-turning', labelZh: '直升机与棱转', labelEn: 'Helicopter & edge-turning',
    values: ['heli', 'curvycopter', 'quadx', 'littlechop'],
  },
  {
    id: 'octahedron', labelZh: 'FTO 与八面体', labelEn: 'FTO & octahedra',
    values: ['fto', 'masterfto', 'masterftov2', 'fto5', 'fto6', 'skewbdiamond', 'christophersjewel',
      'trajbersoctahedron', 'octahedron4', 'dinoocta', 'eto', 'comboctahedron', 'octastar'],
  },
  {
    id: 'icosahedron', labelZh: '二十面体', labelEn: 'Icosahedra',
    values: ['radiochop', 'radiocrystal', 'radiojewel', 'radioweb', 'radiojam', 'catscradle', 'radiocanon', 'circoradiolarian', 'eitansstar', 'icosamate', 'astrominx', 'astrominxbigchop',
      'icosaminx', 'redicosahedron', 'redicosahedroncenters', 'dogic', 'icosababyface'],
  },
  {
    id: 'shape-mods', labelZh: '镜面与外形', labelEn: 'Mirror & shape mods',
    values: ['mirror2', 'mirror', 'ghost', 'sphere'],
  },
  {
    id: 'hybrid-cuts', labelZh: '组合切割', labelEn: 'Combined cuts',
    values: ['cube2dino', 'cube3dino', 'cube2littlechop', 'dinolittlechop',
      'cube2dinolittlechop', 'superz', 'hyperx', 'latticex', 'cube3skewb', 'heliskewb', 'cube2heli', 'cube3heli'],
  },
  { id: 'magic', labelZh: '连板', labelEn: 'Magic family', values: ['magic', 'mmagic'] },
];

export interface SimPuzzleMenuGroup {
  id: string;
  labelZh: string;
  labelEn: string;
  submenu: boolean;
  options: SimPuzzleTypeOption[];
}

/** Filter the real catalog first, then omit empty families. New uncategorized
 * entries stay reachable under Other instead of silently disappearing. */
export function groupSimPuzzleOptions(allowedValues?: readonly string[]): SimPuzzleMenuGroup[] {
  const allowed = allowedValues && new Set(allowedValues);
  const options = ALL_PUZZLE_TYPE_OPTIONS.filter(option => !allowed || allowed.has(option.value));
  const byId = new Map(options.map(option => [option.value, option]));
  const take = (values: readonly string[]) => values.flatMap(value => {
    const option = byId.get(value);
    return option ? [option] : [];
  });
  const groups: SimPuzzleMenuGroup[] = [
    { id: 'wca', labelZh: 'WCA 项目', labelEn: 'WCA events', submenu: false, options: take(SIM_WCA_PUZZLES) },
    ...SIM_PUZZLE_FAMILIES.map(({ values, ...family }) => ({ ...family, submenu: true, options: take(values) })),
  ];
  const categorized = new Set(groups.flatMap(group => group.options.map(option => option.value)));
  groups.push({
    id: 'other', labelZh: '其他', labelEn: 'Other', submenu: false,
    options: options.filter(option => !categorized.has(option.value)),
  });
  return groups.filter(group => group.options.length > 0);
}


/** Free drawing supports templates independently of the animation puzzle. */
export const DRAW_PUZZLES = ['nxn', 'sq1', 'megaminx', 'skewb', 'pyraminx', 'fto'] as const;
export type DrawPuzzleSelection = number | Exclude<(typeof DRAW_PUZZLES)[number], 'nxn'>;

export function normalizeDrawPuzzle(value: string | number): DrawPuzzleSelection {
  if (typeof value === 'string' && DRAW_PUZZLES.some(id => id !== 'nxn' && id === value)) {
    return value as Exclude<DrawPuzzleSelection, number>;
  }
  const order = Number(value);
  return Number.isInteger(order) && order >= 2 && order <= 20 ? order : 3;
}
