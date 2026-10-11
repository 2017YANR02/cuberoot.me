import { ALG_CATALOG, ALG_PUZZLES } from '@cuberoot/shared/alg';
import { EVENT_DISPLAY_EN, EVENT_DISPLAY_ZH } from '@cuberoot/shared/wca-events';
import { timerEventIdFromSelector, timerPuzzleSelection } from '@cuberoot/shared/timer';
import { PUZZLE_EVENT, resolveAlgPuzzle } from '@/app/[lang]/alg/_trainer/events';
import { RECOGNITION_TRAINING_SETS, VIRTUAL_ALG_SET_METADATA } from './training-set-metadata';

export interface TrainingTitle { zh: string; en: string }

export type TrainingTargetKind =
  | 'alg-run' | 'alg-select' | 'alg-library' | 'alg-set' | 'alg-case' | 'alg-simple'
  | 'lsll' | 'lsll-group' | 'lsll-case' | 'lsll-route'
  | 'progress' | 'progress-cases' | 'time-attack'
  | 'cross' | 'roux' | 'skewb' | 'bld' | 'sq1-tool'
  | 'recognize' | 'recognize-guide' | 'sq1-shape-guide' | 'predict' | 'notation'
  | 'color-positions' | 'color-relations' | 'legacy';

export interface TrainingTarget {
  /** Locale-free pathname; query state belongs to the host and is not discarded by navigation. */
  path: string;
  kind: TrainingTargetKind;
  /** Route parameters only. These never contain arbitrary import paths or iframe sources. */
  params: Record<string, string>;
  title: TrainingTitle;
}

export interface TrainingDirectoryItem { path: string; title: TrainingTitle }
export interface TrainingDirectoryGroup {
  id: string;
  title: TrainingTitle;
  eventId?: string;
  items: readonly TrainingDirectoryItem[];
}

interface StaticTrainingRoute extends TrainingTarget {
  group?: string;
  /** Optional query defaults for the directory, independent of the route identity. */
  entryPath?: string;
}

const route = (
  path: string, kind: TrainingTargetKind, zh: string, en: string,
  group?: string, params: Record<string, string> = {}, entryPath?: string,
): StaticTrainingRoute => ({ path, kind, title: { zh, en }, group, params, entryPath });

const BLD_TOOLS = [
  ['edge', '棱块编码', 'Edge codes'], ['corner', '角块编码', 'Corner codes'],
  ['edge-float', '棱块浮动', 'Edge floating'], ['corner-float', '角块浮动', 'Corner floating'],
  ['2e2e', '2e2e', '2e2e'], ['2c2c', '2c2c', '2c2c'],
  ['parity', '奇偶', 'Parity'], ['flip', '翻棱', 'Edge flips'], ['twist', '扭角', 'Corner twists'],
  ['ltct', 'LTCT', 'LTCT'], ['memo', '记忆回忆', 'Memo recall'], ['timer', '盲拧专项计时', 'Blindfold drill timer'],
  ['helper', '编码辅助', 'Memo helper'], ['lookup', '公式查询', 'Algorithm lookup'],
  ['comm', '换位子公式', 'Commutator library'], ['tables', '公式表', 'Algorithm tables'],
  ['sheets', '选手公式表', 'Cuber algorithm sheets'], ['resources', '盲拧资源', 'Blindfold resources'],
  ['readme', '盲拧训练说明', 'Blindfold training guide'],
] as const;

const SQ1_TOOLS = [
  ['algorithm-trainer', '公式训练', 'Algorithm trainer'], ['train', '形状组合练习', 'Shape pair drill'],
  ['parity-game', '奇偶游戏', 'Parity game'], ['inspect', '打乱检查', 'Scramble inspector'],
  ['visualize', '形状过程', 'Shape visualizer'], ['import', '复形公式导入', 'Cubeshape algorithm importer'],
  ['count', '奇偶数位', 'Parity count positions'], ['pbl-finder', 'PBL 高级查找', 'PBL advanced finder'],
  ['karnaukh-notation', 'Karnaukh 记号', 'Karnaukh notation'],
] as const;

