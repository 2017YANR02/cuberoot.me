'use client';

import { useState } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

function BurnsideMiniTable() {
  const lang = useLang();
  // For each of 6 face-equivalence operations, give a rough "fixed-states" estimate.
  // Numbers are illustrative orders-of-magnitude; the precise figures come from
  // Burnside applied to G under the 48-element outer symmetry group.
  const rows: { sym: string; symEn: string; symZh: string; fixed: string; comment: string; commentZh: string
 }[] = [
    { sym: 'identity (e)',         symEn: 'identity',           symZh: '恒等',
      fixed: '4.3 × 10¹⁹',          comment: 'all of G fixed',                commentZh: '所有状态都被恒等固定'
    },
    { sym: '90° rotation × 6',     symEn: 'face 90° rotation',   symZh: '面 90° 旋转',
      fixed: '~1.4 × 10⁹ each',     comment: 'states with that 4-fold symmetry', commentZh: '具有该 4 重对称的状态'
    },
    { sym: '180° rotation × 9',    symEn: 'face/edge 180° rotation', symZh: '面/棱 180° 旋转',
      fixed: '~10¹⁰ each',          comment: 'states with that 2-fold symmetry', commentZh: '具有该 2 重对称的状态'
    },
    { sym: '120° rotation × 8',    symEn: 'corner 120° rotation', symZh: '角块 120° 旋转',
      fixed: '~10⁶ each',           comment: 'states with that 3-fold symmetry', commentZh: '具有该 3 重对称的状态'
    },
    { sym: 'mirror × 24',          symEn: 'mirror reflection',   symZh: '镜面反射',
      fixed: '~10⁹ each',           comment: 'mirror-symmetric states',          commentZh: '镜像对称状态'
    },
  ];
  return (
    <table className="gt-compare">
      <thead>
        <tr>
          <th>{tr({ zh: '对称变换', en: 'Symmetry'
        })}</th>
          <th>{tr({ zh: '不动点 (Fix g)', en: 'Fixed states (Fix g)'
        })}</th>
          <th>{tr({ zh: '说明', en: 'Meaning'
        })}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{lang === 'zh' ? r.symZh : r.symEn}</td>
            <td className="num">{r.fixed}</td>
            <td style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{lang === 'zh' ? r.commentZh : r.comment}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── §18 SymmetryPicker — pick one of 48 outer cube symmetries ─────────────
// Each entry below corresponds to one conjugacy class of the 48-element
// outer cube symmetry group D = O_h. Sizes / fixed-state counts from standard
// references (Wikipedia "Rubik's cube group" + Joyner's textbook). The numbers
// are exact for E, 3C2 (face 180°) and 6C2' (edge 180°); approximate otherwise.

// are exact for E, 3C2 (face 180°) and 6C2' (edge 180°); approximate otherwise.
type SymClass = {
  name: string;
  nameZh: string;
  count: number;       // how many group elements in this conjugacy class
  order: number;       // order of each element
  axis: string;
  axisZh: string;
  fixDesc: string;
  fixDescZh: string;
  fixCount: string;
  type: 'identity' | 'C4' | 'C2-face' | 'C3' | 'C2-edge' | 'mirror' | 'rotoreflect';
};

const SYM_CLASSES: SymClass[] = [
  {
    name: 'E (identity)', nameZh: 'E 单位元', count: 1, order: 1,
    axis: '—', axisZh: '—',
    fixDesc: 'fixes every state', fixDescZh: '固定所有状态',
    fixCount: '4.3 × 10¹⁹', type: 'identity',
  },
  {
    name: '6 C4 (face 90°)', nameZh: '6 个 C₄ 面 90°', count: 6, order: 4,
    axis: '3 face axes × 2 directions', axisZh: '3 面轴 × 2 方向',
    fixDesc: 'states with 4-fold face rotation symmetry — rare',
    fixDescZh: '具 4 重面对称的状态 — 罕见',
    fixCount: '~10⁹', type: 'C4',
  },
  {
    name: '3 C2 (face 180°)', nameZh: '3 个 C₂ 面 180°', count: 3, order: 2,
    axis: '3 face axes', axisZh: '3 面轴',
    fixDesc: 'states symmetric under U2 (etc) rotation of axis',
    fixDescZh: '在 U2 (等) 整体旋转下不变的状态',
    fixCount: '~10¹⁰', type: 'C2-face',
  },
  {
    name: '8 C3 (vertex 120°)', nameZh: '8 个 C₃ 顶点 120°', count: 8, order: 3,
    axis: '4 vertex axes × 2 directions', axisZh: '4 顶点轴 × 2 方向',
    fixDesc: 'states with 3-fold body-diagonal symmetry',
    fixDescZh: '具 3 重体对角线对称的状态',
    fixCount: '~10⁶', type: 'C3',
  },
  {
    name: '6 C2 (edge 180°)', nameZh: '6 个 C₂ 棱 180°', count: 6, order: 2,
    axis: '6 edge-pair axes', axisZh: '6 对棱轴',
    fixDesc: 'states symmetric under face-diagonal rotation',
    fixDescZh: '在面对角线旋转下不变的状态',
    fixCount: '~10⁸', type: 'C2-edge',
  },
  {
    name: 'i (central inversion)', nameZh: 'i 中心反演', count: 1, order: 2,
    axis: 'cube centre', axisZh: '魔方中心',
    fixDesc: 'point-symmetric states (e.g. superflip)',
    fixDescZh: '点对称状态 (例如 superflip)',
    fixCount: '~10⁶', type: 'rotoreflect',
  },
  {
    name: '6 σh (face mirror)', nameZh: '6 个 σₕ 面镜面', count: 6, order: 2,
    axis: '3 face mirror planes × 2', axisZh: '3 个面镜面 × 2',
    fixDesc: 'cube states identical to their face-mirror image',
    fixDescZh: '在面镜面下不变的状态',
    fixCount: '~10⁹', type: 'mirror',
  },
  {
    name: '6 σd (edge mirror)', nameZh: '6 个 σ_d 棱镜面', count: 6, order: 2,
    axis: '6 edge-diagonal mirrors', axisZh: '6 个面对角线镜面',
    fixDesc: 'states symmetric under diagonal mirror',
    fixDescZh: '在对角镜面下不变的状态',
    fixCount: '~10⁸', type: 'mirror',
  },
  {
    name: '8 S6 (improper 60°)', nameZh: '8 个 S₆ 旋转-反射', count: 8, order: 6,
    axis: '4 vertex axes × 2 (rotation + reflection)', axisZh: '4 顶点轴 × 2 (旋转 + 反射)',
    fixDesc: 'rare combined-symmetry states',
    fixDescZh: '罕见的组合对称状态',
    fixCount: '~10⁵', type: 'rotoreflect',
  },
  {
    name: '6 S4 (improper 90°)', nameZh: '6 个 S₄ 旋转-反射', count: 6, order: 4,
    axis: '3 face axes × 2', axisZh: '3 面轴 × 2',
    fixDesc: 'very rare states',
    fixDescZh: '极罕见状态',
    fixCount: '~10⁵', type: 'rotoreflect',
  },
];

function SymmetryPicker() {
  const lang = useLang();
  const [selected, setSelected] = useState(0);
  const sym = SYM_CLASSES[selected];
  const totalElems = SYM_CLASSES.reduce((a, b) => a + b.count, 0);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 选一个外部对称变换', en: 'Interactive § Pick an outer cube symmetry'
    })}</div>
      <p className="gt-panel-sub">
        {lang === 'zh'
          ? `魔方有 ${totalElems} = 48 个外部对称 (O_h 群),分成 10 个共轭类。点任意一类看它的轴、阶、不动状态数。`
          : `The cube has ${totalElems} = 48 outer symmetries (group O_h), in 10 conjugacy classes. Click any class to see its axis, order, and approximate fix count.`}
      </p>
      <div className="gt-burnside-picker">
        {SYM_CLASSES.map((s, i) => (
          <div
            key={i}
            className={`gt-burnside-sym ${i === selected ? 'active' : ''}`}
            onClick={() => setSelected(i)}
          >
            <div className="gt-burnside-sym-name">{lang === 'zh' ? s.nameZh : s.name}</div>
            <div className="gt-burnside-sym-desc">{lang === 'zh' ? s.axisZh : s.axis}</div>
          </div>
        ))}
      </div>
      <div className="gt-panel-result" style={{ marginTop: 20 }}>
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '类', en: 'class'
        })}</div>
          <div className="gt-result-val-strong">{lang === 'zh' ? sym.nameZh : sym.name}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '元素个数', en: 'elements'
        })}</div>
          <div className="gt-result-val">{sym.count}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '阶', en: 'order'
        })}</div>
          <div className="gt-result-val">{sym.order}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '不动点 |Fix(σ)|', en: '|Fix(σ)|'
        })}</div>
          <div className="gt-result-val-strong">{sym.fixCount}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '不动状态', en: 'fixed states'
        })}</div>
          <div className="gt-result-val" style={{ fontSize: 13 }}>{lang === 'zh' ? sym.fixDescZh : sym.fixDesc}</div>
        </div>
      </div>
      <div className="gt-aside" style={{ marginTop: 12 }}>
        {lang === 'zh'
          ? <>合计: 10 个类共 48 个元素, Σ|Fix(σ)| ≈ 4.3 × 10¹⁹ (主要来自单位元) 。 # orbits = Σ|Fix(σ)| / 48 ≈ 9.01 × 10¹⁷。</>
          : <>Sum: 10 classes, 48 elements, Σ|Fix(σ)| ≈ 4.3 × 10¹⁹ (dominated by identity). # orbits = Σ|Fix(σ)| / 48 ≈ 9.01 × 10¹⁷.</>}
      </div>
    </div>
  );
}

