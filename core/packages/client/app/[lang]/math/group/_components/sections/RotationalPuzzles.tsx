'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

function XYZClassifier() {
  const lang = useLang();
  const [x, setX] = useState(2);
  const [y, setY] = useState(1);
  const [z, setZ] = useState(2);
  const n = x + y + z;
  const f1 = x + y; // face 1 size
  const f2 = y + z;

  // Classification (simplified, from Jaap's table)
  let verdict: { sym: 'S' | 'A' | 'exc' | 'small'; size: number; note: string };
  const fact = (k: number): number => k <= 1 ? 1 : k * fact(k - 1);
  if (f1 < 3 || f2 < 3) verdict = { sym: 'small', size: 0, note: tr({ zh: '需要每面 ≥ 3 个棋子才能转出 3-循环', en: 'need face size ≥ 3 to get a 3-cycle'
}) };
  else if (x === 2 && y === 2 && z === 2) verdict = { sym: 'exc', size: 120, note: tr({ zh: '例外:120 = 5! 个状态 (S₅ 在 6 点上)', en: 'exception: 120 = 5! states (S_5 on 6 points)'
}) };
  else if (x === 1 && y === 3 && z === 2) verdict = { sym: 'exc', size: 120, note: tr({ zh: '同构于 (2,2,2) 例外 — 120 个状态', en: 'isomorphic to (2,2,2) exception — 120 states'
}) };
  else if (f1 % 2 === 0 || f2 % 2 === 0) verdict = { sym: 'S', size: fact(n), note: tr({ zh: '存在偶长面 ⇒ 含奇置换 ⇒ 全 S_n', en: 'face has even length ⇒ contains odd permutation ⇒ full S_n'
}) };
  else verdict = { sym: 'A', size: fact(n) / 2, note: tr({ zh: '两面都是奇长 ⇒ 全是偶置换 ⇒ A_n', en: 'both faces odd length ⇒ only even permutations ⇒ A_n'
}) };

  const cx = 120, cy = 120, r = 55;
  const f1Cells = Array.from({ length: f1 }, (_, i) => {
    const a = (i / f1) * 2 * Math.PI - Math.PI / 2;
    return { x: cx - 38 + r * Math.cos(a), y: cy + r * Math.sin(a), inShared: i < y };
  });
  const f2Cells = Array.from({ length: f2 }, (_, i) => {
    const a = ((f2 - 1 - i) / f2) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + 38 + r * Math.cos(a), y: cy + r * Math.sin(a), inShared: i < y };
  });

  return (
    <div className="gt-xyz">
      <div className="gt-xyz-controls">
        <label>x = {x}</label><input type="range" min={0} max={5} value={x} onChange={e => setX(parseInt(e.target.value, 10))} />
        <label>y = {y}</label><input type="range" min={1} max={4} value={y} onChange={e => setY(parseInt(e.target.value, 10))} />
        <label>z = {z}</label><input type="range" min={0} max={5} value={z} onChange={e => setZ(parseInt(e.target.value, 10))} />
      </div>
      <svg width="240" height="240" viewBox="0 0 240 240">
        <circle cx={cx - 38} cy={cy} r={r} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4 3" />
        <circle cx={cx + 38} cy={cy} r={r} fill="none" stroke="var(--accent-2)" strokeWidth={1.5} strokeDasharray="4 3" />
        {f1Cells.map((p, i) => !p.inShared && (
          <circle key={`a${i}`} cx={p.x} cy={p.y} r={9} fill="var(--accent)" />
        ))}
        {f2Cells.map((p, i) => !p.inShared && (
          <circle key={`b${i}`} cx={p.x} cy={p.y} r={9} fill="var(--accent-2)" />
        ))}
        {Array.from({ length: y }, (_, i) => {
          // shared pieces stacked centrally between faces
          const py = cy - 20 + i * 18;
          return <circle key={`s${i}`} cx={cx} cy={py} r={9} fill="var(--gold)" stroke="var(--ink)" strokeWidth={1} />;
        })}
        <text x={cx - 38} y={cy + r + 18} textAnchor="middle" fontSize={11} fontFamily="var(--mono)" fill="var(--accent)">{lang === 'zh' ? `面 1 · ${f1} 子` : `face 1 · ${f1}`}</text>
        <text x={cx + 38} y={cy + r + 18} textAnchor="middle" fontSize={11} fontFamily="var(--mono)" fill="var(--accent-2)">{lang === 'zh' ? `面 2 · ${f2} 子` : `face 2 · ${f2}`}</text>
      </svg>
      <div className="gt-xyz-verdict">
        <div className="gt-xyz-verdict-label">{tr({ zh: '生成的群', en: 'group generated' })}</div>
        <div className="gt-xyz-verdict-val">
          {verdict.sym === 'S' && <>S<sub>{n}</sub></>}
          {verdict.sym === 'A' && <>A<sub>{n}</sub></>}
          {verdict.sym === 'exc' && <>S<sub>5</sub> (≅ PGL<sub>2</sub>(𝔽<sub>5</sub>))</>}
          {verdict.sym === 'small' && <>{tr({ zh: '太小', en: 'degenerate' })}</>}
        </div>
        <div className="gt-xyz-size">|G| = <strong>{verdict.size}</strong></div>
        <div className="gt-xyz-note">{verdict.note}</div>
      </div>
    </div>
  );
}

// ── §32 Useful Mathematics — Permutation visualiser ─────────────────────

// §27 NEW · Lights Out additions
function TwoFaceTurner() {
  const [x, setX] = useState(2);
  const [y, setY] = useState(1);
  const [z, setZ] = useState(2);
  const n = x + y + z;
  const f1 = x + y;
  const f2 = y + z;

  // pieces: 0..x-1 are face-1 unique, x..x+y-1 are shared, x+y..n-1 are face-2 unique
  // face-1 cycle order (clockwise): unique[0..x-1] then shared[0..y-1]
  // face-2 cycle order (clockwise): shared[y-1..0] then unique[0..z-1]
  const [perm, setPerm] = useState<number[]>(() => Array.from({ length: n }, (_, i) => i));

  // Reset when dimensions change
  useEffect(() => { setPerm(Array.from({ length: x + y + z }, (_, i) => i)); }, [x, y, z]);

  const applyFace1 = useCallback(() => {
    const cycle: number[] = [];
    for (let i = 0; i < x; i++) cycle.push(i);
    for (let j = 0; j < y; j++) cycle.push(x + j);
    setPerm(prev => {
      const next = prev.slice();
      for (let i = 0; i < cycle.length; i++) {
        next[cycle[(i + 1) % cycle.length]] = prev[cycle[i]];
      }
      return next;
    });
  }, [x, y]);

  const applyFace2 = useCallback(() => {
    const cycle: number[] = [];
    for (let j = y - 1; j >= 0; j--) cycle.push(x + j);
    for (let k = 0; k < z; k++) cycle.push(x + y + k);
    setPerm(prev => {
      const next = prev.slice();
      for (let i = 0; i < cycle.length; i++) {
        next[cycle[(i + 1) % cycle.length]] = prev[cycle[i]];
      }
      return next;
    });
  }, [x, y, z]);

  const reset = useCallback(() => setPerm(Array.from({ length: n }, (_, i) => i)), [n]);

  // cycle decomposition of current perm
  const cycles = useMemo(() => {
    const seen = new Array(n).fill(false);
    const out: number[][] = [];
    for (let i = 0; i < n; i++) {
      if (seen[i] || perm[i] === i) { seen[i] = true; continue; }
      const c: number[] = [];
      let j = i;
      while (!seen[j]) { seen[j] = true; c.push(j); j = perm[j]; }
      if (c.length > 1) out.push(c);
    }
    return out;
  }, [perm, n]);

  const sign = cycles.reduce((s, c) => s * (c.length % 2 === 0 ? -1 : 1), 1);

  // layout — two overlapping circles
  const cx1 = 110, cx2 = 230, cyC = 130, R = 70;
  const pieces: Array<{ id: number; x: number; y: number; role: 'a' | 's' | 'b' }> = [];
  for (let i = 0; i < x; i++) {
    const a = ((i + 0.5) / f1) * 2 * Math.PI + Math.PI / 2;
    pieces.push({ id: i, x: cx1 + R * Math.cos(a), y: cyC + R * Math.sin(a), role: 'a' });
  }
  for (let j = 0; j < y; j++) {
    pieces.push({ id: x + j, x: (cx1 + cx2) / 2, y: cyC - (y - 1) * 10 + j * 20, role: 's' });
  }
  for (let k = 0; k < z; k++) {
    const a = ((k + 0.5) / f2) * 2 * Math.PI - Math.PI / 2;
    pieces.push({ id: x + y + k, x: cx2 + R * Math.cos(a), y: cyC + R * Math.sin(a), role: 'b' });
  }

  const labelOf = (i: number) => String.fromCharCode(65 + i); // A, B, C, ...

  return (
    <div className="gt-rot-turner">
      <div className="gt-rot-turner-controls">
        <label>x = {x}<input type="range" min={0} max={4} value={x} onChange={e => setX(parseInt(e.target.value, 10))} /></label>
        <label>y = {y}<input type="range" min={1} max={4} value={y} onChange={e => setY(parseInt(e.target.value, 10))} /></label>
        <label>z = {z}<input type="range" min={0} max={4} value={z} onChange={e => setZ(parseInt(e.target.value, 10))} /></label>
        <div className="gt-rot-turner-btns">
          <button type="button" className="gt-turner-btn" onClick={applyFace1} disabled={f1 < 2}>L<sup>+</sup></button>
          <button type="button" className="gt-turner-btn" onClick={applyFace2} disabled={f2 < 2}>R<sup>+</sup></button>
          <button type="button" onClick={reset} className="gt-rot-reset gt-turner-btn">{tr({ zh: '复位', en: 'reset'
        })}</button>
        </div>
      </div>
      <svg width="340" height="260" viewBox="0 0 340 260" className="gt-rot-turner-svg">
        <circle cx={cx1} cy={cyC} r={R} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="3 3" />
        <circle cx={cx2} cy={cyC} r={R} fill="none" stroke="var(--accent-2)" strokeWidth={1.5} strokeDasharray="3 3" />
        <text x={cx1} y={cyC - R - 8} textAnchor="middle" fontSize={11} fontFamily="var(--mono)" fill="var(--accent)">L · {f1}</text>
        <text x={cx2} y={cyC - R - 8} textAnchor="middle" fontSize={11} fontFamily="var(--mono)" fill="var(--accent-2)">R · {f2}</text>
        {pieces.map(p => {
          // p.id is the slot; perm[slot] is the piece currently sitting there
          const pieceAt = perm[p.id];
          const fill = pieceAt < x ? 'var(--accent)' : pieceAt >= x + y ? 'var(--accent-2)' : 'var(--gold)';
          return (
            <g key={p.id}>
              <circle cx={p.x} cy={p.y} r={13} fill={fill} stroke="var(--ink)" strokeWidth={1} />
              <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fontFamily="var(--mono)" fill="#fff" fontWeight={600}>{labelOf(pieceAt)}</text>
            </g>
          );
        })}
      </svg>
      <div className="gt-rot-turner-info">
        <div className="gt-rot-info-row">
          <span className="gt-rot-info-lbl">{tr({ zh: '当前置换', en: 'current perm'
        })}</span>
          <span className="gt-rot-info-val">
            {cycles.length === 0
              ? tr({ zh: '恒等 e', en: 'identity e'
                                      })
              : cycles.map((c, i) => (
                <span key={i}>({c.map(labelOf).join(' ')})</span>
              ))}
          </span>
        </div>
        <div className="gt-rot-info-row">
          <span className="gt-rot-info-lbl">{tr({ zh: '奇偶性', en: 'parity' })}</span>
          <span className="gt-rot-info-val">{sign === 1 ? '+1 (even)' : '−1 (odd)'}</span>
        </div>
        <div className="gt-rot-info-row">
          <span className="gt-rot-info-lbl">{tr({ zh: '圈型', en: 'cycle type' })}</span>
          <span className="gt-rot-info-val">
            {cycles.length === 0
              ? `1^${n}`
              : (() => {
                const counts: Record<number, number> = {};
                for (const c of cycles) counts[c.length] = (counts[c.length] || 0) + 1;
                const fixed = n - cycles.reduce((s, c) => s + c.length, 0);
                if (fixed > 0) counts[1] = fixed;
                return Object.entries(counts).sort(([a], [b]) => +b - +a).map(([k, v]) => v === 1 ? k : `${k}^${v}`).join(' · ');
              })()}
          </span>
        </div>
      </div>
    </div>
  );
}