const LEGACY_TOOLS = [
  ['alg-trainers', 'alg_trainers', '公式训练器', 'Alg Trainers'],
  ['algTrainer', 'algTrainer', '公式训练', 'Alg Trainer'],
  ['cross_trainer', 'cross_trainer', '十字训练', 'Cross Trainer'],
  ['xcross_trainer', 'xcross_trainer', '拓展十字训练', 'XCross Trainer'],
  ['xxcross_trainer', 'xxcross_trainer', '双拓展十字训练', 'XXCross Trainer'],
  ['pairing_trainer', 'pairing_trainer', '自由配对训练', 'Free Pair Trainer'],
  ['xcross_pairing_trainer', 'xcross_pairing_trainer', '拓展十字自由配对', 'XCross Free Pair Trainer'],
  ['pseudo_xcross_trainer', 'pseudo_xcross_trainer', '伪拓展十字训练', 'Pseudo XCross Trainer'],
  ['pseudo_pairing_trainer', 'pseudo_pairing_trainer', '伪自由配对训练', 'Pseudo Free Pair Trainer'],
  ['eocross_trainer', 'eocross_trainer', 'EO 十字训练', 'EOCross Trainer'],
] as const;

const STATIC_ROUTES: readonly StaticTrainingRoute[] = [
  route('/alg', 'alg-library', '公式库', 'Algorithm library', undefined, { puzzle: '3x3' }),
  route('/alg/progress', 'progress', '学习进度', 'Learning progress', 'learning'),
  route('/alg/progress/cases', 'progress-cases', '情况与薄弱项', 'Cases and weak spots', 'learning'),
  route('/alg/time-attack', 'time-attack', '情况顺序', 'Case order', 'learning'),
  route('/alg/lsll', 'lsll', 'LSLL 选题', 'LSLL selection', 'specialized'),
  route('/alg/lsll/case', 'lsll-case', 'LSLL 情况', 'LSLL case'),
  route('/alg/lsll/route', 'lsll-route', 'LSLL 路线', 'LSLL route'),
  route('/alg/3x3/cross', 'cross', '十字与拓展十字', 'Cross and extended cross', 'specialized'),
  route('/alg/roux', 'roux', '桥式训练', 'Roux training', 'specialized'),
  route('/alg/skewb-trainer', 'skewb', '斜转专项训练', 'Skewb drills', 'specialized'),
  route('/alg/3bld', 'bld', '盲拧训练', 'Blindfold training', undefined, { tool: '' }),
  route('/sq1/cs/name', 'sq1-shape-guide', 'SQ1 形状命名', 'Square-1 shape names'),
  ...BLD_TOOLS.map(([tool, zh, en]) => route(`/alg/3bld/${tool}`, 'bld', zh, en, 'bld', { tool })),
  ...SQ1_TOOLS.map(([tool, zh, en]) => route(`/alg/sq1/${tool}`, 'sq1-tool', zh, en, 'sq1-tools', { tool })),
  ...Object.entries(RECOGNITION_TRAINING_SETS).map(([algSetId, title]) => ({
    ...route(
      algSetId === 'sq1-shape' ? '/sq1/cs/name/train' : `/recognize/${algSetId}`,
      'recognize', title.zh, title.en, 'recognition', { algSetId },
    ),
  })),
  ...['pll', 'oll'].map(algSetId => route(
    `/recognize/${algSetId}/guide`, 'recognize-guide', `${algSetId.toUpperCase()} 识别说明`,
    `${algSetId.toUpperCase()} recognition guide`, undefined, { algSetId },
  )),
  route('/predict', 'predict', '预判训练', 'Lookahead training', 'fundamentals'),
  route('/notation', 'notation', '记号训练', 'Notation training', 'fundamentals', {}, '/notation?train=true'),
  route('/color-test/positions', 'color-positions', '颜色位置训练', 'Colour position training', 'fundamentals'),
  route('/color-test/relations', 'color-relations', '颜色关系训练', 'Colour relationship training', 'fundamentals'),
  ...LEGACY_TOOLS.map(([slug, source, zh, en]) => route(`/${slug}`, 'legacy', zh, en, 'legacy', {
    tool: slug, src: `/tools/${source}/`, trainingGroup: `legacy:${slug}`,
  })),
];

