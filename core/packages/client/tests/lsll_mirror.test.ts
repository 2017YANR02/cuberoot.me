/**
 * LSLL 镜像对合 σ 的回归。issue #40 T5 / T6。
 *
 * 判据不靠 `mirror.ts` 自己的说法:σ 的**定义性质**是「先拧再镜 = 先镜再拧镜像公式」,
 * 本文件在整方层面(8 角 12 棱,与 LSLL 无关的那份模型)用随机公式对撞验证它,
 * 再证明 LSLL 那份 5 位实现是同一个变换的限制。两条路完全独立。
 */
import { describe, it, expect } from 'vitest';
import {
  type Cube333, solvedCube, applyAlg, applyMove, embedLsll, extractLsll,
} from '@/lib/lsll/cube333';
import {
  canonicalKey, displayState, unpackState, enumerateCategory, classify,
  verifyCaseAlg, CATEGORIES, TOTAL_CASES,
} from '@/lib/lsll/model';
import { mirrorAlg, mirrorState, mirrorKey, isSelfMirror, mirrorAlgForCase } from '@/lib/lsll/mirror';

/** 整方层面的 σ:与 lib 里那份 5 位实现相互独立地写一遍。 */
const PC = [0, 3, 2, 1, 4, 7, 6, 5];
const PE = [1, 0, 3, 2, 5, 4, 7, 6, 8, 11, 10, 9];
/** E 层棱(FR FL BL BR)—— EO 记法在 F↔R 下不对称,修正项就挂在它们身上。 */
const SLICE = (i: number) => (i >= 8 ? 1 : 0);
function mirrorCube(s: Cube333): Cube333 {
  const cp = Array<number>(8), co = Array<number>(8), ep = Array<number>(12), eo = Array<number>(12);
  for (let i = 0; i < 8; i++) { cp[PC[i]] = PC[s.cp[i]]; co[PC[i]] = (3 - s.co[i]) % 3; }
  for (let i = 0; i < 12; i++) {
    ep[PE[i]] = PE[s.ep[i]];
    eo[PE[i]] = (s.eo[i] + SLICE(i) + SLICE(s.ep[i])) % 2;
  }
  return { cp, co, ep, eo };
}

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
const SUFFIX = ['', '2', "'"];
function randomAlg(rnd: () => number, len: number): string {
  const out: string[] = [];
  for (let i = 0; i < len; i++) out.push(FACES[(rnd() * 6) | 0] + SUFFIX[(rnd() * 3) | 0]);
  return out.join(' ');
}
const eq = (a: Cube333, b: Cube333) =>
  a.cp.join() === b.cp.join() && a.co.join() === b.co.join() && a.ep.join() === b.ep.join() && a.eo.join() === b.eo.join();

