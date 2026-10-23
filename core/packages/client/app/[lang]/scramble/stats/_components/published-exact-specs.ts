import { eventDisplayName } from '@/lib/wca-events';
import { CSTIMER_EVENTS } from '@/lib/cstimer-scramble';
import { downloadCsv } from '@/lib/scramble-dist/download';
import { FIFTEEN_EXACT_HISTOGRAM } from '@/lib/published-puzzle-distributions/fifteen';
import { TWIST_DIST, FACE_DIST } from '@/lib/published-puzzle-distributions/square1';
import { DOMINO_HTM_EXACT_HISTOGRAM, DOMINO_QTM_EXACT_HISTOGRAM } from '@/lib/published-puzzle-distributions/domino';
import { SKEWB_ULTIMATE_EXACT_HISTOGRAM } from '@/lib/published-puzzle-distributions/skewb-ultimate';
import { REDI_PUBLISHED_HISTOGRAM } from '@/lib/published-puzzle-distributions/redi';
import { BICUBE_QTM_EXACT_HISTOGRAM } from '@/lib/published-puzzle-distributions/bicube';
import { CM2_NEUTRAL_HTM_HISTOGRAM, CM2_NEUTRAL_QTM_HISTOGRAM, CM3_NEUTRAL_QTM_HISTOGRAM } from '@/lib/published-puzzle-distributions/cmetrick';
import { CUBOID223_QTM_EXACT_HISTOGRAM } from '@/lib/published-puzzle-distributions/cuboid223';
import { GEAR_SINGLE_EXACT_HISTOGRAM } from '@/lib/published-puzzle-distributions/gear';
import { SUPERFLOPPY_QTM_EXACT_HISTOGRAM } from '@/lib/published-puzzle-distributions/superfloppy';
import { RUBIKS_UFO_FTM_EXACT_HISTOGRAM, RUBIKS_UFO_STM_EXACT_HISTOGRAM } from '@/lib/published-puzzle-distributions/rubiks-ufo';
import { NETBLOCK_UFO_FTM_EXACT_HISTOGRAM, NETBLOCK_UFO_QTM_EXACT_HISTOGRAM } from '@/lib/published-puzzle-distributions/netblock-ufo';
import type { EnumSpec, TrText } from './EnumeratedDistView';

const fifteen = CSTIMER_EVENTS.find(event => event.id === '15p')!;
const domino = CSTIMER_EVENTS.find(event => event.id === '233')!;
const redi = CSTIMER_EVENTS.find(event => event.id === 'redi_cube')!;
const bicube = CSTIMER_EVENTS.find(event => event.id === 'bic')!;
const cm2 = CSTIMER_EVENTS.find(event => event.id === 'cm2')!;
const cm3 = CSTIMER_EVENTS.find(event => event.id === 'cm3')!;
const cuboid223 = CSTIMER_EVENTS.find(event => event.id === '223')!;
const gear = CSTIMER_EVENTS.find(event => event.id === 'gear')!;
const superFloppy = CSTIMER_EVENTS.find(event => event.id === 'sfl')!;