const STATIC_BY_PATH = new Map(STATIC_ROUTES.map(item => [item.path, item]));

const SPECIAL_GROUPS: readonly Omit<TrainingDirectoryGroup, 'items'>[] = [
  { id: 'specialized', title: { zh: '专项训练', en: 'Specialized training' } },
  { id: 'recognition', title: { zh: '识别训练', en: 'Recognition' } },
  { id: 'fundamentals', title: { zh: '预判与基础训练', en: 'Lookahead and fundamentals' } },
  { id: 'bld', title: { zh: '盲拧训练与工具', en: 'Blindfold training and tools' }, eventId: '333bf' },
  { id: 'sq1-tools', title: { zh: 'SQ1 专项与工具', en: 'SQ1 drills and tools' }, eventId: 'sq1' },
  { id: 'learning', title: { zh: '学习记录', en: 'Learning records' } },
  { id: 'legacy', title: { zh: '旧版训练器', en: 'Legacy trainers' } },
];

/** Every formula set comes from the existing catalog; no second algorithm list is maintained. */
export const TRAINING_DIRECTORY: readonly TrainingDirectoryGroup[] = [
  ...ALG_PUZZLES.map(puzzle => ({
    id: `alg:${puzzle}`,
    eventId: PUZZLE_EVENT[puzzle],
    title: {
      zh: EVENT_DISPLAY_ZH[PUZZLE_EVENT[puzzle]] ?? puzzle,
      en: EVENT_DISPLAY_EN[PUZZLE_EVENT[puzzle]] ?? puzzle,
    },
    items: [
      ...ALG_CATALOG[puzzle].map(meta => ({
        path: `/alg/${puzzle}/${meta.slug}/select`, title: { zh: meta.zh, en: meta.en },
      })),
      ...VIRTUAL_ALG_SET_METADATA.filter(meta => meta.puzzle === puzzle).map(meta => ({
        path: `/alg/${puzzle}/${meta.slug}/run`, title: meta.meta,
      })),
      ...(ALG_CATALOG[puzzle].length > 1 ? [{
        path: `/alg/${puzzle}/mix/select`, title: { zh: '混合公式集', en: 'Mixed sets' },
      }] : []),
    ],
  })),
  ...SPECIAL_GROUPS.map(group => ({
    ...group,
    items: STATIC_ROUTES.filter(item => item.group === group.id).map(item => ({
      path: item.entryPath ?? item.path, title: item.title,
    })),
  })),
];

/** The actual puzzle of a trainer; null denotes a cross-project tool or record view. */
export function trainingEventForTarget(target: TrainingTarget): string | null {
  const puzzle = resolveAlgPuzzle(target.params.puzzle ?? '');
  if (puzzle) return timerEventIdFromSelector(PUZZLE_EVENT[puzzle]);
  switch (target.kind) {
    case 'bld': return '333bld';
    case 'skewb': return 'skewb';
    case 'sq1-tool':
    case 'sq1-shape-guide': return 'sq1';
    case 'recognize': return target.params.algSetId === 'sq1-shape' ? 'sq1' : '333';
    case 'legacy': return ['alg-trainers', 'algTrainer'].includes(target.params.tool) ? null : '333';
    case 'cross':
    case 'roux':
    case 'lsll':
    case 'lsll-group':
    case 'lsll-case':
    case 'lsll-route':
    case 'recognize-guide':
    case 'predict':
    case 'notation':
    case 'color-positions':
    case 'color-relations': return '333';
    default: return null;
  }
}

/** Existing scramble subtypes still belong to the same project in the training menu. */
export function trainingPuzzleForEvent(event: string): string {
  const id = timerEventIdFromSelector(event) ?? '333';
  if (id === 'eg1' || id === 'eg2') return '222';
  if (id === '333oh' || id === '333fm' || id === '333ni') return '333';
  if (id === '333mbld') return '333bld';
  return timerPuzzleSelection(id).puzzle;
}