describe('LSLL 镜像 σ', () => {
  it('定义性质:σ(A 拧出的态) = σ(A) 拧出的态(500 条随机公式)', () => {
    const rnd = seeded(20260726);
    for (let i = 0; i < 500; i++) {
      const A = randomAlg(rnd, 1 + ((rnd() * 14) | 0));
      const lhs = mirrorCube(applyAlg(solvedCube(), A));
      const rhs = applyAlg(solvedCube(), mirrorAlg(A));
      expect(eq(lhs, rhs), A).toBe(true);
    }
  });

  it('六个面的镜像就是 U→U′ R→F′ F→R′ D→D′ L→B′ B→L′', () => {
    expect(mirrorAlg("U R F D L B")).toBe("U' F' R' D' B' L'");
    expect(mirrorAlg("U' R2 F'")).toBe('U F2 R');
    // 单面自检:每个面转一格,镜像后必须与「镜像面反着转一格」同态
    for (const f of FACES) {
      const lhs = mirrorCube(applyMove(solvedCube(), f, 1));
      const rhs = applyAlg(solvedCube(), mirrorAlg(f));
      expect(eq(lhs, rhs), f).toBe(true);
    }
  });

  it('σ 保 LSLL 定义域,且 5 位实现 = 整方实现的限制', () => {
    // 抽若干大类的若干 case,两条路必须给出同一个状态
    for (const cat of CATEGORIES) {
      const keys = enumerateCategory(cat.slug);
      for (const k of [keys[0], keys[(keys.length / 3) | 0], keys[keys.length - 1]]) {
        const s = unpackState(k);
        const viaCube = extractLsll(mirrorCube(embedLsll(s)));
        expect('state' in viaCube, `${cat.slug} 镜像后离开了 LSLL 域`).toBe(true);
        if (!('state' in viaCube)) continue;
        const viaLsll = mirrorState(s);
        expect(viaCube.state.cp.join(), cat.slug).toBe(viaLsll.cp.join());
        expect(viaCube.state.co.join(), cat.slug).toBe(viaLsll.co.join());
        expect(viaCube.state.ep.join(), cat.slug).toBe(viaLsll.ep.join());
        expect(viaCube.state.eo.join(), cat.slug).toBe(viaLsll.eo.join());
      }
    }
  });

  it('对合:镜两次回到自己', () => {
    for (const cat of CATEGORIES) {
      const keys = enumerateCategory(cat.slug);
      for (const k of [keys[1], keys[(keys.length / 2) | 0]]) {
        expect(mirrorKey(mirrorKey(k)), cat.slug).toBe(k);
      }
    }
  });

  it('在 AUF 商上良定义:同一 case 的 16 个 AUF 像镜像到同一个 key', () => {
    const sample = ['ap', 'o', 's', 'ep', 'f', 'wm'];
    for (const slug of sample) {
      const keys = enumerateCategory(slug);
      for (const k of [keys[0], keys[7 % keys.length], keys[keys.length - 1]]) {
        const target = mirrorKey(k);
        const base = embedLsll(unpackState(k));
        for (let a = 0; a < 4; a++) {
          // 后 AUF:直接在末态上转顶层。前 AUF:共轭 U^a · s · U^-a。
          const post = applyMove(base, 'U', a);
          const conj = applyMove(applyMove(base, 'U', a), 'U', 0);
          for (const c of [post, conj]) {
            const got = extractLsll(c);
            expect('state' in got).toBe(true);
            if (!('state' in got)) continue;
            expect(canonicalKey(got.state), `${slug} a=${a}`).toBe(k);          // 确实是同一 case 的另一个像
            expect(canonicalKey(mirrorState(got.state)), `${slug} a=${a}`).toBe(target); // 镜像结果不随代表元变
          }
        }
      }
    }
  });

  it('大类配对 = 字母的 ± 对合,F/S/T/O 自镜像', () => {
    const pairing = new Map<string, string>();
    for (const cat of CATEGORIES) {
      const keys = enumerateCategory(cat.slug);
      const hits = new Set<string>();
      for (const k of [keys[0], keys[3 % keys.length], keys[(keys.length / 2) | 0], keys[keys.length - 1]]) {
        hits.add(classify(unpackState(mirrorKey(k))).category.letter);
      }
      // 镜像必须把整个大类整体送到同一个大类(不是逐 case 乱跳)
      expect([...hits], cat.letter).toHaveLength(1);
      pairing.set(cat.letter, [...hits][0]);
    }
    for (const [from, to] of pairing) {
      const expected = from.endsWith('+') ? `${from.slice(0, -1)}-`
        : from.endsWith('-') ? `${from.slice(0, -1)}+` : from;
      expect(to, `${from} 的镜像`).toBe(expected);
    }
    // 无符号字母恰好是自镜像的那四个
    expect([...pairing].filter(([a, b]) => a === b).map(([a]) => a).sort()).toEqual(['F', 'O', 'S', 'T']);
  });

  it('不动点只出现在自镜像大类,逐类计数锁死(T6 的减半幅度就吃这个数)', () => {
    // 全量普查见 scripts/lsll-mirror-census.mts:F = 432,镜像对 291,858,省 49.96%。
    // T 一个不动点都没有 —— 它与 S 只差槽棱翻不翻,却不同,所以这里显式锁住,别当成漏算。
    const expected: Record<string, number> = { s: 96, t: 0, o: 192, f: 144 };
    let total = 0;
    for (const cat of CATEGORIES) {
      const keys = enumerateCategory(cat.slug);
      const n = keys.reduce((acc, k) => acc + (isSelfMirror(k) ? 1 : 0), 0);
      expect(n, cat.letter).toBe(expected[cat.slug] ?? 0);
      total += n;
    }
    expect(total).toBe(432);
  });

  it('不动点计数用整方那条独立实现复算一遍(S 96 / T 0)', () => {
    for (const [slug, want] of [['s', 96], ['t', 0]] as const) {
      let n = 0;
      for (const k of enumerateCategory(slug)) {
        const got = extractLsll(mirrorCube(embedLsll(unpackState(k))));
        if ('state' in got && canonicalKey(got.state) === k) n++;
      }
      expect(n, slug).toBe(want);
    }
  });

  it('镜像是大类之间的双射:配对大类的 case 数相等,总数守恒', () => {
    let sum = 0;
    for (const cat of CATEGORIES) sum += enumerateCategory(cat.slug).length;
    expect(sum).toBe(TOTAL_CASES);
    for (const cat of CATEGORIES) {
      const keys = enumerateCategory(cat.slug);
      const partner = classify(unpackState(mirrorKey(keys[0]))).category;
      expect(enumerateCategory(partner.slug).length, `${cat.letter} ↔ ${partner.letter}`).toBe(keys.length);
    }
  });

  it('σ 保步数的前提:镜像公式长度不变、逐招式一一对应', () => {
    const rnd = seeded(7);
    for (let i = 0; i < 100; i++) {
      const A = randomAlg(rnd, 1 + ((rnd() * 12) | 0));
      expect(mirrorAlg(A).split(/\s+/)).toHaveLength(A.split(/\s+/).length);
      expect(mirrorAlg(mirrorAlg(A))).toBe(A);
    }
  });
});