export const PUBLISHED_EXACT_PUZZLES = [
  { id: '15p-exact', zh: `${fifteen.zh}（公开完整分布）`, en: `${fifteen.en} (published full distribution)`, icon: fifteen.iconClass ?? '' },
  { id: 'sq1-twist', zh: `${eventDisplayName('sq1', true)}（切片计步）`, en: `${eventDisplayName('sq1', false)} (twist metric)`, icon: 'event-sq1' },
  { id: 'sq1-face', zh: `${eventDisplayName('sq1', true)}（面转计步）`, en: `${eventDisplayName('sq1', false)} (face-turn metric)`, icon: 'event-sq1' },
  { id: '233-htm-exact', zh: `${domino.zh}（整转等价 · HTM）`, en: `${domino.en} (rotation quotient · HTM)`, icon: domino.iconClass ?? '' },
  { id: '233-qtm-exact', zh: `${domino.zh}（整转等价 · QTM）`, en: `${domino.en} (rotation quotient · QTM)`, icon: domino.iconClass ?? '' },
  { id: 'skewb-ultimate-exact', zh: 'Skewb Ultimate（公开完整分布）', en: 'Skewb Ultimate (published full distribution)', icon: 'puzzle-skewb-ultimate' },
  { id: 'redi-published', zh: `${redi.zh}（作者报告分布）`, en: `${redi.en} (author-reported distribution)`, icon: redi.iconClass ?? '' },
  { id: 'bic-qtm-exact', zh: `${bicube.zh}（QTM）`, en: `${bicube.en} (QTM)`, icon: bicube.iconClass ?? '' },
  { id: 'cm2-neutral-htm', zh: `${cm2.zh}（同向目标 · HTM）`, en: `${cm2.en} (common orientation · HTM)`, icon: cm2.iconClass ?? '' },
  { id: 'cm2-neutral-qtm', zh: `${cm2.zh}（同向目标 · QTM）`, en: `${cm2.en} (common orientation · QTM)`, icon: cm2.iconClass ?? '' },
  { id: 'cm3-neutral-qtm', zh: `${cm3.zh}（同向目标 · QTM）`, en: `${cm3.en} (common orientation · QTM)`, icon: cm3.iconClass ?? '' },
  { id: '223-qtm-exact', zh: `${cuboid223.zh}（QTM）`, en: `${cuboid223.en} (QTM)`, icon: cuboid223.iconClass ?? '' },
  { id: 'gear-single-exact', zh: `${gear.zh}（单次基础转动）`, en: `${gear.en} (single turns)`, icon: gear.iconClass ?? '' },
  { id: 'sfl-qtm-exact', zh: `${superFloppy.zh}（仿制机制 · QTM）`, en: `${superFloppy.en} (imitation · QTM)`, icon: superFloppy.iconClass ?? '' },
  { id: 'rubiks-ufo-ftm-exact', zh: 'Rubik’s UFO（面转计步）', en: 'Rubik’s UFO (face-turn metric)', icon: 'puzzle-rubiks-ufo' },
  { id: 'rubiks-ufo-stm-exact', zh: 'Rubik’s UFO（60° 计步）', en: 'Rubik’s UFO (sixth-turn metric)', icon: 'puzzle-rubiks-ufo' },
  { id: 'netblock-ufo-ftm-exact', zh: 'Netblock UFO（等价类 · FTM）', en: 'Netblock UFO (equivalence classes · FTM)', icon: 'unofficial-ufo' },
  { id: 'netblock-ufo-qtm-exact', zh: 'Netblock UFO（等价类 · QTM）', en: 'Netblock UFO (equivalence classes · QTM)', icon: 'unofficial-ufo' },
] as const;

interface PublishedDistribution {
  histogram: readonly number[];
  sourceStatus?: 'published-unverified';
  countUnit?: TrText;
  metric: TrText;
  scope: TrText;
  references: NonNullable<EnumSpec['references']>;
}

const netblockUfoScope: TrText = {
  zh: 'Jaap Scherphuis 的 Netblock 三球 UFO 完整表，合并整体朝向及三种颜色的统一重标。各等价类所含实体状态数不等；图表与 CSV 概率均对等价类均匀计数，不是固定配色实体态的分布，也不能按同一倍数还原。与本站现有 UFO 模型分开，不连接其预览或求解器。',
  en: 'Jaap Scherphuis’s complete Netblock three-ball UFO table identifies whole rotations and uniform relabelings of the three colours. Classes have unequal numbers of physical states. Chart and CSV probabilities are uniform over classes, not fixed-colour physical states; no constant multiplier recovers that distribution. This is separate from the site’s UFO model and does not use its preview or solver.',
};