/** Filter the complete directory by the single project picker, without a second project menu. */
export function trainingDirectoryForEvent(event: string): readonly TrainingDirectoryGroup[] {
  const puzzle = trainingPuzzleForEvent(event);
  return TRAINING_DIRECTORY.map(group => ({
    ...group,
    items: group.items.filter(item => {
      const target = resolveTrainingTarget(item.path);
      const trainingEvent = target ? trainingEventForTarget(target) : null;
      return trainingEvent === null || trainingEvent === puzzle;
    }),
  })).filter(group => group.items.length > 0);
}

/** Only syntactically safe, same-site paths enter the closed component route table. */
function pathParts(input: string): { path: string; parts: string[] } | null {
  if (!input.startsWith('/') || input.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(input)) return null;
  const pathname = input.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  let parts: string[];
  try { parts = pathname.split('/').slice(1).map(decodeURIComponent); } catch { return null; }
  if (parts[0] === 'zh' || parts[0] === 'en') parts = parts.slice(1);
  if (parts.some(part => !part || part === '.' || part === '..' || /[/\\?#\u0000-\u001f\u007f]/.test(part))) return null;
  return { path: `/${parts.map(encodeURIComponent).join('/')}`, parts };
}

function target(path: string, kind: TrainingTargetKind, title: TrainingTitle, params: Record<string, string> = {}): TrainingTarget {
  return { path, kind, title, params };
}

/**
 * Resolve route identity without fetching cases or running trainers. Queries are handled by
 * the host; dynamic case/group slugs stay data, never become module names or iframe URLs.
 */
export function resolveTrainingTarget(input: string): TrainingTarget | null {
  const parsed = pathParts(input);
  if (!parsed) return null;
  const { path, parts } = parsed;
  const fixed = STATIC_BY_PATH.get(path);
  if (fixed) return target(path, fixed.kind, fixed.title, { ...fixed.params });

  if (parts[0] !== 'alg') return null;
  if (parts[1] === 'lsll' && parts.length === 3) {
    return target(path, 'lsll-group', { zh: 'LSLL 分组', en: 'LSLL group' }, { group: parts[2] });
  }

  const puzzle = resolveAlgPuzzle(parts[1] ?? '');
  if (!puzzle) return null;
  if (parts.length === 2) return target(path, 'alg-library', {
    zh: EVENT_DISPLAY_ZH[PUZZLE_EVENT[puzzle]] ?? puzzle,
    en: EVENT_DISPLAY_EN[PUZZLE_EVENT[puzzle]] ?? puzzle,
  }, { puzzle });

  const set = parts[2];
  // Preserve the shared Cross route under both supported puzzle spellings.
  if (puzzle === '3x3' && set === 'cross' && parts.length === 3) {
    const cross = STATIC_BY_PATH.get('/alg/3x3/cross')!;
    return target(path, cross.kind, cross.title);
  }
  const meta = ALG_CATALOG[puzzle].find(item => item.slug === set);
  const virtual = VIRTUAL_ALG_SET_METADATA.find(item => item.puzzle === puzzle && item.slug === set);
  const isMix = set === 'mix';
  if (!meta && !virtual && !isMix) return null;
  const title = meta ? { zh: meta.zh, en: meta.en } : virtual?.meta ?? { zh: '混合公式集', en: 'Mixed sets' };
  const params = { puzzle, set };
  if (parts.length === 3 && meta) return target(path, 'alg-set', title, params);
  if (parts.length !== 4) return null;
  const leaf = parts[3];
  if (leaf === 'run') return target(path, 'alg-run', title, params);
  if (leaf === 'select' && !virtual) return target(path, 'alg-select', title, params);
  if (!meta) return null;
  // This static route currently exists only for the ZBLL condensed reference.
  if (leaf === 'simple') return parts[1] === '3x3' && set === 'zbll'
    ? target(path, 'alg-simple', title, params)
    : null;
  return target(path, 'alg-case', title, { ...params, subgroup: leaf, slug: leaf });
}
