/**
 * 站长那张 1LLL Google Sheet 的**公式记号**解析器。
 *
 * 表和站上 /sim 说的是同一种语言(见 app/[lang]/sim/engine/hands/FINGERTRICKS.md),
 * 但 cubing.js 解析不了 —— 表里有换握记号、标签、无空格连写、括号重复、以及**散文注释**。
 * 这里把一格 `Self alg`(可能多行)拆成结构化的条目,并给出 cubing.js 能吃的纯 move 串。
 *
 * ⚠ 设计原则:**认不出来的东西一律报错,绝不静默丢**。
 *    3915 行 × 6 个公式列,静默吞掉一个形态就是几十条公式悄悄算错 case。
 *
 * 表里实际出现的全部形态(A2 侦察实测,不是猜的):
 *
 *   换握记号   ↑ U+2191 (1321)   ↓ U+2193 (590)   · U+00B7 (428)
 *              —— 对魔方状态**零作用**,只驱动手部动画。可紧贴(`↑U`)可后随空格(`↑ U`)。
 *   标签       [oh] [ft] [fmc] [big] [key],**逗号复合**:[ft,key] [oh,big,key] …
 *              可紧贴公式(`[key]U'`),可跟在 `=` 后面(`=[oh] x …`)。
 *   `=`        行首 = 上一条公式的**等价写法**(144 行);也会出现在**行中**当分隔符
 *              (`[oh] … z' = (R' U2' R U2) L U' R' U …` 一行写了两条等价公式)。
 *   括号       分组无语义;`(...)2` `(...)3` 是重复;**会嵌套**(`(R U R' U (R U' R' U)2 R U2' R')`)。
 *   无空格连写 `M'L` `ML'` `RL` `U'D'` `R'L'` —— tokenizer 按最长 move 匹配自然切开。
 *   量         `R2` `R2'` `R3`(= R')`L4'`(= 恒等)`U2'` —— 全部 <family><digits><prime?>。
 *   宽层       只有小写 `r l u d f b`,**没有** `Rw` 写法(w 只在散文 `(wyh)` 里出现)。
 *   散文注释   `(by CubeRoot 251028)` `(by RC Hamner)` `(wyh)` —— 括号里含非 move 字符
 *              `from OLL R U R' U …`  —— 前缀
 *              `[oh] table z (…)2 z'` —— 关键词 table
 *              **署名一律丢弃**(站长 2026-07-13 拍板,不进 meta);整行只有署名的行不产出条目。
 *              但**必须先识别再丢** —— 直接喂 tokenizer 会当成 junk 炸掉整条公式。
 *   数据 bug   有极少数行括号不配对 —— 报 error,交给人。
 */

/** move 字母表。注意大写 E/M/S 是中层,小写 rludfb 是宽层,xyz 是转体。 */
const FAMILY = 'RLUDFBrludfbMSExyz';
const MOVE_RE = new RegExp(`^([${FAMILY}])(\\d*)('?)`);
/** ↑ ↓ · —— 对状态零作用 */
export const REGRIP_RE = /[↑↓·]/g;
/** 括号里出现这些字符 ⟹ 它是散文注释,不是分组 */
const NON_MOVE_RE = new RegExp(`[^${FAMILY}0-9'\\s()\\u2191\\u2193\\u00B7]`);
/** 已知的散文关键词(整词) */
const PROSE_WORDS = /\b(?:from OLL|table)\b/g;

/** 把一行公式切成 token 流。junk = 认不出来的东西(必须有人管)。 */
function tokenize(s) {
  const tokens = [];
  const junk = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(') { tokens.push({ t: '(' }); i++; continue; }
    if (c === ')') {
      i++;
      let d = '';
      while (i < s.length && /\d/.test(s[i])) d += s[i++];
      tokens.push({ t: ')', rep: d ? Number(d) : 1 });
      continue;
    }
    const m = MOVE_RE.exec(s.slice(i));
    if (m) { tokens.push({ t: 'm', s: m[0] }); i += m[0].length; continue; }
    let j = i;
    while (j < s.length && !/[\s()]/.test(s[j])) j++;
    junk.push(s.slice(i, j));
    i = j;
  }
  return { tokens, junk };
}

/** 递归展开 `(...)N`(会嵌套)。括号不配对 → 抛。 */
function expand(tokens) {
  let i = 0;
  const walk = (depth) => {
    const out = [];
    while (i < tokens.length) {
      const tk = tokens[i];
      if (tk.t === 'm') { out.push(tk.s); i++; continue; }
      if (tk.t === '(') { i++; const inner = walk(depth + 1); out.push(...inner); continue; }
      if (tk.t === ')') {
        if (depth === 0) throw new Error(`多出一个 ")"`);
        i++;
        return Array.from({ length: tk.rep }, () => out).flat();
      }
    }
    if (depth !== 0) throw new Error(`少一个 ")"`);
    return out;
  };
  return walk(0);
}

/** 散文括号(里面含非 move 字符)的字符区间。落在里面的 `=` 不是分隔符。 */
function proseSpans(s) {
  const spans = [];
  for (const m of s.matchAll(/\(([^()]*)\)/g)) {
    if (NON_MOVE_RE.test(m[1])) spans.push([m.index, m.index + m[0].length]);
  }
  return spans;
}

/**
 * 按 `=` 切段 —— 但**跳过落在散文注释里的 `=`**。
 * 署名里写个 `=`(`(by X = Y)`)就把公式撕成两半、两半都报错、原公式整条丢失。
 * (当前表里 0 行命中;但表是活文档,解析器不能有这种可能。)
 */
function splitOnEquals(line) {
  const spans = proseSpans(line);
  const segs = [];
  let start = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== '=') continue;
    if (spans.some(([a, b]) => i >= a && i < b)) continue;
    segs.push(line.slice(start, i));
    start = i + 1;
  }
  segs.push(line.slice(start));
  return segs;
}

