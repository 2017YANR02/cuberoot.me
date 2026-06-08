'use client';

import { useState, useMemo, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

// ── Types ─────────────────────────────────────────────────────────────────────

type CrystalSystem = 'triclinic' | 'monoclinic' | 'orthorhombic' | 'tetragonal' | 'trigonal' | 'hexagonal' | 'cubic';

interface PointGroupEntry {
  schoenflies: string;
  hm: string;
  system: CrystalSystem;
  order: number;
}

interface TreeNode {
  id: string;
  labelZh: string;
  labelEn: string;
  yes?: string;
  no?: string;
  isLeaf?: boolean;
  symbol?: string;
  orderFormula?: (n: number) => number;
  familyDesc?: { zh: string; en: string
    zhHant?: string;
 };
    labelZhHant?: string;
}

// ── Static Data ───────────────────────────────────────────────────────────────

const CRYSTAL_SYSTEMS: { key: CrystalSystem; zh: string; en: string; color: string; bravais: number; centerings: string[]
    zhHant?: string;
 }[] = [
  { key: 'triclinic',     zh: '三斜',   en: 'Triclinic',     color: '#8B2E3C', bravais: 1, centerings: ['P'] },
  { key: 'monoclinic',    zh: '单斜',   en: 'Monoclinic',    color: '#2A4D69', bravais: 2, centerings: ['P', 'C'],
      zhHant: "單斜"
},
  { key: 'orthorhombic',  zh: '正交',   en: 'Orthorhombic',  color: '#3F7050', bravais: 4, centerings: ['P', 'C', 'I', 'F'] },
  { key: 'tetragonal',    zh: '四方',   en: 'Tetragonal',    color: '#B8860B', bravais: 2, centerings: ['P', 'I'] },
  { key: 'trigonal',      zh: '三方',   en: 'Trigonal',      color: '#6B4E9C', bravais: 1, centerings: ['R'] },
  { key: 'hexagonal',     zh: '六方',   en: 'Hexagonal',     color: '#C2410C', bravais: 1, centerings: ['P'] },
  { key: 'cubic',         zh: '立方',   en: 'Cubic',         color: '#5C7CA0', bravais: 3, centerings: ['P', 'I', 'F'] },
];

// 32 crystallographic point groups
const POINT_GROUPS: PointGroupEntry[] = [
  // Triclinic (2)
  { schoenflies: 'C₁',   hm: '1',      system: 'triclinic',    order: 1  },
  { schoenflies: 'Cᵢ',   hm: '-1',     system: 'triclinic',    order: 2  },
  // Monoclinic (3)
  { schoenflies: 'C₂',   hm: '2',      system: 'monoclinic',   order: 2  },
  { schoenflies: 'Cₛ',   hm: 'm',      system: 'monoclinic',   order: 2  },
  { schoenflies: 'C₂ₕ',  hm: '2/m',    system: 'monoclinic',   order: 4  },
  // Orthorhombic (3)
  { schoenflies: 'D₂',   hm: '222',    system: 'orthorhombic', order: 4  },
  { schoenflies: 'C₂ᵥ',  hm: 'mm2',    system: 'orthorhombic', order: 4  },
  { schoenflies: 'D₂ₕ',  hm: 'mmm',    system: 'orthorhombic', order: 8  },
  // Tetragonal (7)
  { schoenflies: 'C₄',   hm: '4',      system: 'tetragonal',   order: 4  },
  { schoenflies: 'S₄',   hm: '-4',     system: 'tetragonal',   order: 4  },
  { schoenflies: 'C₄ₕ',  hm: '4/m',    system: 'tetragonal',   order: 8  },
  { schoenflies: 'D₄',   hm: '422',    system: 'tetragonal',   order: 8  },
  { schoenflies: 'C₄ᵥ',  hm: '4mm',    system: 'tetragonal',   order: 8  },
  { schoenflies: 'D₂d',  hm: '-42m',   system: 'tetragonal',   order: 8  },
  { schoenflies: 'D₄ₕ',  hm: '4/mmm',  system: 'tetragonal',   order: 16 },
  // Trigonal (5)
  { schoenflies: 'C₃',   hm: '3',      system: 'trigonal',     order: 3  },
  { schoenflies: 'S₆',   hm: '-3',     system: 'trigonal',     order: 6  },
  { schoenflies: 'D₃',   hm: '32',     system: 'trigonal',     order: 6  },
  { schoenflies: 'C₃ᵥ',  hm: '3m',     system: 'trigonal',     order: 6  },
  { schoenflies: 'D₃d',  hm: '-3m',    system: 'trigonal',     order: 12 },
  // Hexagonal (7)
  { schoenflies: 'C₆',   hm: '6',      system: 'hexagonal',    order: 6  },
  { schoenflies: 'C₃ₕ',  hm: '-6',     system: 'hexagonal',    order: 6  },
  { schoenflies: 'C₆ₕ',  hm: '6/m',    system: 'hexagonal',    order: 12 },
  { schoenflies: 'D₆',   hm: '622',    system: 'hexagonal',    order: 12 },
  { schoenflies: 'C₆ᵥ',  hm: '6mm',    system: 'hexagonal',    order: 12 },
  { schoenflies: 'D₃ₕ',  hm: '-6m2',   system: 'hexagonal',    order: 12 },
  { schoenflies: 'D₆ₕ',  hm: '6/mmm',  system: 'hexagonal',    order: 24 },
  // Cubic (5)
  { schoenflies: 'T',    hm: '23',     system: 'cubic',        order: 12 },
  { schoenflies: 'Tₕ',   hm: 'm-3',    system: 'cubic',        order: 24 },
  { schoenflies: 'O',    hm: '432',    system: 'cubic',        order: 24 },
  { schoenflies: 'Td',   hm: '-43m',   system: 'cubic',        order: 24 },
  { schoenflies: 'Oₕ',   hm: 'm-3m',   system: 'cubic',        order: 48 },
];

// Decision tree nodes for Schoenflies classification
const TREE_NODES: TreeNode[] = [
  { id: 'linear',    labelZh: '是线形分子？(如 CO₂)', labelEn: 'Linear molecule? (e.g. CO₂)',
    yes: 'linearSigH', no: 'highsym',
      labelZhHant: "是線形分子？(如 CO₂)"
},
  { id: 'linearSigH', labelZh: '有 σₕ？', labelEn: 'Has σₕ?',
    yes: 'dinfh', no: 'cinfv' },
  { id: 'dinfh', labelZh: '', labelEn: '', isLeaf: true, symbol: 'D∞h',
    familyDesc: { zh: '线形+反演中心，如 CO₂, H₂', en: 'Linear + inversion centre, e.g. CO₂, H₂',
        zhHant: "線形+反演中心，如 CO₂, H₂"
    } },
  { id: 'cinfv', labelZh: '', labelEn: '', isLeaf: true, symbol: 'C∞v',
    familyDesc: { zh: '线形无反演，如 HCl, CO', en: 'Linear, no inversion, e.g. HCl, CO',
        zhHant: "線形無反演，如 HCl, CO"
    } },
  { id: 'highsym', labelZh: '高对称（多面体：T/O/I族）？', labelEn: 'High symmetry (polyhedral: T/O/I family)?',
    yes: 'whichpoly', no: 'cn',
      labelZhHant: "高對稱（多面體：T/O/I族）？"
},
  { id: 'whichpoly', labelZh: '有 C₅ 轴？', labelEn: 'Has a C₅ axis?',
    yes: 'iclass', no: 'octtet',
      labelZhHant: "有 C₅ 軸？"
},
  { id: 'iclass', labelZh: '有反演中心 i？', labelEn: 'Has inversion centre i?',
    yes: 'ih', no: 'iche' },
  { id: 'ih',   labelZh: '', labelEn: '', isLeaf: true, symbol: 'Iₕ',
    familyDesc: { zh: 'C₅+i，如 C₆₀ (巴克球)，|G|=120', en: 'C₅ + i, e.g. C₆₀ (buckminsterfullerene), |G|=120' } },
  { id: 'iche', labelZh: '', labelEn: '', isLeaf: true, symbol: 'I',
    familyDesc: { zh: 'C₅，无反演，|G|=60', en: 'C₅, no inversion, |G|=60',
        zhHant: "C₅，無反演，|G|=60"
    } },
  { id: 'octtet', labelZh: '有 C₄ 轴？', labelEn: 'Has a C₄ axis?',
    yes: 'oclass', no: 'tclass',
      labelZhHant: "有 C₄ 軸？"
},
  { id: 'oclass', labelZh: '有反演中心 i？', labelEn: 'Has inversion centre i?',
    yes: 'oh', no: 'o' },
  { id: 'oh',   labelZh: '', labelEn: '', isLeaf: true, symbol: 'Oₕ',
    familyDesc: { zh: 'C₄+i，如 SF₆，|G|=48；晶学最高对称', en: 'C₄ + i, e.g. SF₆, |G|=48; highest-symmetry crystal class',
        zhHant: "C₄+i，如 SF₆，|G|=48；晶學最高對稱"
    } },
  { id: 'o',    labelZh: '', labelEn: '', isLeaf: true, symbol: 'O',
    familyDesc: { zh: '纯八面体旋转，O≅S₄，|G|=24', en: 'Pure octahedral rotations, O≅S₄, |G|=24',
        zhHant: "純八面體旋轉，O≅S₄，|G|=24"
    } },
  { id: 'tclass', labelZh: '有 S₄ 轴（无 σₕ/σᵥ）？', labelEn: 'Has S₄ axis (no σₕ/σᵥ)?',
    yes: 'td', no: 'tcheck',
      labelZhHant: "有 S₄ 軸（無 σₕ/σᵥ）？"
},
  { id: 'td',   labelZh: '', labelEn: '', isLeaf: true, symbol: 'Td',
    familyDesc: { zh: 'Td≅S₄（抽象），如 CH₄，|G|=24；无 i', en: 'Td≅S₄ (abstract), e.g. CH₄, |G|=24; no inversion',
        zhHant: "Td≅S₄（抽象），如 CH₄，|G|=24；無 i"
    } },
  { id: 'tcheck', labelZh: '有反演中心 i？', labelEn: 'Has inversion centre i?',
    yes: 'th', no: 'te' },
  { id: 'th',   labelZh: '', labelEn: '', isLeaf: true, symbol: 'Tₕ',
    familyDesc: { zh: 'T+i，T≅A₄，|G|=24', en: 'T + i, T≅A₄, |G|=24' } },
  { id: 'te',   labelZh: '', labelEn: '', isLeaf: true, symbol: 'T',
    familyDesc: { zh: '纯四面体旋转，T≅A₄，|G|=12', en: 'Pure tetrahedral rotations, T≅A₄, |G|=12',
        zhHant: "純四面體旋轉，T≅A₄，|G|=12"
    } },
  { id: 'cn',   labelZh: '主轴 Cₙ（找最高旋转阶）', labelEn: 'Principal axis Cₙ (find highest rotation order)',
    yes: 'perpc2', no: 'cn',
      labelZhHant: "主軸 Cₙ（找最高旋轉階）"
},
  { id: 'perpc2', labelZh: '有 n 个垂直 C₂ 轴？', labelEn: 'Are there n perpendicular C₂ axes?',
    yes: 'dclass', no: 'cclass',
      labelZhHant: "有 n 個垂直 C₂ 軸？"
},
  { id: 'dclass', labelZh: '有 σₕ？', labelEn: 'Has σₕ (horizontal mirror)?',
    yes: 'dnh', no: 'dndcheck' },
  { id: 'dnh',  labelZh: '', labelEn: '', isLeaf: true, symbol: 'Dₙₕ',
    familyDesc: { zh: 'C₆H₆=D₆ₕ；|G|=4n', en: 'e.g. C₆H₆=D₆h; |G|=4n' } },
  { id: 'dndcheck', labelZh: '有 n 个 σ_d（二面镜）？', labelEn: 'Has n dihedral mirrors σ_d?',
    yes: 'dnd', no: 'dn',
      labelZhHant: "有 n 個 σ_d（二面鏡）？"
},
  { id: 'dnd',  labelZh: '', labelEn: '', isLeaf: true, symbol: 'Dₙd',
    familyDesc: { zh: '如 allene (D₂d)；|G|=4n', en: 'e.g. allene (D₂d); |G|=4n' } },
  { id: 'dn',   labelZh: '', labelEn: '', isLeaf: true, symbol: 'Dₙ',
    familyDesc: { zh: '纯旋转轴，无镜面；|G|=2n', en: 'Pure rotation axes, no mirrors; |G|=2n',
        zhHant: "純旋轉軸，無鏡面；|G|=2n"
    } },
  { id: 'cclass', labelZh: '有 σₕ？', labelEn: 'Has σₕ (horizontal mirror)?',
    yes: 'cnh', no: 'cvcheck' },
  { id: 'cnh',  labelZh: '', labelEn: '', isLeaf: true, symbol: 'Cₙₕ',
    familyDesc: { zh: '旋转轴 + 水平镜；|G|=2n', en: 'Rotation axis + horizontal mirror; |G|=2n',
        zhHant: "旋轉軸 + 水平鏡；|G|=2n"
    } },
  { id: 'cvcheck', labelZh: '有 n 个 σᵥ？', labelEn: 'Has n vertical mirrors σᵥ?',
    yes: 'cnv', no: 's2ncheck',
      labelZhHant: "有 n 個 σᵥ？"
},
  { id: 'cnv',  labelZh: '', labelEn: '', isLeaf: true, symbol: 'Cₙᵥ',
    familyDesc: { zh: 'NH₃=C₃ᵥ, H₂O=C₂ᵥ；|G|=2n', en: 'NH₃=C₃v, H₂O=C₂v; |G|=2n' } },
  { id: 's2ncheck', labelZh: '有 S₂ₙ 轴？', labelEn: 'Has S₂ₙ improper rotation axis?',
    yes: 's2n', no: 'cn_leaf',
      labelZhHant: "有 S₂ₙ 軸？"
},
  { id: 's2n', labelZh: '', labelEn: '', isLeaf: true, symbol: 'S₂ₙ',
    familyDesc: { zh: '纯转反轴（偶数 n），如 S₄；|G|=2n', en: 'Pure rotoreflection (even n), e.g. S₄; |G|=2n',
        zhHant: "純轉反軸（偶數 n），如 S₄；|G|=2n"
    } },
  { id: 'cn_leaf', labelZh: '', labelEn: '', isLeaf: true, symbol: 'Cₙ',
    familyDesc: { zh: '纯旋转；|G|=n；n=1: C₁', en: 'Pure rotation; |G|=n; n=1 gives C₁',
        zhHant: "純旋轉；|G|=n；n=1: C₁"
    } },
];

// Example molecules and their decision paths
const MOLECULE_EXAMPLES: { name: string; symbol: string; path: string[]; answers: boolean[] }[] = [
  { name: 'H₂O', symbol: 'C₂ᵥ', path: ['linear','highsym','cn','perpc2','cclass','cvcheck'], answers: [false,false,true,false,false,true] },
  { name: 'NH₃', symbol: 'C₃ᵥ', path: ['linear','highsym','cn','perpc2','cclass','cvcheck'], answers: [false,false,true,false,false,true] },
  { name: 'CH₄', symbol: 'Td',   path: ['linear','highsym','whichpoly','octtet','tclass'],     answers: [false,true,false,false,true] },
  { name: 'C₆H₆',symbol: 'D₆ₕ', path: ['linear','highsym','cn','perpc2','dclass'],           answers: [false,false,true,true,true] },
  { name: 'SF₆', symbol: 'Oₕ',   path: ['linear','highsym','whichpoly','octtet','oclass'],    answers: [false,true,false,true,true] },
  { name: 'CO₂', symbol: 'D∞h',  path: ['linear','linearSigH'],                              answers: [true,true] },
];

// ── Widget 1: Crystallographic Restriction Visualizer ─────────────────────────

function RestrictionVisualizer() {
  const lang = useLang();
  const [n, setN] = useState(6);

  const trace = useMemo(() => 2 * Math.cos((2 * Math.PI) / n), [n]);
  const isAllowed = useMemo(() => Math.abs(trace - Math.round(trace)) < 1e-9, [trace]);

  const W = 280;
  const H = 220;
  const cx = W / 2;
  const cy = H / 2 - 10;
  const r = 80;

  const vertices = useMemo(() =>
    Array.from({ length: n }, (_, k) => ({
      x: cx + r * Math.cos((2 * Math.PI * k) / n - Math.PI / 2),
      y: cy + r * Math.sin((2 * Math.PI * k) / n - Math.PI / 2),
    })), [n, cx, cy]);

  const polyPath = vertices.map((v, i) => `${i === 0 ? 'M' : 'L'}${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(' ') + ' Z';

  const traceDisplay = Math.abs(trace) < 1e-9 ? '0' : trace.toFixed(4);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="晶体学限制可视化" en="Crystallographic Restriction Visualizer" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>取旋转阶 n，看正 n 边形的顶点能否与 3D 格点相容；判据：<TeX src={String.raw`2\cos(2\pi/n) \in \mathbb{Z}`} /></>}
          en={<>Choose rotation order n; test if a regular n-gon is lattice-compatible: <TeX src={String.raw`2\cos(2\pi/n) \in \mathbb{Z}`} /></>}
        />
      </div>

      <div className="gt-panel-input-row" style={{ alignItems: 'center', gap: 16 }}>
        <label style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-dim)', minWidth: 60 }}>
          n =
        </label>
        <input
          type="range"
          min={1} max={12}
          value={n}
          onChange={e => setN(Number(e.target.value))}
          className="gt-input"
          style={{ flex: 1, minWidth: 120, cursor: 'pointer' }}
        />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color: 'var(--accent)', minWidth: 28, textAlign: 'center' }}>{n}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ flex: '0 0 auto', maxWidth: 280, minWidth: 180 }} aria-label={`Regular ${n}-gon`}>
          {/* Central lattice point */}
          <circle cx={cx} cy={cy} r={3.5} fill="var(--ink)" />
          {/* n-gon */}
          <path
            d={polyPath}
            fill={isAllowed
              ? 'color-mix(in srgb, var(--green) 18%, transparent)'
              : 'color-mix(in srgb, var(--accent) 18%, transparent)'}
            stroke={isAllowed ? 'var(--green)' : 'var(--accent)'}
            strokeWidth={1.8}
          />
          {/* Radial lattice vectors */}
          {vertices.map((v, k) => (
            <line
              key={k}
              x1={cx} y1={cy}
              x2={v.x} y2={v.y}
              stroke={isAllowed ? 'var(--green)' : 'var(--accent)'}
              strokeWidth={1.2}
              strokeDasharray="3,3"
              opacity={0.7}
            />
          ))}
          {/* Vertex dots */}
          {vertices.map((v, k) => (
            <circle key={k} cx={v.x} cy={v.y} r={3.5}
              fill={isAllowed ? 'var(--green)' : 'var(--accent)'} />
          ))}
          {/* Gap illustration for n=5,7 */}
          {(n === 5 || n === 7) && (
            <text x={cx} y={H - 4} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--accent)' }}>
              {tr({ zh: '顶点无法覆盖格点，产生间隙', en: 'Vertices leave lattice gaps',
                  zhHant: "頂點無法覆蓋格點，產生間隙"
            })}
            </text>
          )}
          {(n === 1 || n === 2 || n === 3 || n === 4 || n === 6) && (
            <text x={cx} y={H - 4} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--green)' }}>
              {tr({ zh: '顶点与格点相容，无间隙', en: 'Vertices compatible with lattice',
                  zhHant: "頂點與格點相容，無間隙"
            })}
            </text>
          )}
        </svg>

        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-dim)', marginBottom: 10 }}>
            <L zh="迹值检验" en="Trace test" />
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 14, lineHeight: 1.8 }}>
            <div>
              <TeX src={String.raw`2\cos\!\left(\tfrac{2\pi}{${n}}\right)`} />
              {' = '}
              <span style={{ fontWeight: 700, color: isAllowed ? 'var(--green)' : 'var(--accent)' }}>
                {traceDisplay}
              </span>
            </div>
            <div style={{ marginTop: 8 }}>
              {isAllowed ? (
                <span style={{ color: 'var(--green)', fontSize: 12 }}>
                  {tr({ zh: '✓ 整数，晶学允许', en: '✓ Integer — crystallographically allowed',
                      zhHant: "✓ 整數，晶學允許"
                })}
                </span>
              ) : (
                <span style={{ color: 'var(--accent)', fontSize: 12 }}>
                  {tr({ zh: '✗ 非整数，晶学禁止', en: '✗ Not integer — forbidden by lattice',
                      zhHant: "✗ 非整數，晶學禁止"
                })}
                </span>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', marginBottom: 6, letterSpacing: '0.08em' }}>
              {tr({ zh: '允许的阶：', en: 'Allowed orders:',
                  zhHant: "允許的階："
            })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(k => {
                const t = 2 * Math.cos((2 * Math.PI) / k);
                const ok = Math.abs(t - Math.round(t)) < 1e-9;
                return (
                  <button
                    key={k}
                    className={`gt-chip${k === n ? ' gt-chip-active' : ''}`}
                    onClick={() => setN(k)}
                    style={ok && k !== n ? { borderColor: 'var(--green)', color: 'var(--green)' } : undefined}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Widget 2: Point-Group Decision Tree Walker ────────────────────────────────

const TREE_MAP = Object.fromEntries(TREE_NODES.map(n => [n.id, n]));

function DecisionTreeWalker() {
  const lang = useLang();
  const [currentId, setCurrentId] = useState<string>('linear');
  const [path, setPath] = useState<{ id: string; answer: boolean }[]>([]);
  const [loadMolecule, setLoadMolecule] = useState<string>('');

  const current = TREE_MAP[currentId];

  const answer = useCallback((yes: boolean) => {
    const next = yes ? current.yes : current.no;
    if (!next) return;
    setPath(prev => [...prev, { id: currentId, answer: yes }]);
    setCurrentId(next);
  }, [current, currentId]);

  const reset = useCallback(() => {
    setCurrentId('linear');
    setPath([]);
    setLoadMolecule('');
  }, []);

  const goBack = useCallback(() => {
    if (path.length === 0) return;
    const prev = path[path.length - 1];
    setPath(p => p.slice(0, -1));
    setCurrentId(prev.id);
    setLoadMolecule('');
  }, [path]);

  const loadExample = useCallback((name: string) => {
    const mol = MOLECULE_EXAMPLES.find(m => m.name === name);
    if (!mol) return;
    setLoadMolecule(name);
    // Walk the path
    let nodeId = 'linear';
    const newPath: { id: string; answer: boolean }[] = [];
    for (let i = 0; i < mol.answers.length; i++) {
      const node = TREE_MAP[nodeId];
      if (!node) break;
      const ans = mol.answers[i];
      newPath.push({ id: nodeId, answer: ans });
      const next = ans ? node.yes : node.no;
      if (!next) break;
      nodeId = next;
    }
    setPath(newPath);
    setCurrentId(nodeId);
  }, []);

  // Build the group order label from the found symbol
  function symbolOrder(sym: string): string {
    if (sym === 'C∞v') return '∞';
    if (sym === 'D∞h') return '∞';
    if (sym.startsWith('Iₕ')) return '120';
    if (sym.startsWith('I') && !sym.startsWith('Iₕ')) return '60';
    if (sym.startsWith('Oₕ')) return '48';
    if (sym.startsWith('O') && !sym.startsWith('Oₕ')) return '24';
    if (sym.startsWith('Td')) return '24';
    if (sym.startsWith('Tₕ')) return '24';
    if (sym.startsWith('T') && !sym.startsWith('Td') && !sym.startsWith('Tₕ')) return '12';
    return '?';
  }

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="Schoenflies 决策树" en="Schoenflies Decision-Tree Walker" />
      </div>
      <div className="gt-panel-sub">
        <L zh="逐步回答对称性问题，得出点群符号；或直接载入示例分子。" en="Answer symmetry questions step by step to find the Schoenflies symbol, or load an example molecule." />
      </div>

      {/* Example molecule loader */}
      <div className="gt-panel-input-row" style={{ marginBottom: 16 }}>
        <label style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)' }}>
          <L zh="示例" en="Example" />
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {MOLECULE_EXAMPLES.map(m => (
            <button
              key={m.name}
              className={`gt-chip${loadMolecule === m.name ? ' gt-chip-active' : ''}`}
              onClick={() => loadExample(m.name)}
            >
              {m.name}
            </button>
          ))}
        </div>
        <button className="gt-btn gt-btn-ghost" onClick={reset} style={{ marginLeft: 'auto' }}>
          <L zh="重置" en="Reset" />
        </button>
      </div>

      {/* Path breadcrumbs */}
      {path.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14, alignItems: 'center' }}>
          {path.map((step, i) => {
            const node = TREE_MAP[step.id];
            return (
              <span key={i} style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>
                {i > 0 && <span style={{ margin: '0 3px', color: 'var(--rule)' }}>›</span>}
                <span style={{ color: step.answer ? 'var(--green)' : 'var(--accent)' }}>
                  {lang === 'zh' ? node.labelZh.slice(0, 10) || '…' : node.labelEn.slice(0, 16) || '…'}
                  <span style={{ opacity: 0.7 }}>:{step.answer ? (tr({ zh: '是', en: 'Y' })) : (tr({ zh: '否', en: 'N' }))}</span>
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Current question or leaf result */}
      {current.isLeaf ? (
        <div style={{
          background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-elev))',
          border: '1px solid var(--accent)',
          borderRadius: 6,
          padding: '20px 22px',
          textAlign: 'center',
        }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.1em', marginBottom: 8 }}>
            <L zh="点群" en="POINT GROUP" />
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
            {current.symbol}
          </div>
          {current.symbol && !current.symbol.includes('∞') && symbolOrder(current.symbol) !== '?' && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-dim)', marginBottom: 8 }}>
              |G| = {symbolOrder(current.symbol)}
            </div>
          )}
          {current.familyDesc && (
            <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontStyle: 'italic', color: 'var(--ink-dim)' }}>
              {(i18n.language === 'zh-Hant' ? (current.familyDesc.zhHant ?? current.familyDesc.zh) : (i18n.language.startsWith('zh') ? current.familyDesc.zh : current.familyDesc.en))}
            </div>
          )}
          <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
            {path.length > 0 && (
              <button className="gt-btn gt-btn-ghost" onClick={goBack}>
                <L zh="← 上一步" en="← Back" />
              </button>
            )}
            <button className="gt-btn" onClick={reset}>
              <L zh="重新开始" en="Start over" />
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-deep)',
          border: '1px solid var(--rule)',
          borderRadius: 6,
          padding: '18px 20px',
        }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--ink)', marginBottom: 16, lineHeight: 1.5 }}>
            {lang === 'zh' ? current.labelZh : current.labelEn}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button className="gt-btn" onClick={() => answer(true)} style={{ background: 'var(--green)' }}>
              <L zh="是 (Yes)" en="Yes" />
            </button>
            <button className="gt-btn" onClick={() => answer(false)} style={{ background: 'var(--accent)' }}>
              <L zh="否 (No)" en="No" />
            </button>
            {path.length > 0 && (
              <button className="gt-btn gt-btn-ghost" onClick={goBack}>
                <L zh="← 上一步" en="← Back" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Widget 3: 32 Crystal Classes Census Table ─────────────────────────────────

function CrystalClassesCensus() {
  const lang = useLang();
  const [activeSystem, setActiveSystem] = useState<CrystalSystem | null>(null);
  const [notation, setNotation] = useState<'schoenflies' | 'hm'>('schoenflies');
  const [hoveredSystem, setHoveredSystem] = useState<CrystalSystem | null>(null);

  const filtered = useMemo(() =>
    activeSystem ? POINT_GROUPS.filter(g => g.system === activeSystem) : POINT_GROUPS,
    [activeSystem]);

  const pgTotal = filtered.length;
  const bravaisTotal = useMemo(() => {
    const systems = activeSystem
      ? CRYSTAL_SYSTEMS.filter(s => s.key === activeSystem)
      : CRYSTAL_SYSTEMS;
    return systems.reduce((sum, s) => sum + s.bravais, 0);
  }, [activeSystem]);

  const totalPG = POINT_GROUPS.length;  // must be 32
  const totalBravais = CRYSTAL_SYSTEMS.reduce((s, c) => s + c.bravais, 0); // must be 14

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="32 晶类 / 7 晶系普查表" en="32 Crystal Classes / 7 Crystal Systems Census" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>共 32 个晶体点群（晶类），分布于 7 个晶系，配合 14 种布拉维格子，导出 230 个空间群。</>}
          en={<>Exactly 32 crystallographic point groups (crystal classes) across 7 crystal systems; combined with 14 Bravais lattices they yield 230 space groups.</>}
        />
      </div>

      {/* Notation toggle + system filter */}
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <label style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)' }}>
          <L zh="记号" en="Notation" />:
        </label>
        <button
          className={`gt-chip${notation === 'schoenflies' ? ' gt-chip-active' : ''}`}
          onClick={() => setNotation('schoenflies')}
        >
          Schoenflies
        </button>
        <button
          className={`gt-chip${notation === 'hm' ? ' gt-chip-active' : ''}`}
          onClick={() => setNotation('hm')}
        >
          Hermann-Mauguin
        </button>
      </div>

      {/* Crystal system filter row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
        <button
          className={`gt-chip${activeSystem === null ? ' gt-chip-active' : ''}`}
          onClick={() => setActiveSystem(null)}
        >
          <L zh="全部" en="All" />
        </button>
        {CRYSTAL_SYSTEMS.map(sys => (
          <button
            key={sys.key}
            className={`gt-chip${activeSystem === sys.key ? ' gt-chip-active' : ''}`}
            onClick={() => setActiveSystem(activeSystem === sys.key ? null : sys.key)}
            onMouseEnter={() => setHoveredSystem(sys.key)}
            onMouseLeave={() => setHoveredSystem(null)}
            style={activeSystem === sys.key ? { background: sys.color, borderColor: sys.color } : undefined}
          >
            {(i18n.language === 'zh-Hant' ? (sys.zhHant ?? sys.zh) : (i18n.language.startsWith('zh') ? sys.zh : sys.en))}
          </button>
        ))}
      </div>

      {/* Main grid table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="gt-compare" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--rule)', letterSpacing: '0.08em' }}>
                <L zh="晶系" en="System" />
              </th>
              <th style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--rule)', letterSpacing: '0.08em' }}>
                <L zh="点群符号" en="Point group" />
              </th>
              <th style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid var(--rule)', letterSpacing: '0.08em' }}>
                |G|
              </th>
              <th style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--rule)', letterSpacing: '0.08em' }}>
                <L zh="格心" en="Centering" />
              </th>
            </tr>
          </thead>
          <tbody>
            {CRYSTAL_SYSTEMS.filter(sys => !activeSystem || sys.key === activeSystem).map((sys, si) => {
              const groups = POINT_GROUPS.filter(g => g.system === sys.key);
              const highlighted = hoveredSystem === sys.key || activeSystem === sys.key;
              return groups.map((g, gi) => (
                <tr
                  key={g.schoenflies}
                  style={{
                    background: highlighted
                      ? `color-mix(in srgb, ${sys.color} 8%, var(--bg-elev))`
                      : si % 2 === 0 ? 'var(--bg-elev)' : 'var(--bg)',
                    transition: 'background 0.15s',
                  }}
                >
                  {gi === 0 && (
                    <td
                      rowSpan={groups.length}
                      style={{
                        padding: '8px 10px',
                        fontFamily: 'var(--serif)',
                        fontWeight: 600,
                        fontSize: 13,
                        color: sys.color,
                        borderRight: `2px solid ${sys.color}`,
                        verticalAlign: 'middle',
                        whiteSpace: 'nowrap',
                        borderBottom: '1px solid var(--rule)',
                      }}
                    >
                      {(i18n.language === 'zh-Hant' ? (sys.zhHant ?? sys.zh) : (i18n.language.startsWith('zh') ? sys.zh : sys.en))}
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)', marginTop: 3, fontWeight: 400 }}>
                        {groups.length} <L zh="群" en="groups" />
                      </div>
                    </td>
                  )}
                  <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--ink)', borderBottom: '1px dashed var(--rule)' }}>
                    {notation === 'schoenflies' ? g.schoenflies : g.hm}
                  </td>
                  <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', color: 'var(--accent)', textAlign: 'right', borderBottom: '1px dashed var(--rule)' }}>
                    {g.order}
                  </td>
                  <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', borderBottom: '1px dashed var(--rule)' }}>
                    {gi === 0 ? sys.centerings.join(', ') : ''}
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>

      {/* Tally bar */}
      <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
          <span style={{ color: 'var(--ink-faint)' }}><L zh="点群" en="Point groups" />: </span>
          <span style={{ fontWeight: 700, color: pgTotal === totalPG ? 'var(--green)' : 'var(--accent)' }}>
            {pgTotal}
          </span>
          <span style={{ color: 'var(--ink-faint)' }}> / {totalPG}</span>
          {pgTotal === totalPG && <span style={{ color: 'var(--green)', marginLeft: 4 }}>✓</span>}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
          <span style={{ color: 'var(--ink-faint)' }}><L zh="布拉维格" en="Bravais lattices" />: </span>
          <span style={{ fontWeight: 700, color: bravaisTotal === totalBravais ? 'var(--green)' : 'var(--accent)' }}>
            {bravaisTotal}
          </span>
          <span style={{ color: 'var(--ink-faint)' }}> / {totalBravais}</span>
          {bravaisTotal === totalBravais && <span style={{ color: 'var(--green)', marginLeft: 4 }}>✓</span>}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-faint)' }}>
          <L zh="→ 230 空间群" en="→ 230 space groups" />
        </div>
      </div>
    </div>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────────

export default function PointGroupsCrystal() {
  const lang = useLang();
  return (
    <GTSec id="point-groups-crystal" className="gt-sec">
      <div className="gt-sec-num">§45</div>
      <h2 className="gt-sec-title">
        <L zh="点群与晶体学" en="Point groups & crystallography" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>对称性的极致表现之一，是自然界中晶体的形态。雪花六角、金刚石正四面体、氯化钠立方——这些并非偶然的形状，而是晶格周期性对旋转阶数的铁律约束的直接体现。理解点群，就是理解有限对称操作如何组合成群；理解晶体学限制定理，就是理解"为何5次对称的晶体不存在"。</>}
          en={<>Crystals are one of nature's most dramatic manifestations of symmetry. The six-fold snowflake, tetrahedral diamond, cubic salt — none of these shapes is accidental. Each is a direct consequence of an iron constraint imposed by lattice periodicity on which rotation orders can exist. Understanding point groups means understanding how finite symmetry operations compose into a group; understanding the crystallographic restriction theorem means understanding why no periodic crystal can have true 5-fold symmetry.</>}
        />
      </p>

      {/* ── Definition: Point Group ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义：点群（有限物体的对称群）" en="Definition: Point group (symmetry group of a finite object)" />
        </div>
        <div className="gt-def-body">
          <p>
            <L
              zh={<><strong>点群</strong>是 <TeX src={String.raw`\mathbb{R}^3`} /> 的等距变换群，其中所有变换共同固定至少一个点——等价地，它是正交群 <TeX src={String.raw`O(3)`} /> 的子群。每个群元要么是<em>纯旋转</em>（行列式 +1，属于 <TeX src={String.raw`SO(3)`} />），要么是<em>非正常等距</em>（行列式 -1：镜像、反演或转反）。</>}
              en={<>A <strong>point group</strong> is a group of isometries of <TeX src={String.raw`\mathbb{R}^3`} /> that all fix at least one common point — equivalently, a subgroup of the orthogonal group <TeX src={String.raw`O(3)`} />. Each element is either a <em>proper rotation</em> (det = +1, in <TeX src={String.raw`SO(3)`} />) or an <em>improper isometry</em> (det = -1: reflection, inversion, or rotoreflection).</>}
            />
          </p>
          <p>
            <L
              zh={<>对分子而言，对称操作包括：<TeX src={String.raw`E`} />（恒等），<TeX src={String.raw`C_n`} />（绕主轴转 <TeX src={String.raw`2\pi/n`} />），<TeX src={String.raw`\sigma`} />（镜面反射），<TeX src={String.raw`i`} />（反演），<TeX src={String.raw`S_n`} />（转反：先转 <TeX src={String.raw`2\pi/n`} /> 再作垂直镜面反射）。</>}
              en={<>For molecules the symmetry operations are: <TeX src={String.raw`E`} /> (identity), <TeX src={String.raw`C_n`} /> (rotation by <TeX src={String.raw`2\pi/n`} />), <TeX src={String.raw`\sigma`} /> (mirror reflection), <TeX src={String.raw`i`} /> (inversion), and <TeX src={String.raw`S_n`} /> (rotoreflection: rotation by <TeX src={String.raw`2\pi/n`} /> followed by reflection in the perpendicular plane).</>}
            />
          </p>
          <p>
            <L
              zh={<>特别地：<TeX src={String.raw`S_1 = \sigma`} />（镜面），<TeX src={String.raw`S_2 = i`} />（反演）。含奇数 <TeX src={String.raw`n`} /> 的 <TeX src={String.raw`S_n`} /> 轴会同时蕴含独立的 <TeX src={String.raw`C_n`} /> 轴与 <TeX src={String.raw`\sigma_h`} />，因此独立的转反点群 <TeX src={String.raw`S_n`} /> 只在偶数 <TeX src={String.raw`n`} /> 时出现（如 <TeX src={String.raw`S_4, S_6`} />）。</>}
              en={<>Note the special identities: <TeX src={String.raw`S_1 = \sigma`} /> (a mirror) and <TeX src={String.raw`S_2 = i`} /> (inversion). An <TeX src={String.raw`S_n`} /> axis with odd <TeX src={String.raw`n`} /> forces both an independent <TeX src={String.raw`C_n`} /> axis and a <TeX src={String.raw`\sigma_h`} />, so the genuinely independent rotoreflection groups <TeX src={String.raw`S_n`} /> occur only for even <TeX src={String.raw`n`} /> (e.g. <TeX src={String.raw`S_4, S_6`} />).</>}
            />
          </p>
        </div>
      </div>

      {/* ── Theorem: Crystallographic Restriction ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理：晶体学限制定理" en="Theorem: Crystallographic restriction theorem" />
        </div>
        <div className="gt-thm-body">
          <p>
            <L
              zh={<>若旋转 <TeX src={String.raw`C_n`} /> 是某二维或三维格子的对称，则旋转阶 <TeX src={String.raw`n \in \{1,2,3,4,6\}`} />。等价地：<TeX src={String.raw`n`} /> 折旋转保持格子当且仅当 <TeX src={String.raw`2\cos(2\pi/n) \in \mathbb{Z}`} />。</>}
              en={<>If a rotation <TeX src={String.raw`C_n`} /> is a symmetry of a 2D or 3D lattice, then <TeX src={String.raw`n \in \{1,2,3,4,6\}`} />. Equivalently, an <TeX src={String.raw`n`} />-fold rotation preserves a lattice if and only if <TeX src={String.raw`2\cos(2\pi/n) \in \mathbb{Z}`} />.</>}
            />
          </p>
          <div className="gt-proof">
            <div className="gt-proof-title"><L zh="证明思路" en="Proof sketch" /></div>
            <p>
              <L
                zh={<>在格基下，一个保格旋转被表示为整数矩阵，其迹是整数。迹与基的选择无关，且对一个三维旋转角 <TeX src={String.raw`\theta`} /> 等于 <TeX src={String.raw`1+2\cos\theta`} />。故 <TeX src={String.raw`2\cos(2\pi/n)`} /> 必为整数，而 <TeX src={String.raw`|\cos| \le 1`} /> 将整数值限制在 <TeX src={String.raw`\{-2,-1,0,1,2\}`} />，对应 <TeX src={String.raw`n \in \{1,2,3,4,6\}`} />。5 折及 <TeX src={String.raw`n \ge 7`} /> 的情形均不满足。</>}
                en={<>In a lattice basis, a lattice-preserving rotation is represented by an integer matrix, so its trace is an integer. The trace is basis-independent and equals <TeX src={String.raw`1+2\cos\theta`} /> for a 3D rotation by <TeX src={String.raw`\theta`} />. Hence <TeX src={String.raw`2\cos(2\pi/n)`} /> must be an integer; combined with <TeX src={String.raw`|\cos|\le 1`} />, the integer values are restricted to <TeX src={String.raw`\{-2,-1,0,1,2\}`} />, giving <TeX src={String.raw`n\in\{1,2,3,4,6\}`} />. Five-fold and <TeX src={String.raw`n\ge7`} /> are all excluded.</>}
              />
            </p>
            <div className="gt-proof-end" />
          </div>
          <TeXBlock src={String.raw`2\cos\!\left(\tfrac{2\pi}{n}\right)\in\mathbb{Z} \;\Longleftrightarrow\; n\in\{1,2,3,4,6\}`} />
          <p style={{ marginTop: 12, fontSize: 14, color: 'var(--ink-dim)', fontStyle: 'italic' }}>
            <L
              zh={<><strong>推论</strong>：正因如此，3D 中恰好存在 32 个晶体点群（晶类），而非无穷多个。准晶（Shechtman 1982，诺贝尔奖 2011）以其 5/10 折衍射图样看似违反此定理，实则因准晶本质上<em>不是</em>周期格子——定理的假设条件不成立。</>}
              en={<><strong>Corollary</strong>: This is exactly why there are only 32 crystallographic point groups in 3D, not infinitely many. Quasicrystals (Shechtman 1982, Nobel 2011) show 5- and 10-fold diffraction symmetry and may seem to violate this theorem — but quasicrystals are aperiodic and hence <em>not</em> periodic lattices; the theorem's hypothesis does not apply.</>}
            />
          </p>
        </div>
      </div>

      <RestrictionVisualizer />

      {/* ── Schoenflies Families ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="Schoenflies 命名体系" en="The Schoenflies Classification" />
      </h3>

      <p>
        <L
          zh={<>Schoenflies 记号按生成元将点群分族。下表给出各族的结构与群阶：</>}
          en={<>The Schoenflies notation organises point groups by their generating elements. The table below summarises each family with its generators and group order:</>}
        />
      </p>

      <div style={{ overflowX: 'auto', margin: '20px 0' }}>
        <table className="gt-compare" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['族', 'Family', '生成元 / Generators', '|G|', '典型分子'].map((h, i) => {
                if (i === 0 && lang !== 'zh') return null;
                if (i === 1 && lang !== 'en') return null;
                const label = i < 2 ? (tr({ zh: '族', en: 'Family' })) : i === 2 ? (tr({ zh: '生成元', en: 'Generators' })) : i === 3 ? '|G|' : (tr({ zh: '典型分子', en: 'Example molecule' }));
                if (i > 1 || (i === 0 && lang === 'zh') || (i === 1 && lang === 'en')) {
                  return (
                    <th key={h} style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', padding: '7px 10px', textAlign: i === 3 ? 'right' : 'left', borderBottom: '2px solid var(--rule)', letterSpacing: '0.08em' }}>
                      {label}
                    </th>
                  );
                }
                return null;
              })}
            </tr>
          </thead>
          <tbody>
            {[
              { sym: 'Cₙ',   gen: tr({ zh: '一个 Cₙ 轴', en: 'One Cₙ axis',
                  zhHant: "一個 Cₙ 軸"
            }),              order: 'n',   ex: '—' },
              { sym: 'Cₙᵥ',  gen: tr({ zh: 'Cₙ + n 个 σᵥ', en: 'Cₙ + n vertical mirrors σᵥ',
                  zhHant: "Cₙ + n 個 σᵥ"
            }), order: '2n',  ex: 'H₂O (C₂ᵥ), NH₃ (C₃ᵥ)' },
              { sym: 'Cₙₕ',  gen: lang === 'zh' ? 'Cₙ + σₕ' : 'Cₙ + horizontal mirror σₕ', order: '2n',  ex: 'trans-N₂F₂ (C₂ₕ)' },
              { sym: 'Dₙ',   gen: tr({ zh: 'Cₙ + n 个 ⊥C₂', en: 'Cₙ + n perpendicular C₂',
                  zhHant: "Cₙ + n 個 ⊥C₂"
            }), order: '2n',  ex: '—' },
              { sym: 'Dₙₕ',  gen: lang === 'zh' ? 'Dₙ + σₕ' : 'Dₙ + σₕ',                  order: '4n',  ex: 'C₆H₆ (D₆ₕ)' },
              { sym: 'Dₙd',  gen: tr({ zh: 'Dₙ + n 个 σ_d', en: 'Dₙ + n dihedral mirrors σ_d',
                  zhHant: "Dₙ + n 個 σ_d"
            }), order: '4n', ex: 'allene (D₂d)' },
              { sym: 'S₂ₙ',  gen: tr({ zh: '一个 S₂ₙ 轴（偶数 n）', en: 'One S₂ₙ axis (even n)',
                  zhHant: "一個 S₂ₙ 軸（偶數 n）"
            }), order: '2n', ex: tr({ zh: '具 S₄ 对称的分子', en: 'molecules with S₄ symmetry',
                zhHant: "具 S₄ 對稱的分子"
            }) },
              { sym: 'T',    gen: lang === 'zh' ? '4C₃ + 3C₂（A₄）' : '4C₃ + 3C₂ (≅A₄)',   order: '12',  ex: '—' },
              { sym: 'Td',   gen: lang === 'zh' ? 'T + 6σ_d + 6S₄（≅S₄）' : 'T + 6σ_d + 6S₄ (≅S₄)', order: '24', ex: 'CH₄' },
              { sym: 'Tₕ',   gen: lang === 'zh' ? 'T + i' : 'T + i',                        order: '24',  ex: '—' },
              { sym: 'O',    gen: lang === 'zh' ? '6C₄ + 4C₃（≅S₄）' : '6C₄ + 4C₃ (≅S₄)', order: '24',  ex: tr({ zh: '正八面体骨架', en: 'Octahedral skeleton',
                  zhHant: "正八面體骨架"
            }) },
              { sym: 'Oₕ',   gen: lang === 'zh' ? 'O + i' : 'O + i',                        order: '48',  ex: 'SF₆' },
              { sym: 'I',    gen: lang === 'zh' ? '6C₅ + 10C₃（≅A₅）' : '6C₅ + 10C₃ (≅A₅)', order: '60', ex: '—' },
              { sym: 'Iₕ',   gen: lang === 'zh' ? 'I + i' : 'I + i',                        order: '120', ex: 'C₆₀' },
            ].map((row, i) => (
              <tr key={row.sym} style={{ background: i % 2 === 0 ? 'var(--bg-elev)' : 'var(--bg)' }}>
                <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)', borderBottom: '1px dashed var(--rule)', whiteSpace: 'nowrap' }}>{row.sym}</td>
                <td style={{ padding: '6px 10px', fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink-dim)', borderBottom: '1px dashed var(--rule)' }}>{row.gen}</td>
                <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', color: 'var(--accent-2)', textAlign: 'right', borderBottom: '1px dashed var(--rule)', whiteSpace: 'nowrap' }}>{row.order}</td>
                <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', borderBottom: '1px dashed var(--rule)' }}>{row.ex}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DecisionTreeWalker />

      {/* ── Classification of finite subgroups of SO(3) ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理：SO(3) 的有限子群分类" en="Theorem: Classification of finite subgroups of SO(3)" />
        </div>
        <div className="gt-thm-body">
          <p>
            <L
              zh={<><TeX src={String.raw`\mathbb{R}^3`} /> 中所有保向旋转的有限群，同构于以下之一：循环群 <TeX src={String.raw`C_n`} />（阶 <TeX src={String.raw`n`} />），二面群 <TeX src={String.raw`D_n`} />（阶 <TeX src={String.raw`2n`} />），四面体旋转群 <TeX src={String.raw`T \cong A_4`} />（阶 12），八面体旋转群 <TeX src={String.raw`O \cong S_4`} />（阶 24），或二十面体旋转群 <TeX src={String.raw`I \cong A_5`} />（阶 60）。</>}
              en={<>Every finite group of orientation-preserving rotations of <TeX src={String.raw`\mathbb{R}^3`} /> is isomorphic to exactly one of: the cyclic groups <TeX src={String.raw`C_n`} /> (order <TeX src={String.raw`n`} />), the dihedral groups <TeX src={String.raw`D_n`} /> (order <TeX src={String.raw`2n`} />), the tetrahedral rotation group <TeX src={String.raw`T\cong A_4`} /> (order 12), the octahedral rotation group <TeX src={String.raw`O\cong S_4`} /> (order 24), or the icosahedral rotation group <TeX src={String.raw`I\cong A_5`} /> (order 60).</>}
            />
          </p>
          <p>
            <L
              zh={<>向这些群中加入反演 <TeX src={String.raw`-I`} />（若其不已存在）和/或镜面，可以得到 <TeX src={String.raw`O(3)`} /> 中全部有限子群，构成完整的分子点群目录。注意：<TeX src={String.raw`T_d \cong O \cong S_4`} />（作为抽象群，阶均为 24），但 <TeX src={String.raw`T_d`} /> 与 <TeX src={String.raw`O`} /> 是 <TeX src={String.raw`O(3)`} /> 中不同的子群——同构不等于相同。</>}
              en={<>Adjoining the inversion <TeX src={String.raw`-I`} /> (when not already present) and/or reflections extends these to the complete catalogue of finite subgroups of <TeX src={String.raw`O(3)`} />. A subtlety: <TeX src={String.raw`T_d \cong O \cong S_4`} /> as abstract groups (all of order 24), but <TeX src={String.raw`T_d`} /> and <TeX src={String.raw`O`} /> are distinct subgroups of <TeX src={String.raw`O(3)`} /> — isomorphic does not mean identical.</>}
            />
          </p>
        </div>
      </div>

      {/* ── Bravais lattices and space groups ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="布拉维格子与空间群" en="Bravais Lattices and Space Groups" />
      </h3>

      <p>
        <L
          zh={<>三维中有 <strong>14 种布拉维格子</strong>，由 7 个晶系（按格点对称性区分：三斜、单斜、正交、四方、三方/菱方、六方、立方）与允许的心型（P 简单、I 体心、F 面心、C/A/B 底心、R 菱方）的组合去掉等价情形得出：</>}
          en={<>There are exactly <strong>14 Bravais lattice types</strong> in 3D, classified by the 7 crystal systems (defined by lattice point symmetry: triclinic, monoclinic, orthorhombic, tetragonal, trigonal/rhombohedral, hexagonal, cubic) combined with the allowed centering types (P primitive, I body-centred, F face-centred, C/A/B base-centred, R rhombohedral), removing duplicates:</>}
        />
      </p>

      <TeXBlock src={String.raw`1+2+4+2+1+1+3 = 14 \text{ (Bravais lattices)}`} />

      <p>
        <L
          zh={<><strong>空间群</strong>是三维晶体花样的全对称群：欧氏群 <TeX src={String.raw`E(3) = O(3)\ltimes\mathbb{R}^3`} /> 中包含 rank-3 平移格子的离散子群。它在点群操作之外还允许<em>螺旋轴</em>（旋转 + 沿轴的分数平移）和<em>滑移面</em>（反射 + 面内分数平移）。将 32 个晶体点群与 14 种布拉维格子结合，并计入上述分数平移变体，精确给出 3D 中 <strong>230 个空间群</strong>（Fedorov、Schoenflies、Barlow，1890 年代）。其中 73 个是<em>symmorphic</em>（无真正的螺旋/滑移），157 个是非 symmorphic。注意：230 ≠ 32 × 14 = 448，这是群扩张计数，不是简单的乘法。</>}
          en={<>A <strong>space group</strong> is the full symmetry group of a 3D crystal pattern: a discrete subgroup of the Euclidean group <TeX src={String.raw`E(3)=O(3)\ltimes\mathbb{R}^3`} /> containing a rank-3 lattice of translations. Beyond point-group operations it allows <em>screw axes</em> (rotation + fractional translation along the axis) and <em>glide planes</em> (reflection + fractional in-plane translation). Combining the 32 crystallographic point groups with the 14 Bravais lattices and accounting for these fractional-translation variants yields exactly <strong>230 space groups</strong> in 3D (Fedorov, Schoenflies, Barlow, 1890s). Of these, 73 are <em>symmorphic</em> (no genuine screws or glides) and 157 are non-symmorphic. Crucially, 230 ≠ 32 × 14 = 448; the 230 comes from a careful group-extension enumeration, not a simple product.</>}
        />
      </p>

      <CrystalClassesCensus />

      {/* ── Cube connection ── */}
      <div className="gt-aside">
        <L
          zh={
            <>
              <strong>魔方联系：</strong>正方体（六面体）的<em>保向</em>对称旋转群是八面体旋转群 <TeX src={String.raw`O \cong S_4`} />，阶为 24——恰好是将魔方作为整体在空间中重新定向的 24 种方式（即公式中的全局旋转 <span className="gt-mono">x</span>、<span className="gt-mono">y</span>、<span className="gt-mono">z</span> 生成的群）。4 条体对角线在旋转下排列，给出显式同构 <TeX src={String.raw`O \cong S_4`} />。加上反射得完整点群 <TeX src={String.raw`O_h`} />，阶 48，晶体学对应立方晶系点群 <TeX src={String.raw`m\bar{3}m`} />（Hermann-Mauguin），是 32 个晶类中对称性最高的。<br /><em>重要区分</em>：魔方的全部打乱构成一个阶约 <TeX src={String.raw`4.3\times10^{19}`} /> 的<em>置换群</em>，它不是点群，不是 <TeX src={String.raw`O(3)`} /> 的子群。点群联系专属于 24 个整体重定向 <TeX src={String.raw`\leftrightarrow\; O \cong S_4`} />。
              </>
          }
          en={
            <>
              <strong>Rubik's Cube connection:</strong> The orientation-preserving symmetry group of the cube is the octahedral rotation group <TeX src={String.raw`O \cong S_4`} />, of order 24 — exactly the 24 ways to reorient a cube in space (the group generated by whole-cube rotations <span className="gt-mono">x</span>, <span className="gt-mono">y</span>, <span className="gt-mono">z</span> in Rubik's notation). The 4 space diagonals are permuted by these rotations, giving the explicit isomorphism <TeX src={String.raw`O\cong S_4`} />. Adding reflections yields the full point group <TeX src={String.raw`O_h`} /> (order 48), which crystallographically is the cubic system point group <TeX src={String.raw`m\bar{3}m`} /> (Hermann-Mauguin) — the highest-symmetry of the 32 crystal classes. <br /><em>Important caveat:</em> the full Rubik's Cube group of all reachable scrambles has order <TeX src={String.raw`{\approx}4.3\times10^{19}`} /> and is a <em>permutation group on stickers</em>, not a point group and not a subgroup of <TeX src={String.raw`O(3)`} />. The point-group tie is specifically the 24 whole-cube reorientations <TeX src={String.raw`\leftrightarrow\; O\cong S_4`} />.
            </>
          }
        />
      </div>

      {/* ── Summary numbers ── */}
      <div className="gt-sgc" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginTop: 32 }}>
        {[
          { val: '∞', label: tr({ zh: '分子点群族（Cn/Cnv/…）', en: 'Molecular PG families (Cn/Cnv/…)',
              zhHant: "分子點群族（Cn/Cnv/…）"
        }), dim: true },
          { val: '32', label: tr({ zh: '晶体点群（晶类）', en: 'Crystallographic point groups',
              zhHant: "晶體點群（晶類）"
        }), dim: false },
          { val: '14', label: tr({ zh: '布拉维格子（3D）', en: 'Bravais lattices (3D)',
              zhHant: "布拉維格子（3D）"
        }), dim: false },
          { val: '230', label: tr({ zh: '空间群（3D）', en: 'Space groups (3D)',
              zhHant: "空間群（3D）"
        }), dim: false },
        ].map(item => (
          <div key={item.val} className="gt-sgc-cell" style={{ textAlign: 'center' }}>
            <div className="gt-sgc-name" style={{ color: item.dim ? 'var(--ink-dim)' : 'var(--accent)', fontSize: 26 }}>{item.val}</div>
            <div className="gt-sgc-size" style={{ fontSize: 11, lineHeight: 1.4 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* ── References ── */}
      <p style={{ marginTop: 32, fontSize: 13, color: 'var(--ink-faint)', fontStyle: 'italic', lineHeight: 1.7 }}>
        <L
          zh={<>参考：F. A. Cotton《群论的化学应用》第 3 版（1990）；《国际晶体学表》A 卷（IUCr）；Wikipedia: "Crystallographic restriction theorem"; "Octahedral symmetry"。</>}
          en={<>References: F. A. Cotton, <em>Chemical Applications of Group Theory</em>, 3rd ed. (Wiley, 1990); <em>International Tables for Crystallography</em>, Vol. A (IUCr); Wikipedia: "Crystallographic restriction theorem"; "Octahedral symmetry".</>}
        />
      </p>
    </GTSec>
  );
}