// Puzzle zoo: clickable grid of preset puzzles with (x,y,z) decomp and group

// Puzzle zoo: clickable grid of preset puzzles with (x,y,z) decomp and group
type PuzzleSpec = {
  key: string;
  nameZh: string;
  nameEn: string;
  xyz?: [number, number, number];
  group: string;
  order: string;
  blurbZh: string;
  blurbEn: string;
};

const PUZZLE_ZOO: PuzzleSpec[] = [
  {
    key: 'tetrahedral-triv',
    nameZh: '三角面 (1,1,1)',
    nameEn: 'Triangle (1,1,1)',
    xyz: [1, 1, 1],
    group: 'Z_3',
    order: '3',
    blurbZh: '两个 2-长面共享 1 点 — 只能旋转单个共享子,小到没有 3-循环',
    blurbEn: 'Two 2-cycles sharing a point — degenerate; not enough for a 3-cycle'
},
  {
    key: 'tetrahedron-2tip',
    nameZh: 'Pyraminx 两面 (2,1,2)',
    nameEn: 'Pyraminx 2-face (2,1,2)',
    xyz: [2, 1, 2],
    group: 'A_5',
    order: '60',
    blurbZh: '两个 3-循环共享 1 点,生成 5 点上的交错群 — 经典 Pyraminx 局部',
    blurbEn: 'Two 3-cycles sharing 1 point; classical Pyraminx local pattern, yields A_5'
},
  {
    key: 'exceptional-222',
    nameZh: '例外 (2,2,2)',
    nameEn: 'Exceptional (2,2,2)',
    xyz: [2, 2, 2],
    group: 'S_5',
    order: '120',
    blurbZh: '6 子两面,本该 720 元 — 实际只有 120,等同 §30 的 S_5 在 6 点的奇异作用',
    blurbEn: '6 pieces but only 120 reachable — matches §30 exotic S_5 on 6 points'
},
  {
    key: 'exceptional-132',
    nameZh: '例外 (1,3,2)',
    nameEn: 'Exceptional (1,3,2)',
    xyz: [1, 3, 2],
    group: 'S_5',
    order: '120',
    blurbZh: '同 (2,2,2) 同构 — Wilson 滑动版插一个空格就回到他的 7-点反例',
    blurbEn: 'Isomorphic to (2,2,2); inserting a blank recovers Wilson\'s 7-vertex exception'
},
  {
    key: 'impossiball-2face',
    nameZh: 'Impossiball 两面 (3,2,3)',
    nameEn: 'Impossiball 2-face (3,2,3)',
    xyz: [3, 2, 3],
    group: 'A_8',
    order: '20,160',
    blurbZh: '两个 5-长面共享 2 子,8 子全偶 — A_8 是阶为 20160 的单群',
    blurbEn: 'Two 5-cycles share 2 — full A_8, a simple group of order 20160'
},
  {
    key: 'alexstar-2face',
    nameZh: "Alexander's Star (4,1,4)",
    nameEn: "Alexander's Star (4,1,4)",
    xyz: [4, 1, 4],
    group: 'A_9',
    order: '181,440',
    blurbZh: '两面长 5 共享 1 子 — A_9,5 个十二面体面在边上的同构',
    blurbEn: 'Two length-5 faces sharing 1 — A_9; matches an edge-pattern on the dodecahedron'
},
  {
    key: 'big-even',
    nameZh: '偶面 (3,3,3)',
    nameEn: 'Even-face (3,3,3)',
    xyz: [3, 3, 3],
    group: 'S_9',
    order: '362,880',
    blurbZh: '两面长 6 (偶) 共享 3 子 — 偶长面提供奇置换 ⇒ 全 S_9',
    blurbEn: 'Two length-6 (even) faces share 3 — even face contributes odd permutation ⇒ full S_9'
},
  {
    key: 'pyraminx-full',
    nameZh: 'Pyraminx (整体)',
    nameEn: 'Pyraminx (full)',
    group: '(Z_3)^4 ⋊ (A_4 × Z_3^4 / Z_3)',
    order: '75,582,720',
    blurbZh: '4 个尖块 Z_3 朝向 × 6 边块在 A_6 × 朝向约束 × 4 中央 — 见 §15.1 闭式',
    blurbEn: '4 tips Z_3 × 6 edges in A_6 × orientations × 4 centres — see §15.1 closed form'
},
  {
    key: 'skewb',
    nameZh: 'Skewb',
    nameEn: 'Skewb',
    group: 'S_8 × Z_3^4 / (sign·twist)',
    order: '3,149,280',
    blurbZh: '8 角 + 6 面中心,角带朝向 — 4 个对角轴生成,约束总和 ≡ 0',
    blurbEn: '8 corners with twist + 6 centres, 4 diagonal-axis generators, sums vanish'
},
  {
    key: '2x2x2',
    nameZh: '2×2×2',
    nameEn: '2×2×2',
    group: 'Z_3^7 ⋊ S_8 (no parity constraint)',
    order: '3,674,160',
    blurbZh: '只有 8 角,没有棱、 没有中心 — 角朝向和 ≡ 0 (mod 3)',
    blurbEn: '8 corners only, no edges or centres — corner twist sum ≡ 0 (mod 3)'
},
  {
    key: 'megaminx',
    nameZh: 'Megaminx',
    nameEn: 'Megaminx',
    group: '(huge wreath)',
    order: '≈ 1.01 × 10^68',
    blurbZh: '12 个 5-长面 — 三面分类已远超 (x,y,z) 范围,落在 §31.10 wreath product',
    blurbEn: '12 length-5 faces — beyond (x,y,z), naturally a wreath construction (§31.10)'
},
  {
    key: 'square1',
    nameZh: 'Square-1',
    nameEn: 'Square-1',
    group: 'groupoid (not a group)',
    order: '≈ 1.78 × 10^14',
    blurbZh: 'Shape-shifting 让合法移动依赖几何 — 严格说不是群,是 groupoid (见 §15.3)',
    blurbEn: 'Shape-shifting makes legality geometry-dependent — formally a groupoid (cf. §15.3)'
},
];

function PuzzleZoo() {
  const lang = useLang();
  const [active, setActive] = useState<string>('exceptional-222');
  const sel = PUZZLE_ZOO.find(p => p.key === active) ?? PUZZLE_ZOO[0];
  return (
    <div className="gt-rot-zoo">
      <div className="gt-rot-zoo-grid">
        {PUZZLE_ZOO.map(p => (
          <button
            key={p.key}
            type="button"
            className={`gt-rot-zoo-card${active === p.key ? ' is-active' : ''}`}
            onClick={() => setActive(p.key)}
          >
            <div className="gt-rot-zoo-card-name">{lang === 'zh' ? p.nameZh : p.nameEn}</div>
            {p.xyz && <div className="gt-rot-zoo-card-xyz">({p.xyz.join(', ')})</div>}
            <div className="gt-rot-zoo-card-grp">{p.group}</div>
          </button>
        ))}
      </div>
      <div className="gt-rot-zoo-detail">
        <div className="gt-rot-zoo-detail-name">{lang === 'zh' ? sel.nameZh : sel.nameEn}</div>
        {sel.xyz && (
          <div className="gt-rot-zoo-detail-xyz">
            (x, y, z) = ({sel.xyz[0]}, {sel.xyz[1]}, {sel.xyz[2]}) &nbsp; n = {sel.xyz.reduce((a, b) => a + b, 0)}
          </div>
        )}
        <div className="gt-rot-zoo-detail-grp">{sel.group}</div>
        <div className="gt-rot-zoo-detail-order">|G| = {sel.order}</div>
        <div className="gt-rot-zoo-detail-blurb">{lang === 'zh' ? sel.blurbZh : sel.blurbEn}</div>
      </div>
    </div>
  );
}

// Schreier-Sims demo: build a base+strong-generating-set for S_5 step by step