// ── §18 OrbitExplorer — pick a cubie type, see orbit + stabilizer ─────────

// ── §18 OrbitExplorer — pick a cubie type, see orbit + stabilizer ─────────
function OrbitExplorer() {
  const lang = useLang();
  type CubieType = 'corner' | 'edge' | 'center';
  const [type, setType] = useState<CubieType>('corner');
  const G_SIZE = 43_252_003_274_489_856_000n;
  const orbitSize = { corner: 8n, edge: 12n, center: 1n }[type];
  const stabSize = G_SIZE / orbitSize;
  const sampleCubie = { corner: 'URF', edge: 'UF', center: 'U' }[type];
  const orbitDesc = {
    corner: tr({ zh: '所有 8 个角块位置 (角块块在 G 作用下能到的位置)', en: 'all 8 corner positions (where any corner cubie can land under G)'
    }),
    edge:   tr({ zh: '所有 12 个棱块位置 (棱块块在 G 作用下能到的位置)', en: 'all 12 edge positions (where any edge cubie can land under G)'
    }),
    center: tr({ zh: '只有 1 个位置 — 中心块不动 (它本身定义朝向)', en: 'just 1 position — centres are fixed by definition'
    }),
  }[type];
  const stabDesc = {
    corner: tr({ zh: '不改变 URF 位置和朝向的所有操作 = G 的指数 8 · 3 = 24 子群', en: 'all operations fixing URF including orientation = subgroup of index 8 · 3 = 24'
    }),
    edge:   tr({ zh: '不改变 UF 位置和朝向的所有操作 = G 的指数 12 · 2 = 24 子群', en: 'all operations fixing UF including orientation = subgroup of index 12 · 2 = 24'
    }),
    center: tr({ zh: '全部 G (中心块不动)', en: 'all of G (centre is always fixed)'
    }),
  }[type];
  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 轨道-稳定子', en: 'Interactive § Orbit-stabilizer'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '选一个 cubie 类型, 看它在 G 下的轨道大小 (|G·x|) 和稳定子大小 (|Stab(x)|) 。 它们的乘积永远 = |G|。', en: 'Pick a cubie type and see its orbit size |G·x| and stabilizer size |Stab(x)|. Their product is always |G|.'
        })}
      </p>
      <div className="gt-panel-input-row" style={{ marginTop: 4 }}>
        {(['corner', 'edge', 'center'] as CubieType[]).map(t => (
          <span key={t} className={`gt-chip ${t === type ? 'gt-chip-active' : ''}`} onClick={() => setType(t)}>
            {lang === 'zh' ? { corner: '角块', edge: '棱块', center: '中心' }[t] : t}
          </span>
        ))}
      </div>
      <div className="gt-orbit-explorer">
        <div>
          <h4>{tr({ zh: '轨道 G·x', en: 'Orbit G·x'
        })}</h4>
          <p>x = <span className="gt-orbit-val">{sampleCubie}</span></p>
          <p>|G·x| = <span className="gt-orbit-val">{orbitSize.toString()}</span></p>
          <p style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 8 }}>{orbitDesc}</p>
        </div>
        <div>
          <h4>{tr({ zh: '稳定子 Stab(x)', en: 'Stabilizer Stab(x)'
        })}</h4>
          <p>|Stab(x)| = <span className="gt-orbit-val" style={{ fontSize: 11 }}>{stabSize.toLocaleString()}</span></p>
          <p style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 8 }}>{stabDesc}</p>
        </div>
      </div>
      <div className="gt-math-display" style={{ fontSize: '1em', marginTop: 16 }}>
        |G·x| × |Stab(x)| &nbsp;=&nbsp; {orbitSize.toString()} &nbsp;×&nbsp; {stabSize.toLocaleString()} &nbsp;=&nbsp; |G| ✓
      </div>
      <div className="gt-aside" style={{ marginTop: 12 }}>
        {tr({ zh: '这就是轨道-稳定子定理。 每个 cubie 的 「能去哪里」 和 「让它不动需要多少操作」 是反比关系。', en: 'This is the orbit-stabilizer theorem: a cubie\'s "where it can go" and "how many operations leave it fixed" are inversely related.'
        })}
      </div>
    </div>
  );
}