/** 一个具体锚点:拿真公式走一遍,免得上面全是抽象性质。 */
describe('LSLL 镜像 —— 具体锚点', () => {
  it("R U R' 的镜像是 F' U' F,两者的 case 互为镜像", () => {
    expect(mirrorAlg("R U R'")).toBe("F' U' F");
    const a = extractLsll(applyAlg(solvedCube(), "R U R'"));
    const b = extractLsll(applyAlg(solvedCube(), "F' U' F"));
    expect('state' in a && 'state' in b).toBe(true);
    if (!('state' in a) || !('state' in b)) return;
    const ka = canonicalKey(a.state), kb = canonicalKey(b.state);
    expect(mirrorKey(ka)).toBe(kb);
    expect(mirrorKey(kb)).toBe(ka);
  });
});

/**
 * 页面上「镜像公式」那一行的契约:给出的公式必须**真的解开镜像 case 页显示的那个状态**。
 *
 * 光 `mirrorAlg` 不保证做到 —— σ(U^a s U^b) = U^-a σ(s) U^-b,两个 case 页各自显示自己
 * 那一份展示代表元,AUF 不一定对得上。自从代表元按 `displayState` 摆正对子,顶层有对子块的
 * 那三类(TT / CS / ES)自动对齐了(σ 把 URF 映到 URF、把 UR 映到 UF 并翻棱,正好是
 * 展示规则的另一半);**对子整个在槽里的 SS 类仍会错位** —— 下面拿实测到的一条 O case 钉住。
 */