// Schreier-Sims demo: build a base+strong-generating-set for S_5 step by step
function SchreierSimsDemo() {
  const lang = useLang();
  const [step, setStep] = useState(0);
  // We hardcode the trace for the user-facing pair: g1 = (1 2 3 4 5), g2 = (1 2)
  // Base [1,2,3,4]; show orbit sizes 5, 4, 3, 2 ⇒ |S_5| = 5·4·3·2·1 = 120
  const trace = [
    {
      title: tr({ zh: '生成元', en: 'generators' }),
      body: lang === 'zh'
        ? <>g₁ = (1 2 3 4 5),  g₂ = (1 2)。 候选群 G ⊆ S₅</>
        : <>g₁ = (1 2 3 4 5),  g₂ = (1 2). Candidate G ⊆ S₅</>,
      orbit: [1, 2, 3, 4, 5],
      orbitOf: 1,
      gens: ['g₁', 'g₂'],
    },
    {
      title: tr({ zh: '第 1 层:base point = 1', en: 'level 1: base point = 1'
    }),
      body: lang === 'zh'
        ? <>固定 1 的子群 G₁ 由 Schreier 生成元生成。 G/G₁ 轨道:{`{1,2,3,4,5}`} (大小 5)</>
        : <>Stabiliser G₁ of 1 generated by Schreier generators. Orbit of 1: {`{1,2,3,4,5}`} (size 5)</>,
      orbit: [1, 2, 3, 4, 5],
      orbitOf: 1,
      gens: ['g₂', 'g₁ g₂ g₁⁻¹', 'g₁² g₂ g₁⁻²'],
    },
    {
      title: tr({ zh: '第 2 层:base point = 2', en: 'level 2: base point = 2'
    }),
      body: lang === 'zh'
        ? <>G₁ 作用于 {`{2,3,4,5}`},轨道完整 (大小 4)</>
        : <>G₁ acts on {`{2,3,4,5}`}; orbit fills (size 4)</>,
      orbit: [2, 3, 4, 5],
      orbitOf: 2,
      gens: ['(2 3)', '(3 4)', '(4 5)'],
    },
    {
      title: tr({ zh: '第 3 层:base = 3', en: 'level 3: base = 3'
    }),
      body: lang === 'zh' ? <>剩余轨道大小 3</> : <>Remaining orbit size 3</>,
      orbit: [3, 4, 5],
      orbitOf: 3,
      gens: ['(3 4)', '(4 5)'],
    },
    {
      title: tr({ zh: '第 4 层:base = 4', en: 'level 4: base = 4'
    }),
      body: lang === 'zh' ? <>轨道大小 2</> : <>Orbit size 2</>,
      orbit: [4, 5],
      orbitOf: 4,
      gens: ['(4 5)'],
    },
    {
      title: tr({ zh: '终止', en: 'finish'
    }),
      body: lang === 'zh'
        ? <>稳定子链 G ⊃ G₁ ⊃ G₁₂ ⊃ G₁₂₃ ⊃ G₁₂₃₄ = {`{e}`}。 |G| = 5·4·3·2·1 = <strong>120</strong></>
        : <>Stabiliser chain G ⊃ G₁ ⊃ G₁₂ ⊃ G₁₂₃ ⊃ G₁₂₃₄ = {`{e}`}. |G| = 5·4·3·2·1 = <strong>120</strong></>,
      orbit: [],
      orbitOf: 0,
      gens: [],
    },
  ];
  const t = trace[Math.min(step, trace.length - 1)];
  return (
    <div className="gt-rot-ss">
      <div className="gt-rot-ss-head">
        <div className="gt-rot-ss-step">{lang === 'zh' ? `第 ${step} / ${trace.length - 1} 步` : `step ${step} / ${trace.length - 1}`}</div>
        <div className="gt-rot-ss-btns">
          <button type="button" className="gt-ss-btn" onClick={() => setStep(s => Math.max(0, s - 1))}>{tr({ zh: '上一步', en: 'prev' })}</button>
          <button type="button" className="gt-ss-btn" onClick={() => setStep(s => Math.min(trace.length - 1, s + 1))}>{tr({ zh: '下一步', en: 'next' })}</button>
          <button type="button" onClick={() => setStep(0)} className="gt-rot-reset gt-ss-btn">{tr({ zh: '复位', en: 'reset'
        })}</button>
        </div>
      </div>
      <div className="gt-rot-ss-title">{t.title}</div>
      <div className="gt-rot-ss-body">{t.body}</div>
      <div className="gt-rot-ss-orbit">
        {[1, 2, 3, 4, 5].map(i => (
          <span
            key={i}
            className={`gt-rot-ss-pt${t.orbit.includes(i) ? ' is-in' : ''}${i === t.orbitOf ? ' is-base' : ''}`}
          >
            {i}
          </span>
        ))}
      </div>
      {t.gens.length > 0 && (
        <div className="gt-rot-ss-gens">
          {tr({ zh: '当前生成元', en: 'current generators'
        })}: {t.gens.join(',  ')}
        </div>
      )}
    </div>
  );
}

// Wilson sliding: side-by-side 15-puzzle vs Wilson's theta-0 exception