// ── §18 CubeSymmetryAxes — SVG of the 48-element O_h symmetry group ──────

// ── §18 CubeSymmetryAxes — SVG of the 48-element O_h symmetry group ──────
function CubeSymmetryAxes() {
  const lang = useLang();
  const [highlight, setHighlight] = useState<'C4' | 'C3' | 'C2' | null>(null);
  // Cube vertices in 3D (centred at origin). Project to 2D with simple iso.
  const V: [number, number, number][] = [
    [-1, -1, -1], [ 1, -1, -1], [ 1,  1, -1], [-1,  1, -1],
    [-1, -1,  1], [ 1, -1,  1], [ 1,  1,  1], [-1,  1,  1],
  ];
  // Isometric projection
  const project = (p: [number, number, number]): [number, number] => {
    const [x, y, z] = p;
    return [200 + 60 * (x - z), 180 - 60 * y + 30 * (x + z)];
  };
  const proj = V.map(project);
  const edges: [number, number][] = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7],
  ];
  // Face-axis lines (C4): connect centres of opposite faces
  const C4_AXES: { a: [number, number, number]; b: [number, number, number] }[] = [
    { a: [0, -1.5, 0], b: [0, 1.5, 0] },   // U-D
    { a: [-1.5, 0, 0], b: [1.5, 0, 0] },   // L-R
    { a: [0, 0, -1.5], b: [0, 0, 1.5] },   // F-B
  ];
  // Vertex-axis lines (C3): connect opposite vertices (body diagonals)
  const C3_AXES: { a: [number, number, number]; b: [number, number, number] }[] = [
    { a: [-1.4, -1.4, -1.4], b: [1.4, 1.4, 1.4] },
    { a: [-1.4, -1.4, 1.4],  b: [1.4, 1.4, -1.4] },
    { a: [-1.4, 1.4, -1.4],  b: [1.4, -1.4, 1.4] },
    { a: [1.4, -1.4, -1.4],  b: [-1.4, 1.4, 1.4] },
  ];
  // Edge-axis lines (C2): connect centres of opposite edges
  const C2_AXES: { a: [number, number, number]; b: [number, number, number] }[] = [
    { a: [0, -1.4, -1.4], b: [0, 1.4, 1.4] },
    { a: [0, -1.4, 1.4],  b: [0, 1.4, -1.4] },
    { a: [-1.4, 0, -1.4], b: [1.4, 0, 1.4] },
    { a: [-1.4, 0, 1.4],  b: [1.4, 0, -1.4] },
    { a: [-1.4, -1.4, 0], b: [1.4, 1.4, 0] },
    { a: [-1.4, 1.4, 0],  b: [1.4, -1.4, 0] },
  ];
  const drawAxis = (a: [number,number,number], b: [number,number,number], cls: string) => {
    const [ax, ay] = project(a); const [bx, by] = project(b);
    return <line x1={ax} y1={ay} x2={bx} y2={by} className={`gt-symgroup-axis ${cls}`} />;
  };
  const counts = { C4: '3 axes · 6 rotations + 3 σ_h mirrors', C3: '4 axes · 8 rotations + 8 S6', C2: '6 axes · 6 rotations + 6 σ_d mirrors' };
  const countsZh = { C4: '3 轴 · 6 旋转 + 3 σ_h 镜面', C3: '4 轴 · 8 旋转 + 8 S6 反演', C2: '6 轴 · 6 旋转 + 6 σ_d 镜面' };
  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '可视 § 立方体对称轴', en: 'Visual § Cube symmetry axes'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '将鼠标悬在轴上(或点击下方按钮)显示对应的对称类。 红 = 面轴 (C₄, 4 重) , 蓝 = 体对角线 (C₃, 3 重) , 金 = 面对角线 (C₂, 2 重) 。', en: 'Hover an axis (or click below) to highlight a symmetry class. Red = face axes (C₄, 4-fold), blue = body diagonals (C₃, 3-fold), gold = edge axes (C₂, 2-fold).'
        })}
      </p>
      <div className="gt-panel-input-row" style={{ marginTop: 4 }}>
        {(['C4', 'C3', 'C2'] as const).map(c => (
          <span key={c} className={`gt-chip ${c === highlight ? 'gt-chip-active' : ''}`} onClick={() => setHighlight(h => h === c ? null : c)}>
            {c} ({c === 'C4' ? '6' : c === 'C3' ? '8' : '6'})
          </span>
        ))}
      </div>
      <svg viewBox="0 0 400 360" className="gt-symgroup-svg" preserveAspectRatio="xMidYMid meet" width="100%">
        {/* Cube edges */}
        {edges.map(([a, b], i) => {
          const [x1, y1] = proj[a]; const [x2, y2] = proj[b];
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="gt-symgroup-cube-edge" />;
        })}
        {/* Vertices */}
        {proj.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.5} className="gt-symgroup-vertex" />)}
        {/* Axes */}
        {C4_AXES.map((ax, i) => <g key={`c4-${i}`} onMouseEnter={() => setHighlight('C4')} onMouseLeave={() => setHighlight(null)}>{drawAxis(ax.a, ax.b, `gt-symgroup-axis-c4 ${highlight === 'C4' ? 'active' : ''}`)}</g>)}
        {C3_AXES.map((ax, i) => <g key={`c3-${i}`} onMouseEnter={() => setHighlight('C3')} onMouseLeave={() => setHighlight(null)}>{drawAxis(ax.a, ax.b, `gt-symgroup-axis-c3 ${highlight === 'C3' ? 'active' : ''}`)}</g>)}
        {C2_AXES.map((ax, i) => <g key={`c2-${i}`} onMouseEnter={() => setHighlight('C2')} onMouseLeave={() => setHighlight(null)}>{drawAxis(ax.a, ax.b, `gt-symgroup-axis-c2 ${highlight === 'C2' ? 'active' : ''}`)}</g>)}
      </svg>
      <div className="gt-symgroup-legend">
        <span><span className="gt-symgroup-swatch" style={{ background: 'var(--accent)' }} />C₄ 面轴</span>
        <span><span className="gt-symgroup-swatch" style={{ background: 'var(--accent-2)' }} />C₃ 体对角</span>
        <span><span className="gt-symgroup-swatch" style={{ background: 'var(--gold)' }} />C₂ 棱轴</span>
      </div>
      {highlight && (
        <div className="gt-aside" style={{ marginTop: 12 }}>
          <strong>{highlight}</strong> — {lang === 'zh' ? countsZh[highlight] : counts[highlight]}
        </div>
      )}
      <div className="gt-aside" style={{ marginTop: 12 }}>
        {tr({ zh: '合计: 24 个旋转 (E + 6 C₄ + 3 C₂面 + 8 C₃ + 6 C₂棱) + 24 个反射 (i + 6 σ_h + 6 σ_d + 8 S₆ + 6 S₄) = 48。这就是 O_h, 立方体的全对称群。', en: 'In total: 24 rotations (E + 6 C₄ + 3 C₂-face + 8 C₃ + 6 C₂-edge) + 24 reflections (i + 6 σ_h + 6 σ_d + 8 S₆ + 6 S₄) = 48. This is O_h, the full cube symmetry group.'
        })}
      </div>
    </div>
  );
}