const distributions: Record<string, PublishedDistribution> = {
  'netblock-ufo-ftm-exact': {
    histogram: NETBLOCK_UFO_FTM_EXACT_HISTOGRAM,
    countUnit: { zh: '个等价类', en: 'equivalence classes' },
    metric: { zh: '按原作者面转计步（FTM）；一次允许的转动计 1 步，半转也计 1 步。', en: 'The author’s face-turn metric (FTM): each permitted turn costs 1, including half turns.' },
    scope: netblockUfoScope,
    references: [{ href: 'https://www.jaapsch.net/puzzles/ufo.htm', label: { zh: 'Jaap 机制说明与完整联合表', en: 'Jaap’s mechanism description and complete joint table' } }],
  },
  'netblock-ufo-qtm-exact': {
    histogram: NETBLOCK_UFO_QTM_EXACT_HISTOGRAM,
    countUnit: { zh: '个等价类', en: 'equivalence classes' },
    metric: { zh: '按原作者四分之一转计步（QTM）；半转计 2 步，其余转动沿用 FTM 的步数。', en: 'The author’s quarter-turn metric (QTM): half turns cost 2; other turns retain their FTM cost.' },
    scope: netblockUfoScope,
    references: [{ href: 'https://www.jaapsch.net/puzzles/ufo.htm', label: { zh: 'Jaap 机制说明与完整联合表', en: 'Jaap’s mechanism description and complete joint table' } }],
  },
  'sfl-qtm-exact': {
    histogram: SUPERFLOPPY_QTM_EXACT_HISTOGRAM,
    metric: { zh: 'QTM：90°、270° 转动计 1 步，180° 计 2 步；允许没有相邻角块的独立棱转动。', en: 'QTM: 90° or 270° turns cost 1; 180° costs 2. An isolated edge may turn without adjacent corners.' },
    scope: {
      zh: 'Jaap Scherphuis 仿制机制完整表，保留配色和固定框架，共 3,041,280 态；HTM 边际与本站 sfl 完整分布一致。官方版本会阻止独立棱转动，属于另一套规则。',
      en: 'Jaap Scherphuis’s complete imitation-mechanism table retains all colours and the fixed frame: 3,041,280 states. Its HTM marginal matches this site’s sfl distribution. The official version blocks isolated-edge turns and follows different rules.',
    },
    references: [{ href: 'https://www.jaapsch.net/puzzles/floppy2.htm', label: { zh: 'Jaap 仿制机制完整联合表', en: 'Jaap’s complete imitation-mechanism joint table' } }],
  },
  'rubiks-ufo-ftm-exact': {
    histogram: RUBIKS_UFO_FTM_EXACT_HISTOGRAM,
    metric: { zh: '面转计步：单层圆盘转任意非零 60° 倍数，或半盘翻转 180°，均计 1 步。', en: 'Face-turn metric: any nonzero multiple-of-60° disc turn or a 180° half-disc flip costs 1.' },
    scope: {
      zh: 'Jaap Scherphuis 的 Rubik’s UFO 完整表：上下圆盘各 6 段，固定一片作参照，消去 12 种整体朝向后为 11! = 39,916,800 态。与本站现有 60,480 态 UFO 模型分开，不连接其预览或求解器。',
      en: 'Jaap Scherphuis’s complete Rubik’s UFO table has two six-segment discs. Fixing one segment removes 12 whole-puzzle orientations, leaving 11! = 39,916,800 states. This is separate from the site’s 60,480-state UFO model and does not use its preview or solver.',
    },
    references: [{ href: 'https://www.jaapsch.net/puzzles/rubufo.htm', label: { zh: 'Jaap 完整表与联合表', en: 'Jaap’s complete tables and joint table' } }, {
      href: 'https://oeis.org/A079819', label: { zh: 'OEIS A079819 计数核对表', en: 'OEIS A079819 count table' },
    }],
  },
  'rubiks-ufo-stm-exact': {
    histogram: RUBIKS_UFO_STM_EXACT_HISTOGRAM,
    metric: { zh: '60° 计步：圆盘每顺转或逆转 60° 计 1 步；半盘翻转 180° 仍计 1 步。', en: 'Sixth-turn metric: each clockwise or counterclockwise 60° disc turn costs 1; a 180° half-disc flip still costs 1.' },
    scope: {
      zh: 'Jaap Scherphuis 的 Rubik’s UFO 完整表：上下圆盘各 6 段，固定一片作参照，消去 12 种整体朝向后为 11! = 39,916,800 态。与本站现有 60,480 态 UFO 模型分开，不连接其预览或求解器。',
      en: 'Jaap Scherphuis’s complete Rubik’s UFO table has two six-segment discs. Fixing one segment removes 12 whole-puzzle orientations, leaving 11! = 39,916,800 states. This is separate from the site’s 60,480-state UFO model and does not use its preview or solver.',
    },
    references: [{ href: 'https://www.jaapsch.net/puzzles/rubufo.htm', label: { zh: 'Jaap 完整表与联合表', en: 'Jaap’s complete tables and joint table' } }, {
      href: 'https://oeis.org/A079820', label: { zh: 'OEIS A079820 计数核对表', en: 'OEIS A079820 count table' },
    }],
  },
  'cm2-neutral-htm': {
    histogram: CM2_NEUTRAL_HTM_HISTOGRAM,
    metric: { zh: 'HTM：整行或整列滚动 90°、180°、270° 均计 1 步。', en: 'HTM: rolling a complete row or column by 90°, 180° or 270° costs 1.' },
    scope: {
      zh: 'Jaap Scherphuis 完整表。目标接受 24 种全部球同向的配色；按统一颜色重标号取商，共 24³/2 = 6,912 类。框架固定，并非整体旋转取商；不同于本站 cm2 的指定配色目标。',
      en: 'Jaap Scherphuis’s complete table accepts all 24 common ball orientations. Uniform colour relabelling gives 24³/2 = 6,912 classes. The frame stays fixed; this is not a frame-rotation quotient or the site’s fixed-colour cm2 target.',
    },
    references: [{ href: 'https://www.jaapsch.net/puzzles/cmetrick.htm', label: { zh: 'Jaap 完整表与 HTM × QTM 联合表', en: 'Jaap’s complete tables and HTM × QTM joint table' } }],
  },
  'cm2-neutral-qtm': {
    histogram: CM2_NEUTRAL_QTM_HISTOGRAM,
    metric: { zh: 'QTM：整行或整列滚动 90°、270° 计 1 步，180° 计 2 步。', en: 'QTM: rolling a complete row or column by 90° or 270° costs 1; 180° costs 2.' },
    scope: {
      zh: 'Jaap Scherphuis 完整表。目标接受 24 种全部球同向的配色；按统一颜色重标号取商，共 24³/2 = 6,912 类。框架固定，并非整体旋转取商；不同于本站 cm2 的指定配色目标。',
      en: 'Jaap Scherphuis’s complete table accepts all 24 common ball orientations. Uniform colour relabelling gives 24³/2 = 6,912 classes. The frame stays fixed; this is not a frame-rotation quotient or the site’s fixed-colour cm2 target.',
    },
    references: [{ href: 'https://www.jaapsch.net/puzzles/cmetrick.htm', label: { zh: 'Jaap 完整表与 HTM × QTM 联合表', en: 'Jaap’s complete tables and HTM × QTM joint table' } }],
  },
  'cm3-neutral-qtm': {
    histogram: CM3_NEUTRAL_QTM_HISTOGRAM,
    metric: { zh: 'QTM：整行或整列滚动 90°、270° 计 1 步，180° 计 2 步。', en: 'QTM: rolling a complete row or column by 90° or 270° costs 1; 180° costs 2.' },
    scope: {
      zh: 'Stefan Pochmann 计算、Jaap 发布的完整表。目标接受 24 种全部球同向的配色；按统一颜色重标号取商，共 24⁸/2⁴ = 6,879,707,136 类。框架固定，并非整体旋转取商；不同于指定配色目标。',
      en: 'Complete table computed by Stefan Pochmann and published by Jaap. All 24 common ball orientations are targets; uniform colour relabelling gives 24⁸/2⁴ = 6,879,707,136 classes. The frame stays fixed, with no frame-rotation quotient or prescribed target colour.',
    },
    references: [{ href: 'https://www.jaapsch.net/puzzles/cmetrick.htm', label: { zh: 'Pochmann 完整表 · Jaap', en: 'Pochmann’s complete table · Jaap' } }],
  },
  '223-qtm-exact': {
    histogram: CUBOID223_QTM_EXACT_HISTOGRAM,
    metric: { zh: 'QTM：U/D 的 90°、270° 转动计 1 步，180° 计 2 步；侧面必须做的 180° 转动仍计 1 步。', en: 'QTM: U/D turns of 90° or 270° cost 1 and U2/D2 cost 2; mandatory side-face 180° turns still cost 1.' },
    scope: {
      zh: 'Jaap Scherphuis 公开完整分布。固定一枚中层块作为参考，共 8! × 3! = 241,920 态，与本站 223 的状态域相同；本表使用 QTM。',
      en: 'Jaap Scherphuis’s published complete distribution fixes one middle-layer piece as reference: 8! × 3! = 241,920 states. It uses the same state space as this site’s 223, with QTM distances.',
    },
    references: [{ href: 'https://www.jaapsch.net/puzzles/cube223.htm', label: { zh: 'Jaap HTM × QTM 完整联合表', en: 'Jaap’s complete HTM × QTM joint table' } }],
  },
  'gear-single-exact': {
    histogram: GEAR_SINGLE_EXACT_HISTOGRAM,
    metric: { zh: 'U/R/F 的一次基础转动或逆转计 1 步（外面 180°、中层 90°）；连续基础转动逐次计步。', en: 'An elementary U/R/F turn or its inverse costs 1 (outer face 180°, middle slice 90°); repeated elementary turns count separately.' },
    scope: {
      zh: 'Jaap Scherphuis 标准齿轮完整表的 Single turns 口径。棱块底座无贴纸，以一角为参考，共 41,472 态；底座有贴纸及 Gear MasterMorphix 版本不在此表范围。',
      en: 'The Single turns metric from Jaap Scherphuis’s complete standard Gear Cube table. Edge bases have no stickers; one reference corner gives 41,472 states. Stickered edge bases and Gear MasterMorphix are outside this table’s scope.',
    },
    references: [{ href: 'https://www.jaapsch.net/puzzles/gearcube.htm', label: { zh: 'Jaap 单次 × 连续转动完整联合表', en: 'Jaap’s complete single × multiple-turn joint table' } }],
  },
  'bic-qtm-exact': {
    histogram: BICUBE_QTM_EXACT_HISTOGRAM,
    metric: { zh: 'QTM：合法的 90°、270° 面转计 1 步，180° 面转计 2 步；被联体块阻挡的转动不允许。', en: 'QTM: legal 90° or 270° face turns cost 1; 180° turns cost 2. Turns blocked by bandaged pieces are forbidden.' },
    scope: {
      zh: 'Jaap Scherphuis 公开完整分布，保留联体固定框架及所有配色：440 种形状 × 7!/2 个偶排列，共 1,108,800 态。不是只忽略配色统计 440 种形状的表。',
      en: 'Jaap Scherphuis’s published complete distribution retains the fixed bandage frame and all piece colours: 440 shapes × 7!/2 even permutations, or 1,108,800 states. This is not the separate table of 440 shapes that ignores colours.',
    },
    references: [{ href: 'https://www.jaapsch.net/puzzles/bandage.htm', label: { zh: 'Jaap 完整表与 HTM × QTM 联合表', en: 'Jaap’s complete tables and HTM × QTM joint table' } }],
  },
  'redi-published': {
    histogram: REDI_PUBLISHED_HISTOGRAM,
    sourceStatus: 'published-unverified',
    metric: { zh: '8 个真实角轴，各顺转或逆转 120° 计 1 步；不包含深切层。', en: 'Eight physical corner axes; either 120° turn costs 1. Deep slices are excluded.' },
    scope: {
      zh: 'Shuang Chen（2017）发布的完整表：12 条棱的偶排列及 8 个固定角的朝向，共 12!/2 × 3⁸ 态。48 种对称只用于计算压缩，计数未除以 48。作者另行暴搜核对了 0–8 步，发帖时仍计划核验更深状态；本站未独立重算全图。',
      en: 'Complete table published by Shuang Chen (2017): even permutations of 12 edges and orientations of eight fixed corners, or 12!/2 × 3⁸ states. The 48 symmetries only compress the computation; counts are not divided by 48. The author separately brute-force checked depths 0–8 and planned further deep-state checks when posting. This site has not independently recomputed the full graph.',
    },
    references: [{ href: 'https://www.speedsolving.com/threads/redi-cube-discussion-and-help.65452/post-1263980', label: { zh: 'Chen 原始计算与完整表', en: 'Chen’s original computation and complete table' } }],
  },
  '233-htm-exact': {
    histogram: DOMINO_HTM_EXACT_HISTOGRAM,
    metric: { zh: 'HTM：U/D 的 90°、180°、270° 转动及四个侧面的 180° 转动均计 1 步。', en: 'HTM: U/D turns of 90°, 180° or 270°, and 180° turns of the four side faces, each cost 1.' },
    scope: {
      zh: 'Jaap Scherphuis 公开完整分布。中心朝向不可见；固定白中心朝上后，绕 U/D 轴的 4 种整体朝向视为相同，共 8!²/4 态。与本站固定坐标的 233 状态域不同。',
      en: 'Jaap Scherphuis’s published complete distribution. Centre orientation is invisible. With the white centre on top, the four whole-puzzle rotations about U/D are identified: 8!²/4 states. This differs from the site’s fixed-frame 233 state space.',
    },
    references: [{ href: 'https://www.jaapsch.net/puzzles/domino.htm', label: { zh: 'Jaap 完整表与 HTM × QTM 联合表', en: 'Jaap’s complete tables and HTM × QTM joint table' } }],
  },
  '233-qtm-exact': {
    histogram: DOMINO_QTM_EXACT_HISTOGRAM,
    metric: { zh: 'QTM：U/D 的 90°、270° 转动计 1 步，180° 计 2 步；四个侧面必须做的 180° 转动仍各计 1 步。', en: 'QTM: U/D turns of 90° or 270° cost 1, and U2/D2 cost 2; mandatory 180° turns of the four side faces still cost 1.' },
    scope: {
      zh: 'Jaap Scherphuis 公开完整分布。中心朝向不可见；固定白中心朝上后，绕 U/D 轴的 4 种整体朝向视为相同，共 8!²/4 态。与本站固定坐标的 233 状态域不同。',
      en: 'Jaap Scherphuis’s published complete distribution. Centre orientation is invisible. With the white centre on top, the four whole-puzzle rotations about U/D are identified: 8!²/4 states. This differs from the site’s fixed-frame 233 state space.',
    },
    references: [{ href: 'https://www.jaapsch.net/puzzles/domino.htm', label: { zh: 'Jaap 完整表与 HTM × QTM 联合表', en: 'Jaap’s complete tables and HTM × QTM joint table' } }],
  },
  'skewb-ultimate-exact': {
    histogram: SKEWB_ULTIMATE_EXACT_HISTOGRAM,
    metric: { zh: '4 个固定角轴，各顺转或逆转 120° 计 1 步。', en: 'Four fixed corner axes; either 120° turn costs 1.' },
    scope: {
      zh: 'Thanh Vinh Nguyen 计算、Jaap 发布的完整分布。保留全部角块及 6 个面块的可见朝向，以固定四角组为参考，不再除以 24 种整体朝向；这不是普通 Skewb 的状态域。',
      en: 'Complete distribution computed by Thanh Vinh Nguyen and published by Jaap. All corner and six face-piece orientations are visible. The fixed corner tetrad defines the reference frame; no further division by 24 rotations applies. This is not the ordinary Skewb state space.',
    },
    references: [{ href: 'https://www.jaapsch.net/puzzles/ultimate.htm', label: { zh: 'Nguyen 完整表 · Jaap', en: 'Nguyen’s complete table · Jaap' } }, {
      href: 'https://oeis.org/A079758', label: { zh: 'OEIS A079758 计数核对表', en: 'OEIS A079758 count table' },
    }],
  },
  '15p-exact': {
    histogram: FIFTEEN_EXACT_HISTOGRAM,
    metric: { zh: '相邻一块移入空格计 1 步；多块连续滑动逐块计步。', en: 'Moving one adjacent tile into the blank costs 1; a multi-tile slide counts each tile.' },
    scope: {
      zh: 'Korf 与 Schultze（2005）完整 BFS 的公开计数，目标空格在角落；保留所有块位，不合并旋转。',
      en: 'Published counts from Korf and Schultze’s complete BFS (2005), with the goal blank in a corner. All tile positions are retained; rotations are not identified.',
    },
    references: [{
      href: 'https://ai.dmi.unibas.ch/_files/teaching/fs26/ai/material/ai-b06-korf-schultze-aaai2005.pdf',
      label: { zh: '原论文 · 表 2', en: 'Original paper · Table 2' },
    }, {
      href: 'https://kociemba.org/themen/fifteen/fifteensolver.html',
      label: { zh: 'Kociemba 计数核对表', en: 'Kociemba’s count table' },
    }],
  },
  'sq1-twist': {
    histogram: TWIST_DIST.map(row => row.count),
    metric: { zh: '只数 / 切片；顶底层转动免费。', en: 'Count only / slices; top and bottom layer turns are free.' },
    scope: {
      zh: 'Masonjones（2005）公开完整分布。相差顶底层转动的状态视为相同，保留中层状态；这不是 WCA 12c4 计步。',
      en: 'Masonjones’s published complete distribution (2005). States differing only by top or bottom layer turns are identified; the middle layer is retained. This is not the WCA 12c4 metric.',
    },
    references: [{ href: 'https://www.jaapsch.net/puzzles/square1t.htm', label: { zh: 'Masonjones 完整表 · Jaap', en: 'Masonjones’s complete table · Jaap' } }],
  },
  'sq1-face': {
    histogram: FACE_DIST.map(row => row.count),
    metric: { zh: '(x,0)、(0,y)、/ 各 1 步；双层同时转 (x,y) 为 2 步。', en: '(x,0), (0,y) and / each cost 1; turning both layers (x,y) costs 2.' },
    scope: {
      zh: 'Shuang Chen（2017）公开完整分布，覆盖 3,678 种可切形状、角棱排列和中层状态；只统计切割线不穿过角块的可切位置。这不是 WCA 12c4 计步。',
      en: 'Shuang Chen’s published complete distribution (2017), covering 3,678 twistable shapes, corner and edge permutations, and the middle layer. Only positions with clear slice cuts are counted. This is not the WCA 12c4 metric.',
    },
    references: [{
      href: 'https://www.speedsolving.com/threads/square-one-can-be-solved-in-31-moves-in-face-turn-metric.67363/',
      label: { zh: 'Chen 原始计算与完整表', en: 'Chen’s original computation and complete table' },
    }],
  },
};