/**
 * 把散文注释从一行里摘掉(署名一律丢弃)。
 *
 * ⚠ 注释**紧贴换握记号**时不能补空格:`↑U` 是右手、`↑ U` 是左手(FINGERTRICKS §2,
 * 「转写/格式化工具不得增删记号周边空格」)。所以把记号一起吃进来再原样吐回去。
 * (当前表里 0 行命中;同上,防的是以后。)
 */
function stripProse(s) {
  return s
    .replace(/([↑↓·]?)\(([^()]*)\)/g, (full, mark, inner) => (NON_MOVE_RE.test(inner) ? mark || ' ' : full))
    .replace(PROSE_WORDS, ' ');
}

/**
 * 解析一格公式(可能多行 \n)。三份产物,各有各的用途,别混:
 *
 * @returns {Array<{raw, text, tags: string[], equiv: boolean, moves: string|null, error: string|null}>}
 *   - `raw`   本段**逐字原文**(含署名)。只给报告 / 排错看。
 *   - `text`  **入库用**。剥掉署名,但换握记号 / 标签 / 记号周边的空格**一个不动**
 *             (手别是靠空白定的 —— 见 FINGERTRICKS §2)。
 *   - `moves` **算状态用**。纯 move 串,空格分隔,cubing.js 能直接 `new Alg(moves)`;
 *             认不出来时为 null 且 `error` 非空。
 *
 *   整行只有署名(`(by CubeRoot)`)的行**不产出条目**。
 */
export function parseAlgCell(cell) {
  if (cell == null) return [];
  const out = [];
  for (const line0 of String(cell).split('\n')) {
    if (!line0.trim()) continue;
    // 行中的 `=` 也是分隔符 —— 一行里写了两条等价公式。第一段是本体,后面的都是等价写法。
    // `raw` 存的是**这一段**的原文(不是整行),入库要它。
    const segs = splitOnEquals(line0);
    segs.forEach((seg, i) => {
      const e = parseOneAlg(seg, i > 0);
      if (e) out.push(e);
    });
  }
  return out;
}

/**
 * `raw` = 本段原文,**原样保留**换握记号 / 标签 / 记号周边的空格(手别是靠空白定的,
 * 见 FINGERTRICKS §2:`↑U` = 右手,`↑ U` = 左手 —— 增删一个空格就改了指法)。
 * 只 trim 首尾:记号落在行尾时后面本就没有字符,手别无从谈起。
 */
function parseOneAlg(seg, equiv) {
  const raw = seg.trim();
  if (!raw) return null;

  // 入库文本:只剥署名。**多空格压成一个是安全的** —— 它既不会把"紧贴"变成"带空格",
  // 也不会反过来,所以 FINGERTRICKS 的手别规则不受影响。
  const text = stripProse(raw).replace(/ {2,}/g, ' ').trim();
  if (!text) return null;   // 整段只是署名 —— 丢掉,不是一条公式

  let s = text;
  const tags = [];
  let m;
  while ((m = /^\[([a-z,]+)\]\s*/.exec(s))) {
    tags.push(...m[1].split(',').map(t => t.trim()).filter(Boolean));
    s = s.slice(m[0].length);
  }

  const base = { raw, text, tags, equiv };
  const { tokens, junk } = tokenize(s.replace(REGRIP_RE, ' '));
  if (junk.length) return { ...base, moves: null, error: `认不出来的记号:${junk.join(' ')}` };

  let moves, warn = null;
  try {
    moves = expand(tokens).join(' ');
  } catch (e) {
    // 表里有极少数行括号漏配对(typo)。括号只有在带重复指数 `(...)N` 时才有语义 ——
    // 没有指数就整个丢掉括号照样是同一条公式。有指数才是真解不了。
    if (tokens.some(t => t.t === ')' && t.rep !== 1)) {
      return { ...base, moves: null, error: `括号不配对且带重复指数,救不回来(${e.message})` };
    }
    moves = tokens.filter(t => t.t === 'm').map(t => t.s).join(' ');
    warn = `括号不配对(${e.message})—— 无重复指数,已丢弃括号照常解析`;
  }
  if (!moves) return { ...base, moves: null, error: '空公式' };
  return { ...base, moves, error: null, ...(warn ? { warn } : {}) };
}

/** 单个公式串 → cubing.js 能吃的 move 串(拿不到就 null) */
export function toMoves(s) {
  const e = parseAlgCell(s);
  return e.length === 1 && e[0].moves ? e[0].moves : null;
}
