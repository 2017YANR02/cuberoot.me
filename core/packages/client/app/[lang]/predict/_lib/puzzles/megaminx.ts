/**
 * 五魔方(Megaminx)的 /predict 模型。
 *
 * 状态机复用站内那份 tnoodle 移植 `mega_svg`(所有五魔方 2D 打乱图用的同一份,
 * `image[面][格]` 直接就是贴纸 id),canonical 面序也就是它的
 * `U BL BR R F L D DR DBR B DBL DL` —— 与 `lib/puzzle-image` 的 canonical sid 空间同构,
 * 所以块分组表 `PIECE_GROUPS.megaminx`、引擎贴纸直映表 `ENGINE_SID_MAP.megaminx` 都能
 * 直接查。
 *
 * ## 记号:题面用魔友那套面名,喂引擎前翻一次
 *
 * 这是**唯一**一个题面记号 ≠ 引擎记号的拼图。`/sim` 的五魔方是 cubing.js
 * puzzle-geometry 的十二面体,它给下半球那 5 个面取的名字是 `C A I BF E` —— 对着盘面
 * 认不出是哪一面。所以题面收的是魔友通用的 `U F R L BL BR D DR DL DBR DBL B`,
 * `engineMove` 在喂给引擎播动画之前翻成 PG 名。
 *
 * 两套面名的对应**推出来,不手抄**:`ENGINE_SID_MAP` 里每个面的中心贴纸
 * (`${面}10` → `center{e}:{e}`)直接给出面的对应;转向则拿 canonical 的一次转动去比
 * 引擎的角块 5-循环(`FACE_CORNERS` 的环序,+1 = 环位 i→i+1),同一面上每个角都得投
 * 同一票,否则当场抛。(tests/predict_puzzles.test.ts 再拿引擎几何把整套逐格核对。)
 */
import {
  megaSolvedState, megaTurnFace, MEGA_FACE_NAMES, MEGA_STICKERS_PER_FACE,
  type MegaFaceKey, type MegaState,
} from '@/app/[lang]/scramble/gen/_svg/mega_svg';
import {
  FACE_NAME as ENGINE_FACE_NAME, FACE_CORNERS, FACE_NORMAL,
} from '@/app/[lang]/sim/engine/mega/megaState';
import { PIECE_GROUPS, ENGINE_SID_MAP } from '@/lib/puzzle-image/puzzle-mask';
import { megaColor } from '../colors';
import {
  CUSTOM_MOVES_MAX, groupsFromSids, normalizeQuotes,
  type MoveInputResult, type PredictPuzzle,
} from './types';

const FACES = MEGA_FACE_NAMES;
const PER_FACE = MEGA_STICKERS_PER_FACE;
const TOTAL = FACES.length * PER_FACE;

/** 面内槽 10 = 中心(mask-core 头注:0..9 是外圈楔形,10 是中心)。 */
const CENTER_SLOT = 10;

/**
 * 随机题面只出**上半球**那 6 个面。
 *
 * 十二面体一共 12 个面,全放进去出的题基本是「盯着背面猜」;而魔友练五魔方 F2L /
 * 预判本来就只在 `R U F L BL BR` 这一圈里转。自己输入的公式不受这条限制(12 个面
 * 都收),只是随机出题不往背面跑。
 */
const RANDOM_FACES: readonly MegaFaceKey[] = ['U', 'BL', 'BR', 'R', 'F', 'L'];

const FACE_NAME: Record<MegaFaceKey, { zh: string; en: string }> = {
  U:   { zh: '顶',     en: 'Up' },
  BL:  { zh: '左后',   en: 'Back-left' },
  BR:  { zh: '右后',   en: 'Back-right' },
  R:   { zh: '右',     en: 'Right' },
  F:   { zh: '前',     en: 'Front' },
  L:   { zh: '左',     en: 'Left' },
  D:   { zh: '底',     en: 'Down' },
  DR:  { zh: '右下',   en: 'Down-right' },
  DBR: { zh: '右后下', en: 'Down-back-right' },
  B:   { zh: '后',     en: 'Back' },
  DBL: { zh: '左后下', en: 'Down-back-left' },
  DL:  { zh: '左下',   en: 'Down-left' },
};

