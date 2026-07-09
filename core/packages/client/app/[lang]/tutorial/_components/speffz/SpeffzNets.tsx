/**
 * Speffz 展开图 SVG:
 * - SpeffzMasterNet:主图(偶数阶四象限 / 奇数阶风车形象限)
 * - SpeffzNet:某阶某类块的逐贴纸展开图
 * 布局复刻原 docx:U 上、L F R 中排、D 下、B 独立右上角(y2 视角)。
 * 六面配色与字母黑色为原 docx 固定绘图色(U黄 L蓝 F红 R绿 B橙 D白),不随主题。
 */
import {
  classifySticker,
  diagramShowsSticker,
  stickerLetter,
  FACE_LETTER_BASE,
  type DiagramType,
  type SpeffzFace,
} from '../../_lib/speffz';

export const SPEFFZ_FILL: Record<SpeffzFace, string> = {
  U: '#FFFF00',
  L: '#0070C0',
  F: '#FF0000',
  R: '#00B050',
  B: '#FFC000',
  D: '#FFFFFF',
};

const INK = '#000';
const CELL = 20;
const GAP = 18;
const PAD_TOP = 14;

function facePositions(S: number): Record<SpeffzFace, [number, number]> {
  const step = S + GAP;
  return {
    U: [step, PAD_TOP],
    B: [3 * step, PAD_TOP],
    L: [0, PAD_TOP + step],
    F: [step, PAD_TOP + step],
    R: [2 * step, PAD_TOP + step],
    D: [step, PAD_TOP + 2 * step],
  };
}

function FaceLabel({ face, x, y }: { face: SpeffzFace; x: number; y: number }) {
  return (
    <text x={x + 1} y={y - 4} fontSize={10} fill="var(--tutorial-text-faint)">
      {face === 'B' ? 'B (y2)' : face}
    </text>
  );
}

/** 某阶某类块的逐贴纸展开图。 */
export function SpeffzNet({ n, diagram, label }: { n: number; diagram: DiagramType; label: string }) {
  const S = n * CELL;
  const pos = facePositions(S);
  const W = 4 * S + 3 * GAP;
  const H = PAD_TOP + 3 * S + 2 * GAP;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {(Object.keys(pos) as SpeffzFace[]).map(face => {
        const [fx, fy] = pos[face];
        const cells = [];
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            const x = fx + c * CELL;
            const y = fy + r * CELL;
            const letter = diagramShowsSticker(diagram, classifySticker(n, r, c))
              ? stickerLetter(face, n, r, c)
              : null;
            cells.push(
              <g key={`${r}-${c}`}>
                <rect
                  x={x} y={y} width={CELL} height={CELL}
                  fill={SPEFFZ_FILL[face]} stroke={INK} strokeOpacity={0.45} strokeWidth={0.75}
                />
                {letter && (
                  <text
                    x={x + CELL / 2} y={y + CELL / 2 + 0.5}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={11.5} fontWeight={700} fill={INK}
                  >
                    {letter}
                  </text>
                )}
              </g>,
            );
          }
        }
        return (
          <g key={face}>
            <FaceLabel face={face} x={fx} y={fy} />
            {cells}
          </g>
        );
      })}
    </svg>
  );
}

interface Region { q: 0 | 1 | 2 | 3 | null; x: number; y: number; w: number; h: number }

/** 主图单面的象限区块(单位:面边长 S)。 */
function masterRegions(S: number, odd: boolean): Region[] {
  if (!odd) {
    const h = S / 2;
    return [
      { q: 0, x: 0, y: 0, w: h, h },
      { q: 1, x: h, y: 0, w: h, h },
      { q: 2, x: h, y: h, w: h, h },
      { q: 3, x: 0, y: h, w: h, h },
    ];
  }
  const u = S / 5;
  return [
    { q: 0, x: 0, y: 0, w: 3 * u, h: 2 * u },
    { q: 1, x: 3 * u, y: 0, w: 2 * u, h: 3 * u },
    { q: 2, x: 2 * u, y: 3 * u, w: 3 * u, h: 2 * u },
    { q: 3, x: 0, y: 2 * u, w: 2 * u, h: 3 * u },
    { q: null, x: 2 * u, y: 2 * u, w: u, h: u }, // 固定中心,无字母
  ];
}

/** 主图:每面 4 个象限各标一个字母(奇数阶风车形 + 中心留白)。 */
export function SpeffzMasterNet({ odd, label }: { odd: boolean; label: string }) {
  const S = 50;
  const pos = facePositions(S);
  const W = 4 * S + 3 * GAP;
  const H = PAD_TOP + 3 * S + 2 * GAP;
  const regions = masterRegions(S, odd);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {(Object.keys(pos) as SpeffzFace[]).map(face => {
        const [fx, fy] = pos[face];
        return (
          <g key={face}>
            <FaceLabel face={face} x={fx} y={fy} />
            {regions.map((reg, i) => (
              <g key={i}>
                <rect
                  x={fx + reg.x} y={fy + reg.y} width={reg.w} height={reg.h}
                  fill={SPEFFZ_FILL[face]} stroke={INK} strokeOpacity={0.45} strokeWidth={0.9}
                />
                {reg.q !== null && (
                  <text
                    x={fx + reg.x + reg.w / 2} y={fy + reg.y + reg.h / 2 + 0.5}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={13} fontWeight={700} fill={INK}
                  >
                    {String.fromCharCode(65 + FACE_LETTER_BASE[face] + reg.q)}
                  </text>
                )}
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
