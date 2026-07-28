/**
 * LSLL case → 后台管道算好的整方 HTM 最优解(表 `lsll_cases`,端点 `/v1/alg/lsll/case/:key`)。
 *
 * 拿它当**打乱**用:最优解取逆就是把这个 case 摆出来的最短转法(≈13 步),而不是现算两阶段解
 * 那 ≈20 步(`./setup`,机器解、不优化步数)。
 *
 * ## 相位:两个出口,别混
 *
 * 库里那条解是**这个 case 的最优** —— 16 个首尾 AUF 像里最短的那个像的解(见 `solver/lsll/solve.mjs`)。
 * 谁最短是算出来才知道的,所以取逆落到的相位是那 16 个里的任意一个,**通常不是** `displayState`
 * (对子摆正、case 图画的那个相位)。于是分两个出口:
 *
 *  - {@link optimalSetup} —— 直接取逆,**最短**,落在哪个相位随缘。给训练器用:它各处的图都是从
 *    实际打乱渲染的,跟着转就行;而且出题本来就带随机 post-AUF,相位早就是随机的。
 *  - {@link setupForPhase} —— 取逆之后再补首尾 AUF 摆到指定相位,长度 +0~2。给 case 页用:
 *    那里的图要和浏览页的缩略图对得上,相位不能飘。
 *
 * 两个出口都本地回放校验(只用 cube333 纯 TS 模型,不碰 cubing.js,一次几十微秒),
 * 验不过一律返 `null`,由调用方退回现算 —— 绝不把摆不出这个 case 的打乱端给用户。
 */
import { invertMoveString } from '@cuberoot/shared/alg-notation';
import { apiUrl } from '@/lib/api-base';
import { applyAlg, extractLsll, solvedCube, type LsllState } from './cube333';
import { canonicalKey, keyToString, packState } from './model';

export interface LsllOptimal {
  /** 摆出这个 case 的**最短**打乱(= 最优解取逆)。相位不保证是展示相位。 */
  setup: string;
  /** 最优解本身,连同它的步数 —— 训练器「揭示」和 case 页都直接用。 */
  alg: string;
  htm: number;
}

/**
 * 这条解是不是「**case 的**最优」而非某个代表元的最优。
 *
 * 判据:首招和末招都不是 U 系转动。是的话剥掉就得到同一条 ⟨U⟩·S·⟨U⟩ 双陪集里更短的成员,
 * 与「最短」矛盾 —— 所以这是充要的等价判据,不是启发式。
 *
 * 求解管道拿它当唯一的正确性闸门(`solver/lsll/solve.mjs` 逐条断言、`export_cases.mjs` 灌库前
 * 整表复核)。那两处是 .mjs 引不过去,**改这里必须同步改那两处**;判据本身由
 * `tests/lsll_optimal.test.ts` 钉住。
 *
 * 页面用它判「这条是不是新口径的数据」:2026-07-28 之前回填的按展示相位算,59% 过不了。
 */
export function orbitMinimal(alg: string): boolean {
  return !!alg && !/^U[2']?(\s|$)|(^|\s)U[2']?$/.test(alg.trim());
}