const FACE_COLOR = Object.fromEntries(FACES.map((f) => [f, megaColor(f)]));

/** 三字母的面名要排在前面,否则 `DBL` 会先被 `D` 吃掉。撇 = 逆,`2` = 转两格。 */
const TOKEN_RE = /^(DBL|DBR|BL|BR|DL|DR|U|F|L|R|B|D)(2?)('?)$/;

const FACE_INDEX = new Map<string, number>(FACES.map((f, i) => [f, i]));

/** 一个 token → (面序号, 转几格);认不出返回 null。 */
function readToken(token: string): { face: number; turns: number } | null {
  const m = TOKEN_RE.exec(token);
  if (!m) return null;
  const face = FACE_INDEX.get(m[1]);
  if (face === undefined) return null;
  const n = (m[2] === '2' ? 2 : 1) * (m[3] === "'" ? -1 : 1);
  return { face, turns: n };
}

// ─── canonical 面名 ↔ 引擎面名 ──────────────────────────────────────────

const ENGINE_KEY_RE = /^(corner|edge|center)(\d+):(\d+)$/;

/** canonical 贴纸下标 → 引擎 stickerKey(`ENGINE_SID_MAP` 的下标版)。 */
function engineKeyOf(index: number): string {
  const sid = `${FACES[Math.floor(index / PER_FACE)]}${index % PER_FACE}`;
  const key = ENGINE_SID_MAP.megaminx?.[sid];
  if (!key) throw new Error(`[predict] 五魔方贴纸 ${sid} 不在 ENGINE_SID_MAP 里`);
  return key;
}

/**
 * canonical 面序号 → 引擎的 `{面序号, 转向}`(转向 +1 = 引擎裸 token,-1 = 带撇)。
 *
 * 面:该面中心贴纸的 stickerKey 就是 `center{e}:{e}`。
 * 转向:canonical 转一格后,某个角块从 canonical 位置 q 走到了 p;两处的 stickerKey
 * 给出引擎的角块槽位 a → b,而引擎 `dir=+1` 的定义就是 `FACE_CORNERS[e]` 环位 i→i+1。
 * 同一面上 5 个角必须投出同一票。
 */
const ENGINE_FACE: readonly { face: number; dir: 1 | -1 }[] = FACES.map((name, cf) => {
  const cm = ENGINE_KEY_RE.exec(engineKeyOf(cf * PER_FACE + CENTER_SLOT));
  if (!cm || cm[1] !== 'center') throw new Error(`[predict] 五魔方 ${name} 面的中心贴纸不是 center:${cm?.[0]}`);
  const face = Number(cm[2]);

  const st = megaSolvedState();
  megaTurnFace(st, cf, 1);
  const perm = st.flat();

  const ring = FACE_CORNERS[face];
  const votes = new Set<number>();
  for (let p = 0; p < TOTAL; p++) {
    const q = perm[p];
    if (q === p) continue;
    const from = ENGINE_KEY_RE.exec(engineKeyOf(q));
    const to = ENGINE_KEY_RE.exec(engineKeyOf(p));
    if (from?.[1] !== 'corner' || to?.[1] !== 'corner') continue;
    const i = ring.indexOf(Number(from[2]));
    const j = ring.indexOf(Number(to[2]));
    if (i < 0 || j < 0) throw new Error(`[predict] 五魔方 ${name}:角块跑出了引擎面 ${face} 的环`);
    votes.add(j === (i + 1) % 5 ? 1 : i === (j + 1) % 5 ? -1 : 0);
  }
  if (votes.size !== 1 || votes.has(0)) {
    throw new Error(`[predict] 五魔方 ${name} 的转向对不上引擎(票 ${[...votes].join('/')})`);
  }
  return { face, dir: [...votes][0] as 1 | -1 };
});

/** 题面 token → 引擎 token 串(`U2` 是两格,引擎只认一格,所以拆成两个)。 */
export function megaEngineMove(token: string): string {
  const read = readToken(token);
  if (!read) return '';
  const { face, dir } = ENGINE_FACE[read.face];
  const signed = read.turns * dir;
  const one = ENGINE_FACE_NAME[face] + (signed < 0 ? "'" : '');
  return Math.abs(read.turns) === 2 ? `${one} ${one}` : one;
}

// ─── 拼图 ────────────────────────────────────────────────────────────────

export const megaminxPuzzle: PredictPuzzle = {
  id: 'megaminx',
  sim: 'megaminx',
  faces: FACES,
  perFace: PER_FACE,
  faceColor: FACE_COLOR,
  faceName: FACE_NAME,
  cubeLike: false, // 十二面体没有 U/D/L/R/F/B 那一套,24 档拿方朝向对它不成立
  pieces: groupsFromSids(FACES, PER_FACE, PIECE_GROUPS.megaminx),
  kindOf: (piece) => (piece.length === 3 ? 'corner' : piece.length === 2 ? 'edge' : 'center'),
  // 中心不进这一档:面转只把中心在原地转五分之一圈,贴纸一步都不挪,追它是送分题。
  trackable: ['corner', 'edge'],
  // 十二个中心恒在本位 —— 这块板子上唯一读得到方位的锚(压暗保留,其余灰掉)。
  anchors: FACES.map((_, f) => f * PER_FACE + CENTER_SLOT),
  placementMoves: (rnd) => randomTurns(FACES, 25, rnd),
  defaultMoveCount: 3,
  moveCountMax: 20,
  placeholder: "R U R' U'",

  apply(perm, moves) {
    const st: MegaState = [];
    for (let f = 0; f < FACES.length; f++) {
      st.push(perm.slice(f * PER_FACE, (f + 1) * PER_FACE));
    }
    for (const mv of moves) {
      const read = readToken(mv);
      if (read) megaTurnFace(st, read.face, read.turns);
    }
    return st.flat();
  },

  randomMoves: (count, rnd) => randomTurns(RANDOM_FACES, count, rnd),

  notation: {
    zh: "收十二个面名 U F R L BL BR D DR DL DBR DBL B(可加 ' 逆转、2 转两格);"
      + '两层记号 R++ / D-- 这块板子不收。',
    en: "Twelve face names: U F R L BL BR D DR DL DBR DBL B (optional ' for reverse, 2 for a double turn); "
      + 'the two-layer tokens R++ / D-- are not accepted here.',
  },
  parse: parseMegaInput,
  moveFace: (move) => TOKEN_RE.exec(move)?.[1] ?? null,
  engineMove: megaEngineMove,
  // 方位字母写题面那套面名,浮在对应引擎面的法向上 —— 十二个面十二种颜色,不给字母
  // 就只能靠背色认「答案落在 DBL」是哪一面。引擎自带的 megaHints 写的是 PG 名(`C A
  // I BF E`),那份对不上题面。
  hints: FACES.map((letter, cf) => ({ letter, dir: FACE_NORMAL[ENGINE_FACE[cf].face] })),
};

/** 随机面转:相邻两步不同面(同一面连转两次等于合并成一步)。 */
function randomTurns(pool: readonly MegaFaceKey[], count: number, rnd: () => number): string[] {
  const out: string[] = [];
  let last: string | null = null;
  for (let i = 0; i < count; i++) {
    let face: string;
    do { face = pool[Math.floor(rnd() * pool.length)]; } while (face === last);
    last = face;
    out.push(face + (rnd() < 0.5 ? '' : "'"));
  }
  return out;
}

/** 自己输入的公式 → 题面那串。只收十二个面名(可带 `2` / `'`);别的记号当场拒。 */
export function parseMegaInput(text: string): MoveInputResult {
  const tokens = normalizeQuotes(text).trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { moves: null, error: { kind: 'empty' } };
  if (tokens.length > CUSTOM_MOVES_MAX) return { moves: null, error: { kind: 'tooLong', count: tokens.length } };
  const moves: string[] = [];
  for (const raw of tokens) {
    const m = TOKEN_RE.exec(raw);
    if (!m) return { moves: null, error: { kind: 'token', token: raw } };
    moves.push(m[1] + m[2] + m[3]);
  }
  return { moves, error: null };
}