export const PUBLISHED_EXACT_SPECS: Record<string, EnumSpec> = Object.fromEntries(PUBLISHED_EXACT_PUZZLES.map(puzzle => {
  const distribution = distributions[puzzle.id];
  const total = distribution.histogram.reduce((sum, count) => sum + count, 0);
  const unit = distribution.countUnit ?? { zh: '态', en: 'states' };
  return [puzzle.id, {
    event: puzzle.id, color: 'var(--accent)', seriesName: puzzle,
    sourceStatus: distribution.sourceStatus,
    spaceLabel: distribution.sourceStatus === 'published-unverified'
      ? { zh: `作者报告分布 · ${total.toLocaleString('en-US')} ${unit.zh}`, en: `Author-reported distribution · ${total.toLocaleString('en-US')} ${unit.en}` }
      : { zh: `公开精确分布 · ${total.toLocaleString('en-US')} ${unit.zh}`, en: `Published exact distribution · ${total.toLocaleString('en-US')} ${unit.en}` },
    moveUnitLabel: distribution.metric,
    meta: () => ({
      zh: `${distribution.scope.zh} 完整计数可下载；全量状态打乱及逐档独立验证样例未导出，柱子不提供样例。`,
      en: `${distribution.scope.en} Complete counts are downloadable; all-state scrambles and independently verified per-depth examples have not been exported, so the bars do not open examples.`,
    }),
    lengthNote: { zh: '这是公开最优距离表；完整分布见「难度」。', en: 'This is a published optimal-distance table; see Difficulty for the complete distribution.' },
    exampleLink: null,
    showBarLabels: distribution.histogram.length <= 20,
    xTickStep: distribution.histogram.length > 40 ? 10 : distribution.histogram.length > 20 ? 5 : 1,
    references: distribution.references,
    source: {
      kind: 'js', counts: Object.fromEntries(distribution.histogram.map((count, depth) => [String(depth), count])),
      examplesByLength: () => ({}), examplesAvailable: false, downloadBin: null,
      downloadAllLabel: { zh: '下载完整分布 (CSV)', en: 'Download complete distribution (CSV)' },
      downloadAll: () => downloadCsv(`${puzzle.id}_distribution.csv`, 'depth,count,probability',
        distribution.histogram.map((count, depth) => `${depth},${count},${count / total}`)),
    },
  } satisfies EnumSpec];
}));