// Wilson sliding: side-by-side 15-puzzle vs Wilson's theta-0 exception
function WilsonSliding() {
  const [mode, setMode] = useState<'cycle' | 'theta' | 'fifteen'>('theta');

  return (
    <div className="gt-rot-wilson">
      <div className="gt-rot-wilson-tabs">
        <button type="button" className={`gt-wilson-tab${mode === 'cycle' ? ' is-active' : ''}`} onClick={() => setMode('cycle')}>
          {tr({ zh: '环 C_n', en: 'cycle C_n'
        })}
        </button>
        <button type="button" className={`gt-wilson-tab${mode === 'theta' ? ' is-active' : ''}`} onClick={() => setMode('theta')}>
          {tr({ zh: 'θ₀ (7 点例外)', en: 'θ₀ (7-point exception)'
        })}
        </button>
        <button type="button" className={`gt-wilson-tab${mode === 'fifteen' ? ' is-active' : ''}`} onClick={() => setMode('fifteen')}>
          {tr({ zh: '15-滑块 (4×4 grid)', en: '15-puzzle (4×4 grid)'
        })}
        </button>
      </div>
      <svg width="320" height="220" viewBox="0 0 320 220" className="gt-rot-wilson-svg">
        {mode === 'cycle' && (() => {
          const N = 8;
          const cx = 160, cy = 110, r = 80;
          const pts = Array.from({ length: N }, (_, i) => {
            const a = (i / N) * 2 * Math.PI - Math.PI / 2;
            return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
          });
          return (
            <g>
              {pts.map((p, i) => {
                const q = pts[(i + 1) % N];
                return <line key={`e${i}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="var(--rule)" strokeWidth={1.5} />;
              })}
              {pts.map((p, i) => (
                <g key={`v${i}`}>
                  <circle cx={p.x} cy={p.y} r={12} fill={i === 0 ? 'var(--bg-muted)' : 'var(--accent)'} stroke="var(--ink)" strokeWidth={1} />
                  <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={10} fontFamily="var(--mono)" fill={i === 0 ? 'var(--ink)' : '#fff'}>{i === 0 ? '◯' : i}</text>
                </g>
              ))}
            </g>
          );
        })()}
        {mode === 'theta' && (() => {
          // theta_0: two paths of length 4 sharing endpoints — 7 vertices, 8 edges
          const top = [{ x: 60, y: 110 }, { x: 110, y: 60 }, { x: 170, y: 50 }, { x: 230, y: 60 }, { x: 280, y: 110 }];
          const bot = [{ x: 110, y: 160 }, { x: 170, y: 170 }, { x: 230, y: 160 }];
          // endpoints shared: top[0], top[4]
          return (
            <g>
              <line x1={top[0].x} y1={top[0].y} x2={top[1].x} y2={top[1].y} stroke="var(--rule)" strokeWidth={1.5} />
              <line x1={top[1].x} y1={top[1].y} x2={top[2].x} y2={top[2].y} stroke="var(--rule)" strokeWidth={1.5} />
              <line x1={top[2].x} y1={top[2].y} x2={top[3].x} y2={top[3].y} stroke="var(--rule)" strokeWidth={1.5} />
              <line x1={top[3].x} y1={top[3].y} x2={top[4].x} y2={top[4].y} stroke="var(--rule)" strokeWidth={1.5} />
              <line x1={top[0].x} y1={top[0].y} x2={bot[0].x} y2={bot[0].y} stroke="var(--rule)" strokeWidth={1.5} />
              <line x1={bot[0].x} y1={bot[0].y} x2={bot[1].x} y2={bot[1].y} stroke="var(--rule)" strokeWidth={1.5} />
              <line x1={bot[1].x} y1={bot[1].y} x2={bot[2].x} y2={bot[2].y} stroke="var(--rule)" strokeWidth={1.5} />
              <line x1={bot[2].x} y1={bot[2].y} x2={top[4].x} y2={top[4].y} stroke="var(--rule)" strokeWidth={1.5} />
              {[...top, ...bot].map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={12} fill={i === 0 ? 'var(--bg-muted)' : (i < 5 ? 'var(--accent)' : 'var(--accent-2)')} stroke="var(--ink)" strokeWidth={1} />
                  <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={10} fontFamily="var(--mono)" fill={i === 0 ? 'var(--ink)' : '#fff'}>{i === 0 ? '◯' : i}</text>
                </g>
              ))}
            </g>
          );
        })()}
        {mode === 'fifteen' && (() => {
          const cells: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
          return (
            <g>
              {cells.map((v, i) => {
                const r = Math.floor(i / 4), c = i % 4;
                const x = 80 + c * 40, y = 30 + r * 40;
                return (
                  <g key={i}>
                    <rect x={x} y={y} width={36} height={36} fill={v === 0 ? 'var(--bg-muted)' : 'var(--accent)'} stroke="var(--ink)" strokeWidth={1} />
                    {v !== 0 && <text x={x + 18} y={y + 23} textAnchor="middle" fontSize={13} fontFamily="var(--mono)" fill="#fff">{v}</text>}
                  </g>
                );
              })}
            </g>
          );
        })()}
      </svg>
      <div className="gt-rot-wilson-caption">
        {mode === 'cycle' && (
          <L
            zh={<>简单环 <TeX src="C_n" />:空格绕一圈给出循环置换 <TeX src="(1\,2\,3\,\cdots\,n)" />。 状态群 = <TeX src="\mathbb{Z}_n" />,而 <em>不是</em> <TeX src="S_n" /> 或 <TeX src="A_n" />。 这是 Wilson 列出的两类非平凡例外之一。</>}
            en={<>Plain cycle <TeX src="C_n" />: the blank around once is the cyclic permutation <TeX src="(1\,2\,3\,\cdots\,n)" />. State group = <TeX src="\mathbb{Z}_n" /> — <em>not</em> <TeX src="S_n" /> or <TeX src="A_n" />. One of Wilson's two non-trivial exception families.</>}
          />
        )}
        {mode === 'theta' && (
          <L
            zh={<>θ₀ 图:Wilson 1974 的唯一散在例外。 7 个点 (1 空格 + 6 棋子),状态群恰好是 <TeX src="PGL_2(\mathbb{F}_5) \cong S_5" /> 阶 120 — 与 (2,2,2)、 (1,3,2) 同构,也是 §30 上那个 S_5 在 6 点的奇异作用。 把它的两个分叉点合并成一个点,就得到 (1,3,2) 旋转拼图。</>}
            en={<>The θ₀ graph: Wilson 1974's unique sporadic exception. 7 vertices (1 blank + 6 tiles), state group <TeX src="PGL_2(\mathbb{F}_5) \cong S_5" /> of order 120 — isomorphic to (2,2,2) and (1,3,2), and to §30's exotic S_5 on 6 points. Merging the two trivalent vertices recovers the (1,3,2) rotational puzzle.</>}
          />
        )}
        {mode === 'fifteen' && (
          <L
            zh={<>15-滑块 (4×4 网格,1 空格)。 Wilson 主定理:此图状态群 = <TeX src="A_{15}" />,所有偶置换可达。 「不可能解」的双子换 (Loyd 1880) = 一个对换 ∉ <TeX src="A_{15}" />,精确印证。</>}
            en={<>The 15-puzzle (4×4 grid, 1 blank). Wilson's main theorem: state group = <TeX src="A_{15}" />, every even permutation reachable. Loyd's "impossible" swap of 14 and 15 is a transposition ∉ <TeX src="A_{15}" /> — the parity proof.</>}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// §32 NEW · Useful math additions
// ═══════════════════════════════════════════════════════════════════════
// ── Pure helpers (shared by §32 widgets) ────────────────────────────────────
/** Parse "2 3 1 5 4" or "(1 2 3)(4 5)" into a 1-indexed permutation array. */

export default function RotationalPuzzles() {
  return (
      <GTSec id="rotational-puzzles" className="gt-sec">
        <div className="gt-sec-num">§31</div>
        <h2 className="gt-sec-title">
          <L zh="图上的旋转拼图 — Jaap 的 (x, y, z) 分类" en="Rotational puzzles on graphs — Jaap's (x, y, z) classification" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>把魔方这种「面旋转」抽象到任意图:给一张连通图,标出若干 <em>面</em> (有向循环),每个面对应一个把面上棋子循环移位的生成元。 整体群 <TeX src="\Gamma" /> 是 <TeX src="S_n" /> 的子群 (<TeX src="n" /> 是棋子总数)。 自然问:哪些图的旋转拼图 <em>状态空间</em> = <TeX src="S_n" />,哪些 <em>= <TeX src="A_n" /></em>,哪些是其它?</>}
            en={<>Abstract the cube's face turns to any graph: a connected graph with marked <em>faces</em> (directed cycles); each face gives a generator that cyclically rotates its pieces. The puzzle group <TeX src="\Gamma" /> is a subgroup of <TeX src="S_n" /> (<TeX src="n" /> = piece count). Natural question: which graphs give <TeX src="\Gamma = S_n" />, which <TeX src="A_n" />, which something exotic?</>}
          />
        </p>

        {/* ===== 31.1 Setup ===== */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="31.1  形式化:图、面、生成元" en="31.1  Formalisation: graph, face, generator" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 31.1 — 图上的旋转拼图', en: 'Definition 31.1 — rotational graph puzzle'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>给定连通有限图 <TeX src="G = (V, E)" />,<TeX src="|V| = n" />,以及一族标记的 <em>有向闭合环</em> <TeX src="F_1, F_2, \ldots, F_k" /> (称作 <strong>面</strong>),每个面是 <TeX src="V" /> 的一个有序子集。 棋子 <TeX src="\{1, 2, \ldots, n\}" /> 一对一放在顶点上。 每个面 <TeX src="F_i" /> 给出一个生成元 <TeX src="\rho_i \in S_n" />:沿环把每个棋子推到下一个顶点。 <strong>拼图群</strong> 是<TeXBlock src={`\\Gamma \\;=\\; \\langle \\rho_1, \\rho_2, \\ldots, \\rho_k \\rangle \\;\\le\\; S_n.`} /></>}
              en={<>Given a finite connected graph <TeX src="G = (V, E)" /> with <TeX src="|V| = n" />, plus a family of marked <em>directed closed cycles</em> <TeX src="F_1, F_2, \ldots, F_k" /> called <strong>faces</strong>. Each face is an ordered subset of <TeX src="V" />. Pieces <TeX src="\{1, 2, \ldots, n\}" /> sit on vertices one-to-one. Each face <TeX src="F_i" /> gives a generator <TeX src="\rho_i \in S_n" /> that cyclically pushes pieces along the cycle. The <strong>puzzle group</strong> is<TeXBlock src={`\\Gamma \\;=\\; \\langle \\rho_1, \\rho_2, \\ldots, \\rho_k \\rangle \\;\\le\\; S_n.`} /></>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>三个例子立刻熟悉:</>}
            en={<>Three immediate examples:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<><strong>3×3 角块</strong>:G = 三维立方体的 8 个角,6 个面各是长 4 的环,<TeX src="\Gamma" /> 含 <TeX src="A_8" /> 作为「位置」部分 (朝向另算)。</>}
            en={<><strong>3×3 corners</strong>: G = the 8 corner-vertices of a 3-cube; 6 length-4 face cycles; <TeX src="\Gamma" /> on positions contains <TeX src="A_8" /> (orientation tracked separately).</>}
          /></li>
          <li><L
            zh={<><strong>Pyraminx 边块</strong>:G = 正四面体的 6 条边的中点,4 个面 (长 3) 各转一组,得到 <TeX src="A_6" /> 子群。</>}
            en={<><strong>Pyraminx edges</strong>: G = midpoints of the 6 edges of a tetrahedron; 4 length-3 face cycles; gives a subgroup of <TeX src="A_6" />.</>}
          /></li>
          <li><L
            zh={<><strong>15-滑块</strong> (作为退化例):4×4 网格 + 一个 「空格」 在某点。 空格绕每个 「面」 (2×2 块) 一圈本质上等同于一个面转 — 这是 Wilson 1974 的桥梁。</>}
            en={<><strong>15-puzzle</strong> (as a degenerate example): a 4×4 grid plus one "blank." Cycling the blank around any 2×2 face is essentially a face turn — Wilson's 1974 bridge.</>}
          /></li>
        </ul>
        <div className="gt-aside">
          <L
            zh={<>注意一个微妙点:<em>面</em> 不必是图论意义下的「面」 (i.e. 平面嵌入的有界区域)。 我们说 「面」 时只是给一个有向环,因此同一张图可以配不同的面集 — 同样的 G 上不同的 「拼图」。 Jaap 把研究焦点限定在 <strong>两面拼图</strong>:正好两个环,合起来覆盖所有顶点 (无孤立子)。</>}
            en={<>A subtle point: a <em>face</em> need not be a "face" in the planar-embedding sense — it is just a marked directed cycle, so the same graph can carry different face sets. Jaap focuses on the <strong>two-face case</strong>: exactly two cycles, together covering every vertex.</>}
          />
        </div>

        {/* ===== 31.2 Two-face theorem ===== */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="31.2  两面分类定理 — (x, y, z) 三元组" en="31.2  Two-face theorem — the (x, y, z) triple" />
        </h3>
        <p>
          <L
            zh={<>两面拼图共享一段连续的顶点。 设面 1 独有 <TeX src="x" /> 子,面 2 独有 <TeX src="z" /> 子,共享 <TeX src="y" /> 子,合计 <TeX src="n = x + y + z" />。 不妨 <TeX src="x \le z" /> (对称)。 两面长分别为 <TeX src="f_1 = x + y" />、 <TeX src="f_2 = y + z" />。</>}
            en={<>Two faces share a contiguous segment. Let face 1 have <TeX src="x" /> unique pieces, face 2 have <TeX src="z" /> unique, and <TeX src="y" /> be shared, so <TeX src="n = x + y + z" />. Without loss of generality <TeX src="x \le z" />. Face lengths are <TeX src="f_1 = x + y" />, <TeX src="f_2 = y + z" />.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 31.2 — Scherphuis (两面分类)', en: 'Theorem 31.2 — Scherphuis (two-face classification)'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>设 <TeX src="f_1, f_2 \ge 3" />。 则<TeXBlock src={`\\Gamma_{(x,y,z)} \\;=\\; \\begin{cases} S_5\\;(\\text{order } 120) & \\text{if } (x,y,z) \\in \\{(2,2,2),\\,(1,3,2)\\}, \\\\ A_n & \\text{if both } f_1, f_2 \\text{ are odd}, \\\\ S_n & \\text{otherwise}. \\end{cases}`} />当 <TeX src="\min(f_1, f_2) < 3" /> 时退化:面太短无法产生 3-循环。</>}
              en={<>Suppose <TeX src="f_1, f_2 \ge 3" />. Then<TeXBlock src={`\\Gamma_{(x,y,z)} \\;=\\; \\begin{cases} S_5\\;(\\text{order } 120) & \\text{if } (x,y,z) \\in \\{(2,2,2),\\,(1,3,2)\\}, \\\\ A_n & \\text{if both } f_1, f_2 \\text{ are odd}, \\\\ S_n & \\text{otherwise}. \\end{cases}`} />When <TeX src="\min(f_1, f_2) < 3" /> the puzzle is degenerate: face too short to yield a 3-cycle.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<><strong>证明骨架</strong> (Jaap 风格,详见 jaapsch.net):</>}
            en={<><strong>Proof sketch</strong> (Jaap's exposition):</>}
          />
        </p>
        <ol style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<><em>奇偶性</em>:<TeX src="\rho_1" /> 是 <TeX src="f_1" />-循环,<TeX src="\operatorname{sgn}(\rho_1) = (-1)^{f_1 - 1}" />。 若两 <TeX src="f_i" /> 都奇,<TeX src="\Gamma \subseteq A_n" />;若有一偶,<TeX src="\Gamma" /> 含奇置换 ⇒ <TeX src="\Gamma \cap A_n" /> 指数 2 ⇒ <TeX src="\Gamma = S_n" /> (只要 <TeX src="\Gamma" /> 已含 <TeX src="A_n" />)。</>}
            en={<><em>Parity</em>: <TeX src="\rho_1" /> is an <TeX src="f_1" />-cycle with <TeX src="\operatorname{sgn}(\rho_1) = (-1)^{f_1 - 1}" />. If both <TeX src="f_i" /> are odd, <TeX src="\Gamma \subseteq A_n" />; if one is even, <TeX src="\Gamma" /> contains an odd permutation, so it can equal <TeX src="S_n" /> once we know <TeX src="A_n \subseteq \Gamma" />.</>}
          /></li>
          <li><L
            zh={<><em>构造 3-循环</em>:换元 <TeX src="\rho_1 \rho_2 \rho_1^{-1} \rho_2^{-1}" /> 是非平凡换元子,在 「面足够大」 时是 3-循环 (或 3-循环的乘积,可进一步分解)。 关键 case 分析:</>}
            en={<><em>Constructing a 3-cycle</em>: the commutator <TeX src="\rho_1 \rho_2 \rho_1^{-1} \rho_2^{-1}" /> is non-trivial and, in most face-size combinations, equals a 3-cycle or factors into 3-cycles. Key cases:</>}
          /></li>
          <li><L
            zh={<>{`y = 1`}: 共享 1 子,换元给出准确的 3-循环 (<TeX src="\rho_1" /> 把它推到面 1 上一格,<TeX src="\rho_2" /> 推到面 2 上,反向回到出发点 — 三步循环)。</>}
            en={<>{`y = 1`}: with one shared piece, the commutator is exactly a 3-cycle (<TeX src="\rho_1" /> pushes it one step on face 1, <TeX src="\rho_2" /> pushes onto face 2, the inverses retrace — three vertices touched).</>}
          /></li>
          <li><L
            zh={<>{`y ≥ 3 且 (x,z) ≠ (2,2)`}: 用 「<TeX src="\rho_1 \rho_2" /> 后再用 <TeX src="\rho_2^{-1} \rho_1^{-1}" />」 风格七步组合产生 3-循环。 由于 <TeX src="A_n" /> 由 3-循环生成,故 <TeX src="\Gamma \supseteq A_n" />。</>}
            en={<>{`y ≥ 3 and (x,z) ≠ (2,2)`}: a seven-step combination of <TeX src="\rho_1 \rho_2" /> and <TeX src="\rho_2^{-1} \rho_1^{-1}" /> produces a 3-cycle. Since 3-cycles generate <TeX src="A_n" />, we get <TeX src="\Gamma \supseteq A_n" />.</>}
          /></li>
          <li><L
            zh={<><em>例外验证</em>:(2,2,2) 和 (1,3,2) 都是 <TeX src="n = 6" />,但群阶卡在 120 = 5! &lt; 360 = 6!/2。 直接群论计算或 GAP 验证。</>}
            en={<><em>Verifying the exceptions</em>: (2,2,2) and (1,3,2) both have <TeX src="n = 6" /> but order stops at 120 = 5! &lt; 360 = 6!/2. Direct group-theoretic computation or GAP confirms.</>}
          /></li>
        </ol>
        <p>
          <L
            zh={<>那个 5! = 120 阶的群究竟是谁?它 <em>不</em> 是 <TeX src="S_5" /> 的标准作用 (那个在 5 点),而是它在 6 点上的 <em>例外作用</em> — 由 <TeX src="PGL_2(\mathbb{F}_5)" /> 作用于射影直线 <TeX src="\mathbb{P}^1(\mathbb{F}_5)" /> (6 个点) 给出。 这正是 §30 反复出现的「6 点 vs 5 点」奇异同构。</>}
            en={<>What is this order-120 group? It is <em>not</em> the standard <TeX src="S_5" />-on-5-points but the <em>exceptional action</em> of <TeX src="S_5" /> on 6 points coming from <TeX src="PGL_2(\mathbb{F}_5)" /> on the projective line <TeX src="\mathbb{P}^1(\mathbb{F}_5)" /> (6 points). This is the same "6-vs-5" sporadic isomorphism that drives §30.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: '(x, y, z) 实时分类器', en: '(x, y, z) live classifier'
        })}</div>
          <XYZClassifier />
        </div>
        <p>
          <L
            zh={<>这个分类把 Pyraminx 两面 (2,1,2 ⇒ <TeX src="A_5" />)、 Impossiball 两面 (3,2,3 ⇒ <TeX src="A_8" />)、 Alexander's Star (4,1,4 ⇒ <TeX src="A_9" />) 等具体玩具都涵盖了。 也回答了为什么 (2, 2, 2) 显得特殊:那 6 个角刚好跟 §30 是同一个故事。</>}
            en={<>This covers Pyraminx two-face (2,1,2 ⇒ <TeX src="A_5" />), Impossiball two-face (3,2,3 ⇒ <TeX src="A_8" />), Alexander's Star (4,1,4 ⇒ <TeX src="A_9" />). It also explains why (2, 2, 2) feels special — its 6 corners are exactly the §30 story.</>}
          />
        </p>

        {/* ===== 31.3 Worked examples ===== */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="31.3  实例巡礼 — 八个 (x, y, z) 标本" en="31.3  Worked examples — eight (x, y, z) specimens" />
        </h3>
        <p>
          <L
            zh={<>把分类定理代入八个有意思的 <TeX src="(x, y, z)" />,看看每一个落在哪一支。 下表的「构造」一列给出生成 3-循环的具体短换元,可逐一手算复现:</>}
            en={<>Substitute the theorem into eight notable triples and see where each falls. The "construction" column gives an explicit short commutator producing a 3-cycle — easy to verify by hand:</>}
          />
        </p>
        <table className="gt-partition-tbl">
          <thead>
            <tr>
              <th>(x, y, z)</th>
              <th>n</th>
              <th>(f₁, f₂)</th>
              <th>{tr({ zh: '群', en: 'group' })}</th>
              <th>|Γ|</th>
              <th>{tr({ zh: '构造', en: 'construction'
            })}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>(1, 1, 1)</td><td className="num">3</td><td>(2, 2)</td><td><TeX src="\mathbb{Z}_3" /></td><td className="num">3</td><td>{tr({ zh: '过小 (面长 2 < 3)', en: 'degenerate (faces too short)'
            })}</td></tr>
            <tr><td>(1, 2, 1)</td><td className="num">4</td><td>(3, 3)</td><td><TeX src="A_4" /></td><td className="num">12</td><td><TeX src="[\rho_1, \rho_2]" />{tr({ zh: ' = 3-循环', en: ' = 3-cycle'
            })}</td></tr>
            <tr><td>(2, 1, 2)</td><td className="num">5</td><td>(3, 3)</td><td><TeX src="A_5" /></td><td className="num">60</td><td><TeX src="[\rho_1, \rho_2]" />{tr({ zh: '；Pyraminx 局部', en: '; Pyraminx local'
            })}</td></tr>
            <tr><td>(1, 3, 2)</td><td className="num">6</td><td>(4, 5)</td><td><TeX src="S_5" /> <em>{tr({ zh: '(例外)', en: '(exceptional)' })}</em></td><td className="num">120</td><td>{tr({ zh: '同构于 (2,2,2);Wilson θ₀ 之内核', en: 'isomorphic to (2,2,2); kernel of Wilson\'s θ₀'
            })}</td></tr>
            <tr><td>(2, 2, 2)</td><td className="num">6</td><td>(4, 4)</td><td><TeX src="S_5" /> <em>{tr({ zh: '(例外)', en: '(exceptional)' })}</em></td><td className="num">120</td><td><TeX src="PGL_2(\mathbb{F}_5) \curvearrowright \mathbb{P}^1(\mathbb{F}_5)" /></td></tr>
            <tr><td>(3, 2, 3)</td><td className="num">8</td><td>(5, 5)</td><td><TeX src="A_8" /></td><td className="num">20,160</td><td>{tr({ zh: '两奇长面;Impossiball 两面', en: 'both odd faces; Impossiball local'
            })}</td></tr>
            <tr><td>(4, 1, 4)</td><td className="num">9</td><td>(5, 5)</td><td><TeX src="A_9" /></td><td className="num">181,440</td><td>{tr({ zh: 'Alexander\'s Star 局部', en: 'Alexander\'s Star local'
            })}</td></tr>
            <tr><td>(3, 3, 3)</td><td className="num">9</td><td>(6, 6)</td><td><TeX src="S_9" /></td><td className="num">362,880</td><td>{tr({ zh: '偶长面 ⇒ 奇置换 ⇒ 全 S', en: 'even faces ⇒ odd perm ⇒ full S'
            })}</td></tr>
          </tbody>
        </table>
        <p style={{ marginTop: 14 }}>
          <L
            zh={<>注意 (2,1,2) ⇒ <TeX src="A_5" /> 阶 60 是「最小的非阿贝尔单群」,§21 已证。 因此 Pyraminx 两面拼图本质上是<em>有限单群分类</em>里最低层的代表 — 一个塑料玩具触底了 19 世纪的最大数学突破。</>}
            en={<>Note (2,1,2) ⇒ <TeX src="A_5" /> of order 60 — the smallest non-Abelian simple group, proven in §21. Pyraminx's two-face local pattern realises the very bottom of the classification of finite simple groups. A plastic toy bottoms out one of the 19th century's greatest mathematical achievements.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: '两面转动 — 实时奇偶性 + 圈型', en: 'Two-face turner — live parity & cycle type'
        })}</div>
          <TwoFaceTurner />
        </div>
        <p>
          <L
            zh={<>试 (2,1,2):点 L 然后 R,再 L⁻¹ R⁻¹ — 你应当看到一个 3-循环 (圈型 3·1²,sgn = +1)。 试 (2,2,2):同样的换元给出更长的循环,而不是 3-循环;这是 (2,2,2) 「卡在 5!」的可视化证据。</>}
            en={<>Try (2,1,2): press L, R, L⁻¹, R⁻¹ — you should see a 3-cycle (type 3·1², sgn = +1). Try (2,2,2): the same commutator yields a longer cycle, not a 3-cycle — visual evidence of (2,2,2)'s "stuck at 5!" anomaly.</>}
          />
        </p>

        {/* ===== 31.4 Three or more faces ===== */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="31.4  三面及以上 — 开放分类问题" en="31.4  Three faces and beyond — open classification" />
        </h3>
        <p>
          <L
            zh={<>真正的物理拼图大多 <em>不是</em> 两面。 立方体 6 个面,Megaminx 12 个面,Pyraminx 4 个面 — 每加一个面就多一个生成元,可能性的拓扑迅速复杂化。 已知:</>}
            en={<>Real physical puzzles are mostly <em>not</em> two-faced. The cube has 6 faces, the Megaminx 12, the Pyraminx 4 — each extra face is a new generator and the combinatorics explodes. What's known:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<><strong>三面 「补救」 例外</strong>:把 (2,2,2) 加一个第三个面 — 只要新面跟原两面之一形成 <em>非例外</em> 的两面对 (i.e. 落入定理 31.2 的 A_n 或 S_n 支),则整体群立刻 「升上去」 到 <TeX src="A_n" /> 或 <TeX src="S_n" />。 这是为什么 (2,2,2) 在抽象上有趣,但在物理拼图上不会单独出现 — 那两个 「例外面」 总有第三个面把它们抹掉。</>}
            en={<><strong>Three-face "rescue"</strong>: add a third face to (2,2,2); if the new face pairs with one of the original two in a <em>non-exceptional</em> way (falling into the <TeX src="A_n" /> or <TeX src="S_n" /> branch of Thm 31.2), the whole group jumps up to <TeX src="A_n" /> or <TeX src="S_n" />. This is why (2,2,2) is abstractly fascinating but never the bottom line of any physical puzzle — a third face always erases the anomaly.</>}
          /></li>
          <li><L
            zh={<><strong>独立棋子类型</strong>:实物拼图通常有「角 + 棱」(3×3) 或「棱 + 中心 + 尖」(Pyraminx),不同类型的棋子在生成元下不混淆。 群分解为<TeXBlock src={`\\Gamma \\;\\hookrightarrow\\; \\Gamma_{\\text{corners}} \\times \\Gamma_{\\text{edges}} \\times \\cdots,`} />然后做奇偶/朝向约束。 这是 §6 「正确放置 + 错误朝向」 故事的本质。</>}
            en={<><strong>Independent piece types</strong>: physical puzzles usually have "corners + edges" (3×3) or "edges + centres + tips" (Pyraminx); pieces of different types are never mixed by face turns. The group factors as<TeXBlock src={`\\Gamma \\;\\hookrightarrow\\; \\Gamma_{\\text{corners}} \\times \\Gamma_{\\text{edges}} \\times \\cdots`} />and parity/orientation laws are then imposed. This is the heart of §6's "right place, wrong orientation" classification.</>}
          /></li>
          <li><L
            zh={<><strong>开放分类问题</strong> (Jaap):给定 <TeX src="k \ge 3" /> 个面、每对面共享段长 <TeX src="y_{ij}" />、每个面长度 <TeX src="f_i" />,刻画 <TeX src="\Gamma" />。 当 <TeX src="k \ge 3" /> 时尚无完整定理 — 现有结果都是 「<em>足够大</em> 时给 <TeX src="A_n" /> 或 <TeX src="S_n" />」 类型的部分回答。 例外列表是否有限,仍是一个未解问题。</>}
            en={<><strong>Open problem</strong> (Jaap): given <TeX src="k \ge 3" /> faces with pairwise overlap lengths <TeX src="y_{ij}" /> and face sizes <TeX src="f_i" />, classify <TeX src="\Gamma" />. No full theorem is known for <TeX src="k \ge 3" /> — only "large enough ⇒ <TeX src="A_n" /> or <TeX src="S_n" />" partial results. Whether the exception list is finite remains open.</>}
          /></li>
          <li><L
            zh={<><strong>面与面多次相交</strong>:Hungarian Rings 等拼图的两面在两段不连续的弧上同时共享。 这超出 (x,y,z) 三元组,但 Singmaster 在 <em>Cubic Circular</em> 里给过特殊情形的结果。 一般答案缺失。</>}
            en={<><strong>Multi-arc overlaps</strong>: Hungarian Rings and friends have two faces sharing on two <em>disjoint</em> arcs. This breaks the (x,y,z) parameterisation; Singmaster's <em>Cubic Circular</em> handles special cases, no general answer.</>}
          /></li>
        </ul>

        {/* ===== 31.5 Wilson 1974 ===== */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="31.5  Wilson 1974 — 滑动拼图的伴侣分类" en="31.5  Wilson 1974 — the sliding-puzzle companion classification" />
        </h3>
        <p>
          <L
            zh={<>1974 年 R. M. Wilson 在 <em>Graph Puzzles, Homotopy, and the Alternating Group</em> 给了 <strong>滑动拼图</strong> 的完整分类 — 用一个 「空格」 在连通图 <TeX src="G" /> 上沿边滑动,空格初始位置 <TeX src="b" />。 状态群只由 「绕一个面环」 这种操作生成,本质上就是定理 31.2 的「带空格版」。</>}
            en={<>In 1974 R. M. Wilson published <em>Graph Puzzles, Homotopy, and the Alternating Group</em> giving the complete classification for <strong>sliding puzzles</strong>: a single "blank" slides along edges of a connected graph <TeX src="G" /> from initial vertex <TeX src="b" />. The state group is generated by "blank-around-a-face" operations — essentially the "blank-included" cousin of Thm 31.2.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 31.3 — Wilson (1974)', en: 'Theorem 31.3 — Wilson (1974)' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>设 <TeX src="G" /> 连通、 至少 2 度。 滑动拼图状态群 <TeX src="W(G, b)" /> 等于:<TeXBlock src={`W(G, b) \\;=\\; \\begin{cases} \\mathbb{Z}_n & G = C_n \\text{ (简单环)}, \\\\ \\langle (1\\,2\\,3\\,4\\,5\\,6) \\rangle \\rtimes \\langle (2\\,6)(3\\,5) \\rangle \\cong PGL_2(\\mathbb{F}_5) & G = \\theta_0 \\text{ (7-vertex exception)}, \\\\ A_{n-1} & \\text{otherwise, if } G \\text{ bipartite}, \\\\ S_{n-1} & \\text{otherwise}. \\end{cases}`} />其中 <TeX src="\theta_0" /> 是「两个长 4 的路径共享两个端点 + 一条额外的边在中间」 形成的 7 顶点图 — 正是把 (1,3,2) 旋转拼图的中央共享段拆开插入一个空格得到的。</>}
              en={<>Suppose <TeX src="G" /> is connected with minimum degree ≥ 2. The sliding-puzzle group <TeX src="W(G, b)" /> equals:<TeXBlock src={`W(G, b) \\;=\\; \\begin{cases} \\mathbb{Z}_n & G = C_n \\text{ (a cycle)}, \\\\ \\langle (1\\,2\\,3\\,4\\,5\\,6) \\rangle \\rtimes \\langle (2\\,6)(3\\,5) \\rangle \\cong PGL_2(\\mathbb{F}_5) & G = \\theta_0 \\text{ (7-vertex exception)}, \\\\ A_{n-1} & \\text{otherwise, if } G \\text{ bipartite}, \\\\ S_{n-1} & \\text{otherwise}. \\end{cases}`} />Here <TeX src="\theta_0" /> is the unique sporadic graph: two length-4 paths sharing two endpoints plus an extra edge connecting the midpoints — equivalent to inserting a blank into the central shared segment of the (1,3,2) rotational puzzle.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>三个例外:</>}
            en={<>Three families of exceptions:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<><strong>环 <TeX src="C_n" /></strong>:空格绕一圈给纯循环 <TeX src="\mathbb{Z}_n" />,远不到 <TeX src="A_{n-1}" /></>} en={<><strong>Cycle <TeX src="C_n" /></strong>: blank traversing once gives cyclic <TeX src="\mathbb{Z}_n" />, far short of <TeX src="A_{n-1}" /></>} /></li>
          <li><L zh={<><strong>双色图</strong> (bipartite, 非环):空格只在两类顶点间穿梭,每移动改变 「奇偶」,故 <TeX src="W \subseteq A_{n-1}" /></>} en={<><strong>Bipartite graph</strong> (not a cycle): the blank alternates between two parts on each move, so its parity is constrained, <TeX src="W \subseteq A_{n-1}" /></>} /></li>
          <li><L zh={<><strong>θ₀</strong>: 7 个点的散在例外, <TeX src="|W| = 120" /> — 与定理 31.2 的 (1,3,2) 同构</>} en={<><strong>θ₀</strong>: sporadic 7-vertex exception with <TeX src="|W| = 120" /> — isomorphic to (1,3,2) of Thm 31.2</>} /></li>
        </ul>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: 'Wilson 三种类型对照', en: 'Wilson three-cases visualiser'
        })}</div>
          <WilsonSliding />
        </div>
        <p>
          <L
            zh={<>15-滑块属于 <em>非双色非环</em> 的情况 (4×4 网格 minus 一格 = 双色!),所以严格按 Wilson 它给的是 <TeX src="A_{15}" />,不是 <TeX src="S_{15}" />。 这就是 Loyd 1880 「14-15 调换悬赏 1000 美元无人解出」的代数解释:那一个对换是奇置换,落在 <TeX src="S_{15} \setminus A_{15}" /> ── 不可达。</>}
            en={<>The 15-puzzle is bipartite (the 4×4 grid is two-coloured by checkerboard), so Wilson's theorem gives <TeX src="A_{15}" />, not <TeX src="S_{15}" />. That is the algebraic explanation of Loyd's 1880 "$1000 prize for swapping 14 and 15": the swap is a transposition, an odd permutation in <TeX src="S_{15} \setminus A_{15}" /> — provably unreachable.</>}
          />
        </p>
        <div className="gt-aside">
          <L
            zh={<>Wilson 的证明走 <em>同伦</em>:把图 <TeX src="G" /> 当作 1-复形,空格移动 = 沿边走的路径,「绕面一圈」 = 同伦零的回路。 状态群本质上是 <TeX src="G" /> 的基本群在表示上的像。 这把组合问题翻译成代数拓扑 — 一个相当超前的观察。</>}
            en={<>Wilson's proof goes through <em>homotopy</em>: view <TeX src="G" /> as a 1-complex; blank moves are edge paths; "around a face" is a null-homotopic loop. The state group is essentially the image of <TeX src="\pi_1(G)" /> in the representation. Combinatorics translated to algebraic topology — a strikingly modern observation for 1974.</>}
          />
        </div>

        {/* ===== 31.6 Computer-aided ===== */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="31.6  计算机辅助分类 — Schreier-Sims 算法" en="31.6  Computer-aided classification — Schreier-Sims" />
        </h3>
        <p>
          <L
            zh={<>给定生成元集 <TeX src="\{g_1, \ldots, g_k\}" /> 求 <TeX src="|G|" />,理论上要枚举所有元素 (指数爆炸)。 1970 年 C. Sims 给出 <strong>多项式时间</strong> 算法 — <em>Schreier-Sims</em>:</>}
            en={<>Given generators <TeX src="\{g_1, \ldots, g_k\}" /> compute <TeX src="|G|" />. Brute enumeration is exponential. In 1970 C. Sims gave a <strong>polynomial-time</strong> algorithm — <em>Schreier-Sims</em>:</>}
          />
        </p>
        <ol style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<>选一个 <em>base</em> <TeX src="(b_1, b_2, \ldots, b_m)" />,使 <TeX src="G \supset G_{b_1} \supset G_{b_1 b_2} \supset \cdots \supset \{e\}" /></>} en={<>Choose a <em>base</em> <TeX src="(b_1, b_2, \ldots, b_m)" /> so that <TeX src="G \supset G_{b_1} \supset G_{b_1 b_2} \supset \cdots \supset \{e\}" /></>} /></li>
          <li><L zh={<>对每层稳定子,通过 「Schreier 生成」 求轨道</>} en={<>For each stabiliser layer compute its orbit via "Schreier generators"</>} /></li>
          <li><L zh={<>orbit-stabiliser 给 <TeX src="|G| = \prod_i |\text{orbit}_i|" /></>} en={<>Orbit-stabiliser yields <TeX src="|G| = \prod_i |\text{orbit}_i|" /></>} /></li>
        </ol>
        <p>
          <L
            zh={<>复杂度 <TeX src="O(n^5 \log |G|)" />,Seress 2003 综述里给了一系列优化版本,现代实现可处理 <TeX src="n \sim 10^6" /> 元上的群。 GAP、 sympy、 magma 都内置此算法 — 输入 「3×3 的 6 个面生成元」,几秒给出 <TeX src="|G| = 43{,}252{,}003{,}274{,}489{,}856{,}000" />。</>}
            en={<>Complexity <TeX src="O(n^5 \log |G|)" />; Seress 2003 surveys many refinements that handle <TeX src="n \sim 10^6" />. GAP, sympy and Magma ship Schreier-Sims out of the box: feed in the cube's six face generators and get <TeX src="|G| = 43{,}252{,}003{,}274{,}489{,}856{,}000" /> in seconds.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: 'Schreier-Sims 在 S₅ 上的逐步追踪', en: 'Schreier-Sims step trace on S₅'
        })}</div>
          <SchreierSimsDemo />
        </div>
        <p>
          <L
            zh={<>下表是用 Schreier-Sims 算出的小拼图群阶速查:</>}
            en={<>Schreier-Sims output for small puzzle groups:</>}
          />
        </p>
        <table className="gt-partition-tbl">
          <thead>
            <tr>
              <th>{tr({ zh: '拼图', en: 'puzzle'
            })}</th>
              <th>{tr({ zh: '生成元数', en: '# gens'
            })}</th>
              <th>n</th>
              <th>|G|</th>
              <th>{tr({ zh: '运行时间', en: 'time'
            })}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>15-puzzle</td><td className="num">12</td><td className="num">15</td><td className="num">10,461,394,944,000</td><td>{tr({ zh: '一瞬', en: '&lt; 1 s' })}</td></tr>
            <tr><td>2×2×2</td><td className="num">6</td><td className="num">24</td><td className="num">3,674,160</td><td>&lt; 1 s</td></tr>
            <tr><td>Pyraminx</td><td className="num">8</td><td className="num">14</td><td className="num">75,582,720</td><td>&lt; 1 s</td></tr>
            <tr><td>Skewb</td><td className="num">8</td><td className="num">14</td><td className="num">3,149,280</td><td>&lt; 1 s</td></tr>
            <tr><td>3×3×3</td><td className="num">6</td><td className="num">48</td><td className="num">4.33 × 10<sup>19</sup></td><td>&lt; 10 s</td></tr>
            <tr><td>Megaminx</td><td className="num">12</td><td className="num">132</td><td className="num">1.01 × 10<sup>68</sup></td><td>{tr({ zh: '数分钟', en: 'minutes'
            })}</td></tr>
            <tr><td>4×4×4</td><td className="num">12</td><td className="num">96</td><td className="num">7.40 × 10<sup>45</sup></td><td>{tr({ zh: '数分钟', en: 'minutes'
            })}</td></tr>
          </tbody>
        </table>

        {/* ===== 31.7 Wreath / surfaces ===== */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="31.7  曲面、 商空间与 wreath product" en="31.7  Surfaces, quotients, and wreath products" />
        </h3>
        <p>
          <L
            zh={<>抽掉 「物理拼图」 的外观,旋转拼图就是 <em>高维流形上的旋转作用的离散商</em>。 例如 2×2×2 的角块状态空间可以看作<TeXBlock src={`(\\mathbb{Z}_3)^7 \\rtimes S_8,`} />其中 <TeX src="(\mathbb{Z}_3)^7" /> 是 「7 个独立角的朝向 (第 8 个由总朝向守恒律决定)」,<TeX src="S_8" /> 是角的位置。 半直积反映 「位置先动,朝向跟着转」 的依赖关系。</>}
            en={<>Strip away the physical packaging and a rotational puzzle is a <em>discrete quotient of a manifold rotation action</em>. The 2×2×2 corner state space is exactly<TeXBlock src={`(\\mathbb{Z}_3)^7 \\rtimes S_8,`} />where <TeX src="(\mathbb{Z}_3)^7" /> tracks "the 7 independent corner orientations (the 8th is forced by the orientation-sum conservation law)" and <TeX src="S_8" /> tracks corner positions. The semidirect product encodes "positions move first, orientations follow."</>}
          />
        </p>
        <p>
          <L
            zh={<>更一般地,<strong>wreath product</strong> <TeX src="\mathbb{Z}_n \wr S_k" /> 描述 「<TeX src="k" /> 个对象,每个有 <TeX src="\mathbb{Z}_n" /> 朝向,可以任意排列再各自旋转」。 直接定义<TeXBlock src={`\\mathbb{Z}_n \\wr S_k \\;=\\; (\\mathbb{Z}_n)^k \\rtimes S_k,`} /><TeX src="S_k" /> 通过置换坐标作用于 <TeX src="(\mathbb{Z}_n)^k" />。 阶 <TeX src="|\mathbb{Z}_n \wr S_k| = n^k \cdot k!" />。</>}
            en={<>More generally, the <strong>wreath product</strong> <TeX src="\mathbb{Z}_n \wr S_k" /> describes "<TeX src="k" /> objects, each with <TeX src="\mathbb{Z}_n" /> orientation, freely permuted and individually twisted":<TeXBlock src={`\\mathbb{Z}_n \\wr S_k \\;=\\; (\\mathbb{Z}_n)^k \\rtimes S_k,`} />with <TeX src="S_k" /> acting on <TeX src="(\mathbb{Z}_n)^k" /> by permuting coordinates. Order <TeX src="|\mathbb{Z}_n \wr S_k| = n^k \cdot k!" />.</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<><strong>2×2×2 角</strong>:<TeX src="(\mathbb{Z}_3 \wr S_8) / \mathbb{Z}_3" /> (商掉总朝向守恒)。 阶 <TeX src="3^8 \cdot 8! / 3 = 3{,}674{,}160" />。</>} en={<><strong>2×2×2 corners</strong>: <TeX src="(\mathbb{Z}_3 \wr S_8) / \mathbb{Z}_3" /> (quotient by the orientation-sum law). Order <TeX src="3^8 \cdot 8! / 3 = 3{,}674{,}160" />.</>} /></li>
          <li><L zh={<><strong>3×3 角</strong>:同上,但跟棱块通过奇偶性耦合 — 全群 <TeX src="(\mathbb{Z}_3 \wr S_8) \times (\mathbb{Z}_2 \wr S_{12})" /> 取指数 2 的子群。</>} en={<><strong>3×3 corners</strong>: same, coupled to edges by parity — full group is the index-2 subgroup of <TeX src="(\mathbb{Z}_3 \wr S_8) \times (\mathbb{Z}_2 \wr S_{12})" />.</>} /></li>
          <li><L zh={<><strong>Pyraminx</strong>:4 个尖块各 <TeX src="\mathbb{Z}_3" /> 独立 (不交互),用 <em>直积</em> <TeX src="(\mathbb{Z}_3)^4" />;6 个边块用 <TeX src="A_6 \times (\mathbb{Z}_2)^?" />;4 个中央块各 <TeX src="\mathbb{Z}_3" /> 但有约束 — 整体半直积。</>} en={<><strong>Pyraminx</strong>: the 4 tips are independent <TeX src="(\mathbb{Z}_3)^4" /> (non-interacting); the 6 edges form <TeX src="A_6 \times (\mathbb{Z}_2)^?" />; the 4 centres each <TeX src="\mathbb{Z}_3" /> with constraints — assembled by semidirect product.</>} /></li>
          <li><L zh={<><strong>Skewb</strong>:8 角 + 6 中心,4 对角轴生成,wreath 结构 <TeX src="\mathbb{Z}_3 \wr S_8" /> 再除二个约束 (角朝向和、 中心置换奇偶) 得到 3,149,280。</>} en={<><strong>Skewb</strong>: 8 corners + 6 centres, 4 diagonal-axis generators, wreath <TeX src="\mathbb{Z}_3 \wr S_8" /> divided by two constraints (corner-twist sum, centre-permutation parity) gives 3,149,280.</>} /></li>
        </ul>
        <p>
          <L
            zh={<>Wreath product 还跟 <em>覆叠空间</em> 直接对应:<TeX src="\mathbb{Z}_n" /> 是单一棋子的 「朝向圆周」(<TeX src="S^1" />),<TeX src="k" /> 个棋子位形空间是 <TeX src="\binom{n}{k}" />- 倍商,wreath product 就是这个 「位置 × 朝向」 总流形的离散对称群。 参见 M. Davis, <em>The Geometry and Topology of Coxeter Groups</em>。</>}
            en={<>Wreath products correspond directly to <em>covering spaces</em>: each <TeX src="\mathbb{Z}_n" /> is one piece's orientation circle (<TeX src="S^1" />), and the configuration space of <TeX src="k" /> pieces is a <TeX src="\binom{n}{k}" />-fold quotient; the wreath product is the discrete symmetry of this "position × orientation" total manifold. See M. Davis, <em>The Geometry and Topology of Coxeter Groups</em>.</>}
          />
        </p>

        {/* ===== 31.8 Puzzle zoo ===== */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="31.8  拼图全景 — 12 个实物 vs (x, y, z)" en="31.8  Puzzle gallery — 12 physical specimens vs (x, y, z)" />
        </h3>
        <p>
          <L
            zh={<>把分类应用到具体玩具。 每张卡片可点击,右侧给出 (x,y,z) 分解 (若适用)、 群结构公式、 阶数,以及一两行直觉解释:</>}
            en={<>Apply the classification to physical puzzles. Click each card to inspect its (x,y,z) decomposition (when applicable), its group, its order, and a one-line intuition:</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: '12 个拼图,一一拆解', en: '12 puzzles, one by one'
        })}</div>
          <PuzzleZoo />
        </div>
        <p>
          <L
            zh={<>注意到 (2,1,2) 反复出现:Pyraminx、 Skewb、 任何 「<em>正四面体面 +某轴</em>」 局部都长这样,所以 <TeX src="A_5" /> 是 「正四面体对称的代数最小公倍数」。 这也解释了为什么 Pyraminx 的位置部分恰好嵌入 <TeX src="A_6" /> — 6 条边 mod 4 个面的旋转 = <TeX src="A_5" /> 的 <em>诱导作用</em>。</>}
            en={<>Note that (2,1,2) recurs: Pyraminx, Skewb, and any "<em>tetrahedron-face-plus-an-axis</em>" local pattern look like this, making <TeX src="A_5" /> the "algebraic LCM of tetrahedral symmetry." This is exactly why the Pyraminx's edge positions embed in <TeX src="A_6" /> — 6 edges modulo 4 face rotations equals the <em>induced action</em> of <TeX src="A_5" />.</>}
          />
        </p>
        <div className="gt-pullquote">
          <L
            zh={<>「每一个塑料玩具都是一个有限群的传教士。」</>}
            en={<>"Every plastic puzzle is a missionary for some finite group."</>}
          />
          <div className="gt-pullquote-cite">— {tr({ zh: '现代群论教学俗谚', en: 'modern group-theory teaching folklore'
        })}</div>
        </div>

        {/* ===== 31.9 Open problems ===== */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="31.9  开放问题" en="31.9  Open problems" />
        </h3>
        <ol style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<><strong>k 面分类</strong>:已知 (x,y,z) 两面分类有 2 个例外。 <TeX src="k = 3" /> 时例外列表多少个?有限吗?Jaap 给出几个具体 「三面例外」, 没有完整定理。</>}
            en={<><strong>k-face classification</strong>: the two-face theorem has 2 exceptions. For <TeX src="k = 3" /> how many exceptions are there? Is the list finite? Jaap lists a few specific three-face anomalies but no general theorem.</>}
          /></li>
          <li><L
            zh={<><strong>非连通共享段</strong>:Hungarian Rings / Whip-It 型拼图,两面在两条不连续弧上共享。 (x,y,z) 不足以描述,改用 「共享段长度多重集」 <TeX src="\{y_1, y_2, \ldots\}" />。 现有结果零散。</>}
            en={<><strong>Disconnected overlap</strong>: Hungarian Rings, Whip-It, etc. share two disjoint arcs. The (x,y,z) parameterisation fails; one needs the multiset <TeX src="\{y_1, y_2, \ldots\}" /> of overlap lengths. Only scattered results.</>}
          /></li>
          <li><L
            zh={<><strong>带朝向的图拼图</strong>:Jaap 的分类设每子无朝向。 加上「每点 <TeX src="\mathbb{Z}_n" /> 朝向 + 整体守恒律」,合 拼图群是 wreath product <TeX src="\mathbb{Z}_n \wr \Gamma" /> 的子群 — 哪些守恒律可以出现?</>}
            en={<><strong>Oriented graph puzzles</strong>: Jaap's classification assumes unoriented pieces. Add per-vertex <TeX src="\mathbb{Z}_n" /> orientation with conservation laws, the puzzle group becomes a subgroup of <TeX src="\mathbb{Z}_n \wr \Gamma" /> — which conservation laws can arise?</>}
          /></li>
          <li><L
            zh={<><strong>Jumbling 拼图</strong>:Helicopter cube 类 「<em>非整数面长</em>」 的拼图状态空间不是群,而是流形。 现有研究 (Hofstadter 之外的现代尝试) 极少 — 拼图群论的下一个前沿。</>}
            en={<><strong>Jumbling puzzles</strong>: helicopter cube and friends have "<em>non-integer face turns</em>"; the state space is no longer a group but a manifold. Modern attempts beyond Hofstadter are sparse — the next frontier of puzzle algebra.</>}
          /></li>
          <li><L
            zh={<><strong>Diameter</strong>: 给定 (x,y,z) 旋转拼图, <TeX src="\Gamma" /> 的 Cayley 直径多少?即 「最长不可解」 距离。 已知例外 (2,2,2) 直径 = 5。 一般情况未必有简洁公式。</>}
            en={<><strong>Diameter</strong>: for (x,y,z) rotational puzzles, what is the Cayley diameter of <TeX src="\Gamma" />? The exceptional (2,2,2) has diameter 5. No closed form is known for the generic case.</>}
          /></li>
        </ol>

        {/* ===== 31.10 Wreath product ===== */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="31.10  Wreath product Sₖ ≀ ℤₙ — 朝向的代数结构" en="31.10  Wreath products S_k ≀ ℤ_n — the algebra of orientation" />
        </h3>
        <p>
          <L
            zh={<>设有 <TeX src="k" /> 个对象, 每个带 <TeX src="\mathbb{Z}_n" /> 朝向 (n = 2 棱、 n = 3 角、 n = 4 中心)。 朝向作为函数 <TeX src="f: \{1, \ldots, k\} \to \mathbb{Z}_n" />;位置变 <TeX src="\sigma \in S_k" /> 时朝向跟随置换。 总群是<TeXBlock src={`\\mathbb{Z}_n \\wr S_k \\;=\\; \\mathbb{Z}_n^k \\rtimes S_k, \\qquad |\\mathbb{Z}_n \\wr S_k| \\;=\\; n^k \\cdot k!.`} />群运算:<TeXBlock src={`(f, \\sigma)(g, \\tau) \\;=\\; (f + \\sigma \\cdot g,\\; \\sigma\\tau),`} />其中 <TeX src="(\sigma \cdot g)(i) = g(\sigma^{-1}(i))" />,即 「先排,再朝」。</>}
            en={<>Take <TeX src="k" /> objects each carrying <TeX src="\mathbb{Z}_n" /> orientation (n = 2 for edges, n = 3 for corners, n = 4 for cube centres). Orientation is a function <TeX src="f: \{1, \ldots, k\} \to \mathbb{Z}_n" />; permuting positions <TeX src="\sigma \in S_k" /> drags orientations along. The total group is<TeXBlock src={`\\mathbb{Z}_n \\wr S_k \\;=\\; \\mathbb{Z}_n^k \\rtimes S_k, \\qquad |\\mathbb{Z}_n \\wr S_k| \\;=\\; n^k \\cdot k!.`} />Multiplication rule:<TeXBlock src={`(f, \\sigma)(g, \\tau) \\;=\\; (f + \\sigma \\cdot g,\\; \\sigma\\tau),`} />where <TeX src="(\sigma \cdot g)(i) = g(\sigma^{-1}(i))" /> ("permute, then twist").</>}
          />
        </p>
        <p>
          <L
            zh={<>真实拼图的群恰是 wreath product 的 <em>子群</em>,由 「守恒律」 切下来。 例如:</>}
            en={<>The group of an actual puzzle is the <em>subgroup</em> of a wreath product cut out by conservation laws. For example:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<><TeX src="G_{\text{2×2 corners}} = \ker(\Sigma : \mathbb{Z}_3 \wr S_8 \to \mathbb{Z}_3)" /> = 朝向和守恒的核, 指数 3</>}
            en={<><TeX src="G_{\text{2×2 corners}} = \ker(\Sigma : \mathbb{Z}_3 \wr S_8 \to \mathbb{Z}_3)" />, the kernel of the twist-sum, index 3</>}
          /></li>
          <li><L
            zh={<><TeX src="G_{\text{3×3}} = \ker(\Sigma_c, \Sigma_e, \operatorname{sgn}_c \cdot \operatorname{sgn}_e)" /> 三个守恒律, 指数 12</>}
            en={<><TeX src="G_{\text{3×3}} = \ker(\Sigma_c, \Sigma_e, \operatorname{sgn}_c \cdot \operatorname{sgn}_e)" /> with three conservation laws, index 12</>}
          /></li>
          <li><L
            zh={<><TeX src="G_{\text{Megaminx}}" /> 是 <TeX src="(\mathbb{Z}_3 \wr S_{20}) \times (\mathbb{Z}_2 \wr S_{30}) \times (S_5 \wr \text{stuff})" /> 的子群 — 完整公式见 §15.1</>}
            en={<><TeX src="G_{\text{Megaminx}}" /> sits inside <TeX src="(\mathbb{Z}_3 \wr S_{20}) \times (\mathbb{Z}_2 \wr S_{30}) \times (S_5 \wr \text{stuff})" /> — full formula in §15.1</>}
          /></li>
        </ul>
        <p>
          <L
            zh={<>Wreath product 的 「图论侧」 解释:<TeX src="\mathbb{Z}_n \wr S_k" /> 是 「<TeX src="k" /> 条悬挂的 <TeX src="\mathbb{Z}_n" />-绳 + 自由置换」 的对称群。 在 Cayley 图论中, wreath product 是构造 <em>大直径</em> 群的经典工具 — 30 年代用来给 <TeX src="S_n" /> 的极大子群分类提供反例。 现代视角:wreath product 等同于 「带颜色的森林」 的自同构群 (Boyer-Moore 数据结构的代数对应)。</>}
            en={<>Graph-theoretic side: <TeX src="\mathbb{Z}_n \wr S_k" /> is the symmetry of "<TeX src="k" /> dangling <TeX src="\mathbb{Z}_n" />-strings, freely permuted." In Cayley-graph theory wreath products are the classical recipe for constructing groups of <em>large diameter</em>, used in the 1930s to settle questions about maximal subgroups of <TeX src="S_n" />. Modern view: a wreath product is the automorphism group of a "coloured forest" (the algebraic dual of Boyer-Moore data structures).</>}
          />
        </p>

        {/* ===== closing ===== */}
        <p style={{ marginTop: 28 }}>
          <L
            zh={<>这一节把 「魔方」 升级成 「图上的旋转拼图」: 两面就是 (x, y, z), 多面就是 wreath product 的子群, 计算就是 Schreier-Sims, 极限就是 jumbling 流形。 Wilson 1974 的滑动版给了对偶视角, 同伦理论把组合翻译成代数拓扑。 例外永远在 (2,2,2):那是 <TeX src="PGL_2(\mathbb{F}_5) \cong S_5" /> 在 6 点上的奇异作用 — 拼图群论的 「最小可爱反例」, 也是把整个故事跟 §30 缝合的针脚。</>}
            en={<>This section promotes "Rubik's cube" to "rotational puzzle on a graph": two faces give (x, y, z); many faces give wreath subgroups; computation runs through Schreier-Sims; the limit is jumbling manifolds. Wilson 1974's sliding cousin supplies the dual viewpoint, and homotopy translates combinatorics into algebraic topology. The exception lives forever at (2,2,2): <TeX src="PGL_2(\mathbb{F}_5) \cong S_5" /> acting on 6 points — the puzzle theory's smallest pretty counterexample, and the stitch that sews this section into §30.</>}
          />
        </p>
      </GTSec>
  );
}