export default function ActionsBurnside() {
  return (
      <GTSec id="actions-burnside" className="gt-sec">
        <div className="gt-sec-num">§18</div>
        <h2 className="gt-sec-title">
          <L zh="群作用与 Burnside — 计数对称等价" en="Group actions & Burnside — counting up to symmetry" />
        </h2>
        <p>
          <L
            zh={<>到目前为止, 我们把 G 看作「自身」 — 元素的集合和乘法。但群的真正力量在于 <strong>作用</strong> 在别的集合上。魔方群作用于 26 个小块的位置和方向; 魔方的 48 个外部对称群作用于整个 G 自身。</>}
            en={<>So far we have treated G as the group itself — a set of elements with multiplication. But the real power of a group is in how it <strong>acts</strong> on other sets. G acts on the 26 cubies and their orientations; the 48-element outer symmetry group acts on G itself.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 18.1 — 群作用', en: 'Definition 18.1 — group action'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>群 <span className="gt-math">G</span> 在集合 <span className="gt-math">X</span> 上的 <strong>作用</strong> 是一个映射 <span className="gt-math">G × X → X</span>, <span className="gt-math">(g, x) ↦ g · x</span>, 满足:</>}
              en={<>An <strong>action</strong> of group G on a set X is a map <span className="gt-math">G × X → X</span>, <span className="gt-math">(g, x) ↦ g · x</span>, satisfying:</>}
            />
            <ul style={{ paddingLeft: 24, margin: '8px 0' }}>
              <li><span className="gt-math">e · x = x</span> {tr({ zh: '(单位元固定一切)', en: '(identity fixes everything)'
            })}</li>
              <li><span className="gt-math">(g · h) · x = g · (h · x)</span> {tr({ zh: '(乘法兼容)', en: '(compatible with multiplication)'
            })}</li>
            </ul>
            <L
              zh={<>对每个 <span className="gt-math">x ∈ X</span>, 它的 <strong>轨道</strong> <span className="gt-math">G·x = {`{g · x : g ∈ G}`}</span> 是 X 的子集。 <strong>稳定子</strong> <span className="gt-math">Stab(x) = {`{g ∈ G : g · x = x}`}</span> 是 G 的子群。轨道-稳定子定理:|G·x| = [G : Stab(x)]。</>}
              en={<>For each <span className="gt-math">x ∈ X</span>, its <strong>orbit</strong> is <span className="gt-math">G·x = {`{g · x : g ∈ G}`}</span> ⊆ X. Its <strong>stabiliser</strong> is <span className="gt-math">Stab(x) = {`{g ∈ G : g · x = x}`}</span>, a subgroup of G. The orbit-stabiliser theorem: |G·x| = [G : Stab(x)].</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="18.1  立方体的 48 个外部对称 — 全对称群 O_h" en="18.1  The 48 outer symmetries of the cube — group O_h" />
        </h3>
        <p>
          <L
            zh={<>魔方除了内部魔方群 G 之外, 还有「整体作为一个立方体」 的对称群 — 共 <strong>48 个</strong> 元素, 在化学和晶体学里叫 <strong>O_h</strong>。把它分解成 10 个共轭类:</>}
            en={<>Beyond the internal cube group G, the cube as a 3D object has its own symmetry group of <strong>48 elements</strong> — known in chemistry/crystallography as <strong>O_h</strong>. It decomposes into 10 conjugacy classes:</>}
          />
        </p>
        <CubeSymmetryAxes />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="18.2  魔方上的几个自然作用" en="18.2  Natural cube actions" />
        </h3>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li>
            <L
              zh={<><strong>G 作用于 54 个色块</strong>: 每个面转把色块送到新位置。轨道分解: 一个 24 元轨道 (角块色块) + 一个 24 元轨道 (棱块色块) + 6 个单元素轨道 (中心)。</>}
              en={<><strong>G acts on the 54 stickers</strong>: each face turn sends stickers to new positions. The orbit decomposition: a 24-sticker orbit (corner stickers), a 24-sticker orbit (edge stickers), and 6 singleton orbits (centres).</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>G 作用于 26 个小块</strong>: 一个 8 元轨道 (角块) + 一个 12 元轨道 (棱块) + 6 个单元素轨道 (中心)。这告诉我们 G 是 「8 角 × 12 棱」的对称变换群。</>}
              en={<><strong>G acts on the 26 cubies</strong>: an 8-element orbit (corners), a 12-element orbit (edges), and 6 singleton orbits (centres). This tells us G "lives on" 8 corners + 12 edges.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>48 个外部对称群作用于 G 自身</strong> (共轭作用): 这是 §8.2 的共轭类和 §11 的 Rokicki 证明用到的关键作用。</>}
              en={<><strong>The 48-element outer symmetry group acts on G itself</strong> by conjugation. This is the action behind §8.2's conjugacy classes and §11's Rokicki proof.</>}
            />
          </li>
        </ul>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="18.3  Burnside 引理 (轨道计数定理)" en="18.3  Burnside's lemma (orbit counting)" />
        </h3>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 18.2 — Burnside', en: 'Theorem 18.2 — Burnside' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>设 G 作用于有限集 X。则 X 在 G 下的 <strong>轨道数</strong> 等于「每个 g 的不动点数」的平均:</>}
              en={<>Let G act on a finite set X. The number of <strong>orbits</strong> equals the average number of fixed points over G:</>}
            />
            <TeXBlock src={`\\#\\,\\text{orbits} \\;=\\; \\frac{1}{|G|} \\sum_{g \\in G} |\\!\\operatorname{Fix}(g)|`} />
          </div>
        </div>
        <p>
          <L
            zh={<>把它用到「48 个外部对称群作用于 G」 — 给出 「魔方真正不同的状态数」(忽略整体旋转和镜像)。每个对称变换 g 的不动点 Fix(g) 是 「在 g 下保持不变」 的魔方状态。</>}
            en={<>Apply it to the 48-element outer cube symmetry group acting on G — that gives the count of "essentially distinct" cube states (ignoring whole-cube rotations and mirrors). For each symmetry g, Fix(g) is the set of cube states invariant under g.</>}
          />
        </p>
        <SymmetryPicker />
        <BurnsideMiniTable />
        <p>
          <L
            zh={<>把这些不动点数加起来, 除以 |D| = 48 (外部对称群的阶), 得:</>}
            en={<>Sum the fixed-point counts and divide by |D| = 48 (the order of the outer symmetry group):</>}
          />
        </p>
        <TeXBlock src={`\\#\\,\\text{essentially distinct states} \\;=\\; \\frac{1}{48} \\sum_{g \\in D} |\\!\\operatorname{Fix}(g)| \\;\\approx\\; 901{,}083{,}404{,}981{,}813{,}616`} />
        <p>
          <L
            zh={<>这个数比 |G| / 48 ≈ 9.01 × 10¹⁷ 略大 — 因为只有少数状态 (如 superflip) 拥有完整 48 重对称, 大多数状态没有任何外部对称, 所以「真正不同的状态数」更接近 |G| / 48。</>}
            en={<>This number is slightly bigger than |G| / 48 ≈ 9.01 × 10¹⁷ — because only a handful of states (like superflip) carry full 48-fold symmetry, while most states have none. So the "truly distinct" count is just a touch above the naive |G| / 48.</>}
          />
        </p>
        <div className="gt-aside">
          <L
            zh={<>这个数字是 「魔方真正不同的状态数」 的精确答案。Rokicki 团队的 God's number 证明也以此对称化为基础, 把 4.3 × 10¹⁹ 状态化为 ~9 × 10¹⁷ 等价类, 加上 Kociemba two-phase 的陪集划分, 把这些再聚集到 ~2 × 10⁹ 个 「set」 去暴力验证 ≤ 20 步。</>}
            en={<>This is the precise answer to "how many fundamentally different cube states are there." Rokicki's God's-number proof rests on this symmetry reduction: 4.3 × 10¹⁹ states → ~9 × 10¹⁷ equivalence classes, further grouped into ~2 × 10⁹ "sets" via Kociemba two-phase cosets, then brute-force checked ≤ 20.</>}
          />
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="18.4  轨道-稳定子定理在魔方上的具体例子" en="18.4  Orbit-stabiliser on the cube" />
        </h3>
        <OrbitExplorer />
        <p>
          <L
            zh={<>取 X = 26 个小块 (角块 + 棱块), G 是魔方群作用其上。 任选一个角块 c (比如 URF, 位置 0)。 它的轨道 G · c = 8 个角块位置, 因为 G 能把 URF 送到任何角块位置。 它的稳定子 Stab(c) = 「不动 URF 的所有操作」 — 阶为 |G| / 8 = 5,406,500,409,311,232,000。</>}
            en={<>Take X = 26 cubies (corners + edges), G acting. Pick any corner c (say URF, position 0). Its orbit G · c is all 8 corner positions, since G can send URF anywhere. Its stabiliser Stab(c) is the subgroup of operations fixing URF — order |G| / 8 = 5,406,500,409,311,232,000.</>}
          />
        </p>
        <TeXBlock src={`|G| \\;=\\; |\\!\\operatorname{Orbit}(c)| \\cdot |\\!\\operatorname{Stab}(c)| \\;=\\; 8 \\cdot 5.4 \\times 10^{18}`} />
        <p>
          <L
            zh={<>同样取一个棱块: |Orbit| = 12, |Stab| = |G| / 12 ≈ 3.6 × 10¹⁸。轨道-稳定子定理是 G 「分而治之」 的代数基础 — 也是数据结构上很多魔方 solver 用 「按角块分类 + 按棱块分类」 双查表的理论依据。</>}
            en={<>Pick an edge: |Orbit| = 12, |Stab| = |G| / 12 ≈ 3.6 × 10¹⁸. Orbit-stabiliser is the divide-and-conquer principle behind many cube solvers' two-table designs (one keyed by corners, one by edges).</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="18.5  Cayley 定理 — 每个群都是置换群" en="18.5  Cayley's theorem — every group is a permutation group" />
        </h3>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 18.3 — Cayley', en: 'Theorem 18.3 — Cayley' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>任何群 G 都同构于某个对称群 <TeX src={`S_n`} /> (<TeX src={`n = |G|`} />) 的子群。 证明: G 通过左乘作用在自己身上, 这给出嵌入 <TeX src={`G \\hookrightarrow \\operatorname{Sym}(G)`} />。</>}
              en={<>Every group G embeds isomorphically as a subgroup of some symmetric group <TeX src={`S_n`} /> (<TeX src={`n = |G|`} />). Proof: G acts on itself by left multiplication, giving an embedding <TeX src={`G \\hookrightarrow \\operatorname{Sym}(G)`} />.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>这个定理在魔方上既显然又惊人:G 同构于 「G 上的左乘置换群」 的子群 (维度 4.3 × 10¹⁹) 。但实际上, G 嵌入 S₈ × S₁₂ 维度只是 (8! + 12!) — 这是更紧凑的「自然嵌入」, 也是状态向量 (cp, ep) 一定足以描述群元素的根本原因。</>}
            en={<>The theorem is both obvious and stunning on the cube: G embeds in the symmetric group on |G| = 4.3 × 10¹⁹ elements. But in practice, G fits into S₈ × S₁₂ (dimension 8! + 12!) — the much tighter "natural embedding" that justifies why the (cp, ep) state vector suffices to describe a group element.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="18.6  Oₕ 共轭类与典型 Fix(g)" en="18.6  Conjugacy classes of Oₕ and typical Fix(g)" />
        </h3>
        <p>
          <L
            zh={<>外部对称群 <TeX src={`O_h`} /> (48 元) 作用在 G 上, 每个元素 g 的 <strong>不动点集</strong> <TeX src={`\\operatorname{Fix}(g) = \\{x \\in G : g \\cdot x = x\\}`} /> 大小取决于 g 所属共轭类。 10 个共轭类的典型 Fix(g):</>}
            en={<>The 48-element <TeX src={`O_h`} /> acts on G; each <TeX src={`g \\in O_h`} />'s <strong>fixed-point set</strong> <TeX src={`\\operatorname{Fix}(g)`} /> depends on its conjugacy class. Typical values across the 10 classes:</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '类', en: 'Class'
            })}</th><th>{tr({ zh: '元素数', en: 'Size'
            })}</th><th>{tr({ zh: '描述', en: 'Description' })}</th><th>|Fix(g)|</th></tr>
          </thead>
          <tbody>
            <tr><td>e</td><td className="num">1</td><td>{tr({ zh: '恒等', en: 'identity'
            })}</td><td className="num">|G| = 4.33 × 10¹⁹</td></tr>
            <tr><td><TeX src={`C_4`} /></td><td className="num">6</td><td>{tr({ zh: '90° 面轴旋转', en: '90° face-axis rotation'
            })}</td><td className="num">≈ √|G| ≈ 6.6 × 10⁹</td></tr>
            <tr><td><TeX src={`C_4^2 = C_2`} /></td><td className="num">3</td><td>{tr({ zh: '180° 面轴', en: '180° face-axis'
            })}</td><td className="num">≈ |G|^{`{1/2}`} · 倍数</td></tr>
            <tr><td><TeX src={`C_3`} /></td><td className="num">8</td><td>{tr({ zh: '120° 体对角线', en: '120° body-diagonal'
            })}</td><td className="num">≈ |G|^{`{1/3}`} ≈ 3.5 × 10⁶</td></tr>
            <tr><td><TeX src={`C_2'`} /></td><td className="num">6</td><td>{tr({ zh: '180° 棱中点轴', en: '180° edge-midpoint axis'
            })}</td><td className="num">≈ 9.3 × 10⁹</td></tr>
            <tr><td>i</td><td className="num">1</td><td>{tr({ zh: '中心反演', en: 'inversion through centre' })}</td><td className="num">≈ 10¹⁰</td></tr>
            <tr><td><TeX src={`S_6, S_4, \\sigma_h, \\sigma_d`} /></td><td className="num">23</td><td>{tr({ zh: '改进 / 镜像 / 旋反', en: 'improper / mirror / rotoreflection'
            })}</td><td className="num">{tr({ zh: '各类 10⁶–10¹⁰ 量级', en: 'class-dependent, 10⁶–10¹⁰ each'
            })}</td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>典型 「k-fold 对称」 给出 <TeX src={`|\\operatorname{Fix}(g)| \\sim |G|^{1/k}`} /> 量级 (因为 k-fold 对称要求 (cp, co, ep, eo) 各自落在自己的 k-轨道 fixed locus)。 这是 Cauchy–Frobenius / Burnside 引理在魔方上的实际数值表现。</>}
            en={<>A typical "k-fold symmetric" element gives <TeX src={`|\\operatorname{Fix}(g)| \\sim |G|^{1/k}`} /> (because k-fold symmetry pins each of cp, co, ep, eo onto its own k-orbit fixed locus). This is the practical numerical form of the Cauchy–Frobenius / Burnside count applied to the cube.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="18.7  Pólya 计数 — 6-色立方体染色 = 30" en="18.7  Pólya enumeration — 30 distinct 6-coloured cubes" />
        </h3>
        <p>
          <L
            zh={<>经典 Pólya 应用: 「用 6 种颜色 给立方体 6 个面染色, 共有多少种本质不同的方式 (考虑 24 个旋转对称)?」 用 Burnside:</>}
            en={<>The classic Pólya example: "how many essentially different ways to colour the 6 faces of a cube with 6 colours, modulo 24 rotations?" By Burnside:</>}
          />
        </p>
        <TeXBlock src={`\\#\\,\\text{colourings} \\;=\\; \\frac{1}{24} \\sum_{g \\in \\text{Rot}(\\text{cube})} 6^{\\,\\text{cycles}(g)}`} />
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '旋转类', en: 'Rotation class'
            })}</th><th>{tr({ zh: '元素数', en: 'Count'
            })}</th><th>{tr({ zh: '面上循环数', en: '#cycles on faces'
            })}</th><th><TeX src={`6^{\\#\\text{cycles}}`} /></th><th>{tr({ zh: '贡献', en: 'Contribution'
            })}</th></tr>
          </thead>
          <tbody>
            <tr><td>e</td><td className="num">1</td><td className="num">6</td><td className="num">46,656</td><td className="num">46,656</td></tr>
            <tr><td><TeX src={`C_4`} /> (90°)</td><td className="num">6</td><td className="num">3</td><td className="num">216</td><td className="num">1,296</td></tr>
            <tr><td><TeX src={`C_2`} /> (180°)</td><td className="num">3</td><td className="num">4</td><td className="num">1,296</td><td className="num">3,888</td></tr>
            <tr><td><TeX src={`C_3`} /></td><td className="num">8</td><td className="num">2</td><td className="num">36</td><td className="num">288</td></tr>
            <tr><td><TeX src={`C_2'`} /></td><td className="num">6</td><td className="num">3</td><td className="num">216</td><td className="num">1,296</td></tr>
            <tr><td>{tr({ zh: '求和', en: 'Sum' })}</td><td colSpan={3} className="num"><TeX src={`\\sum`} /></td><td className="num"><strong>53,424</strong></td></tr>
          </tbody>
        </table>
        <TeXBlock src={`\\#\\,\\text{colourings} \\;=\\; \\frac{53{,}424}{24} \\;=\\; 2{,}226. \\quad \\text{(With exactly 6 distinct colours: } 6! / 24 = 30.\\text{)}`} />
        <p>
          <L
            zh={<>用「6 个面各取 6 种颜色一次」(即恰好每色用 1 次) 时, 结果是 <TeX src={`6!/24 = 30`} />。 这是经典魔方背后的 「30 个本质不同的着色立方体」 — 但 Erno Rubik 在 1974 年只想用 1 个特定着色, 然后让面块可以重排 (这才是 4.3 × 10¹⁹)。 两种 「数法」 数学上同源 (Burnside), 数量级差 18 个数量级。</>}
            en={<>For "exactly 6 distinct colours, one per face," the answer is <TeX src={`6!/24 = 30`} />. These are the 30 essentially distinct coloured cubes — but Erno Rubik (1974) used a single fixed colouring and let the stickers move around, giving 4.3 × 10¹⁹. Both counts are Burnside-style, separated by 18 orders of magnitude.</>}
          />
        </p>
      </GTSec>
  );
}