/** 最优解取逆 → 打乱字符串。记号认不出返 `null`。 */
function invertToSetup(alg: string): string | null {
  if (!alg) return null;
  try {
    // 取逆把半圈写成 `-2`(渲染成 `F2'`)—— 归一回 `F2`,与 setup 的写法一致。
    return invertMoveString(alg).replace(/2'/g, '2');
  } catch {
    return null;
  }
}

/**
 * 最优解 → 摆出这个 case 的**最短**打乱。只校验 case 对不对(canonical key),不管相位。
 * 破坏了十字/前三槽、或落到别的 case,一律返 `null`。
 */
export function optimalSetup(alg: string, key: number): string | null {
  const setup = invertToSetup(alg);
  if (setup === null) return null;
  const check = extractLsll(applyAlg(solvedCube(), setup));
  if ('broken' in check || canonicalKey(check.state) !== key) return null;
  return setup;
}

const AUF = ['', 'U', 'U2', "U'"];
const U_TOKEN = /^U(2|')?$/;
const QUARTER: Record<string, number> = { U: 1, U2: 2, "U'": 3 };
const TURN = ['', 'U', 'U2', "U'"];

/**
 * 把 AUF 接到打乱首尾。紧邻那一端本来就是 U 系时**按角度合并**,不硬拼出 `U U` / `U' U`
 * 这种物理上等价却读着别扭的写法(与 `lib/trainer-scramble` 的 `joinWithAufMerge` 同一条规矩,
 * 这里只处理 U 系所以自带一份 8 行的,免得为它把 i18n 那一串依赖拖进这个轻量模块)。
 */
function joinAuf(pre: string, base: string, post: string): string {
  const t = base.split(/\s+/).filter(Boolean);
  if (pre && t.length && U_TOKEN.test(t[0])) t.splice(0, 1, TURN[(QUARTER[pre] + QUARTER[t[0]]) % 4]);
  else if (pre) t.unshift(pre);
  if (post && t.length && U_TOKEN.test(t[t.length - 1])) t.splice(-1, 1, TURN[(QUARTER[t[t.length - 1]] + QUARTER[post]) % 4]);
  else if (post) t.push(post);
  return t.filter(Boolean).join(' ');
}

/**
 * 最优解 → 摆到 `want` 这个相位的打乱(`want` 一般是 {@link displayState})。
 *
 * 最优解取逆落在同一条 ⟨U⟩·S·⟨U⟩ 双陪集的某个像上,`want` 是同一条陪集里的另一个像 ⇒ 一定存在
 * 一对首尾 AUF 把它接过去,16 种逐个回放取匹配的。长度比最短多 0~2 步,换的是「图不会飘」。
 * (U 碰不到 DFR / FR,补 AUF 不会把最后一槽转出去。)
 */
export function setupForPhase(alg: string, want: LsllState): string | null {
  const base = invertToSetup(alg);
  if (base === null) return null;
  const target = packState(want);
  for (const pre of AUF) {
    for (const post of AUF) {
      const cand = joinAuf(pre, base, post);
      const back = extractLsll(applyAlg(solvedCube(), cand));
      if (!('broken' in back) && packState(back.state) === target) return cand;
    }
  }
  return null;
}

/** 同一个 key 的并发请求合成一发;`null` = 问过了没有(未回填 / 端点不在),别再问第二遍。 */
const CACHE = new Map<number, LsllOptimal | null>();
const INFLIGHT = new Map<number, Promise<LsllOptimal | null>>();

async function load(key: number): Promise<LsllOptimal | null> {
  let d: { status?: string; htm?: number; algs?: unknown };
  try {
    const r = await fetch(apiUrl(`/v1/alg/lsll/case/${keyToString(key)}`));
    // 404 = 这个环境没部署这个端点;非 ok 一律当「没有」,调用方自己现算。
    if (!r.ok) return null;
    d = await r.json();
  } catch {
    return null;
  }
  const alg = d.status === 'ok' && Array.isArray(d.algs) ? String(d.algs[0] ?? '') : '';
  const setup = optimalSetup(alg, key);
  if (!setup) return null;
  return { setup, alg, htm: typeof d.htm === 'number' ? d.htm : alg.split(/\s+/).filter(Boolean).length };
}

/**
 * 一批 case 的最优步数,**只要 htm 不要解**(端点 `/v1/alg/lsll/htm`)。
 *
 * 用途只有一个:训练器在一条两步路线的 ≤4 个 mid-AUF 变体里挑最短的那个 case
 * (`./trainer-set` 的 `loadLsllCases`)。挑完才需要那一个 case 的解,那时走
 * {@link lsllOptimal} 逐条拉 —— 所以这里不带 alg,一轮 1,208 个 key 也就几 KB。
 *
 * **没回填到的 key 不会出现在返回的 Map 里**,调用方自己决定怎么退(训练器退回 mid-AUF = 0)。
 * 整批请求失败时同样什么都不返回,而且**不写进缓存** —— 网络抖一下不该让这一整场都降级。
 */
const HTM_CACHE = new Map<number, number | null>();
const HTM_CHUNK = 256;   // 与 server 的 HTM_MAX_KEYS 对齐;256 × ≤9 字符 ≈ 2KB URL,离头部上限很远

export async function lsllHtmBatch(keys: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const want: number[] = [];
  for (const k of new Set(keys)) {
    const hit = HTM_CACHE.get(k);
    if (hit === undefined) want.push(k);
    else if (hit !== null) out.set(k, hit);
  }
  want.sort((a, b) => a - b);   // 切批稳定 ⇒ 同一轮每次生成同样的 URL,共享层缓存才命中
  const chunks: number[][] = [];
  for (let i = 0; i < want.length; i += HTM_CHUNK) chunks.push(want.slice(i, i + HTM_CHUNK));
  await Promise.all(chunks.map(async (chunk) => {
    let got: Record<string, unknown> | null = null;
    try {
      const r = await fetch(apiUrl(`/v1/alg/lsll/htm?keys=${chunk.map(keyToString).join(',')}`));
      if (r.ok) got = ((await r.json()) as { htm?: Record<string, unknown> }).htm ?? {};
    } catch {
      got = null;
    }
    if (!got) return;
    for (const k of chunk) {
      const v = got[keyToString(k)];
      const n = typeof v === 'number' ? v : null;
      HTM_CACHE.set(k, n);
      if (n !== null) out.set(k, n);
    }
  }));
  return out;
}

/**
 * 这个 case 的最优解 + 最短打乱。还没回填 / 拿不到 / 验不过都返 `null`,
 * 调用方退回 `./setup` 现算。
 */
export function lsllOptimal(key: number): Promise<LsllOptimal | null> {
  const hit = CACHE.get(key);
  if (hit !== undefined) return Promise.resolve(hit);
  const flying = INFLIGHT.get(key);
  if (flying) return flying;
  const p = load(key)
    .catch(() => null)
    .then((v) => { CACHE.set(key, v); INFLIGHT.delete(key); return v; });
  INFLIGHT.set(key, p);
  return p;
}