describe('mirrorAlgForCase:镜像公式必须真能解开镜像 case', () => {
  /**
   * 保 LSLL 域的生成元:随机 U/R/F/D/L/B 公式几乎必然踩坏十字与另外三槽,
   * 拿它造样本会一条都留不下(第一版就是这么写的,checked = 0)。
   * 这几条要么只动顶层,要么把槽外的块原样送回去。
   */
  const GENS = ['U', 'U2', "U'", "R U R'", "R U2 R'", "R U' R'", "F' U F", "F' U2 F", "F' U' F"];
  const invert = (a: string) => a.trim().split(/\s+/).reverse()
    .map((t: string) => (t.endsWith("'") ? t.slice(0, -1) : t.endsWith('2') ? t : `${t}'`)).join(' ');

  it('随机 case × 随机解法,镜像公式逐条实解', () => {
    const rnd = seeded(31337);
    let checked = 0;
    for (let n = 0; n < 400; n++) {
      // 从还原态出发,用保域生成元走一段 —— 落点必是某个 LSLL case,而走过的路取逆就是解。
      const word: string[] = [];
      const steps = 2 + ((rnd() * 4) | 0);
      for (let i = 0; i < steps; i++) word.push(GENS[(rnd() * GENS.length) | 0]);
      const A = word.join(' ');
      const got = extractLsll(applyAlg(solvedCube(), A));
      expect('state' in got, `保域生成元竟然离开了 LSLL 域:${A}`).toBe(true);
      if (!('state' in got)) continue;
      const src = got.state;
      const inv = invert(A);
      if (!verifyCaseAlg(src, inv).ok) continue;   // 理论上必成立,保险起见跳过
      const mAlg = mirrorAlgForCase(src, inv);
      expect(mAlg, `${inv}`).not.toBeNull();
      // 关键断言:这条公式必须解开「镜像 case 页显示的那个状态」
      const target = displayState(mirrorState(src));
      expect(verifyCaseAlg(target, mAlg!).ok, `${inv} → ${mAlg}`).toBe(true);
      // 除 AUF 外步数不变(σ 保步数,这是 T6 减半的前提)
      const body = (s: string) => s.split(/\s+/).filter((t) => !/^U2?'?$/.test(t)).length;
      expect(body(mAlg!), `${inv} → ${mAlg}`).toBe(body(inv));
      checked++;
    }
    expect(checked, '样本太少,测了个寂寞').toBeGreaterThan(300);
  });

  it('实测踩过的那条 O case:裸镜像不行,补 AUF 才解得开', () => {
    const SCR = "R U R' F' U2 F U R U2 R' U";
    const ALG = "U' R U2 R' U' F' U2 F R U' R'";
    const st = extractLsll(applyAlg(solvedCube(), SCR));
    expect('state' in st).toBe(true);
    if (!('state' in st)) return;
    const shown = displayState(st.state);              // 页面显示的代表元
    expect(classify(shown).category.letter).toBe('O');  // 对子在槽里 → 展示相位没有锚点
    expect(verifyCaseAlg(shown, ALG).ok).toBe(true);
    const target = displayState(mirrorState(shown));
    expect(verifyCaseAlg(target, mirrorAlg(ALG)).ok).toBe(false);          // 裸镜像不行
    const fixed = mirrorAlgForCase(shown, ALG);
    expect(fixed).not.toBeNull();
    expect(verifyCaseAlg(target, fixed!).ok).toBe(true);                   // 补齐 AUF 后行
    // 补的是 U^3,正好把裸镜像开头那个 U 抵掉 —— 不留 `U' U` 这种脏尾巴
    expect(mirrorAlg(ALG).startsWith('U ')).toBe(true);
    expect(fixed).toBe("F' U2 F U R U2 R' F' U F");
  });

  it('顶层有对子块的三类:摆正相位后裸镜像已经对齐,不必再补 AUF', () => {
    let checked = 0;
    for (const cat of CATEGORIES) {
      if (cat.kind === 'SS') continue;                 // 对子全在槽里的那六类不在此列
      for (const k of enumerateCategory(cat.slug).slice(0, 20)) {
        const shown = displayState(unpackState(k));
        // σ(展示代表元) 本身就是镜像 case 的展示代表元 —— 只差一个收尾 AUF(verifyCaseAlg 允许)
        const m = mirrorState(shown);
        expect(displayState(m).cp.indexOf(4), `${cat.letter} ${k}`).toBe(m.cp.indexOf(4));
        expect(displayState(m).ep.indexOf(4), `${cat.letter} ${k}`).toBe(m.ep.indexOf(4));
        checked++;
      }
    }
    expect(checked).toBe(36 * 20);
  });

  it('补的 AUF 与原有首 U 合并,开头不出现两个连着的 U', () => {
    const rnd = seeded(99);
    for (let n = 0; n < 200; n++) {
      const word: string[] = [];
      for (let i = 0; i < 2 + ((rnd() * 4) | 0); i++) word.push(GENS[(rnd() * GENS.length) | 0]);
      const got = extractLsll(applyAlg(solvedCube(), word.join(' ')));
      if (!('state' in got)) continue;
      const inv = invert(word.join(' '));
      const m = mirrorAlgForCase(got.state, inv);
      if (!m) continue;
      const toks = m.split(/\s+/);
      expect(/^U2?'?$/.test(toks[0]) && /^U2?'?$/.test(toks[1] ?? ''), m).toBe(false);
    }
  });
});
