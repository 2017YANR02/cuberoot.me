// 拿方朝向下拉(24 档,csTimer 顺序)—— 全站唯一控件。
// 选项表在 lib/cube-orientation.ts;这里只负责渲染 + 兜住表外的值(不认识的前缀
// 补一项占位,免得 select 显示成空白)。
//
// 消费方:/timer 设置面板、/sim 播放条、/predict 与 /alg 公式图。
import { CUBE_ORIENTATIONS } from '@/lib/cube-orientation';

const FACE_COLOR_BLOCK: Readonly<Record<string, string>> = {
  U: '⬜',
  R: '🟥',
  F: '🟩',
  D: '🟨',
  L: '🟧',
  B: '🟦',
};

/** 颜色是快速识别提示；保留 `(UF)`，避免色觉差异造成歧义。 */
function labelWithFaceColors(label: string): string {
  const match = /^\(([URFDLB])([URFDLB])\)/.exec(label);
  if (!match) return label;
  return `${FACE_COLOR_BLOCK[match[1]]}${FACE_COLOR_BLOCK[match[2]]} ${label}`;
}

export default function CubeOrientationSelect({
  value, onChange, className, title, ariaLabel,
}: {
  /** 整体转前缀,'' = 不转(UF)。 */
  value: string;
  onChange: (v: string) => void;
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={title}
      aria-label={ariaLabel}
    >
      {CUBE_ORIENTATIONS.map((o) => (
        <option key={o.label} value={o.value}>{labelWithFaceColors(o.label)}</option>
      ))}
      {!CUBE_ORIENTATIONS.some((o) => o.value === value) && <option value={value}>{value}</option>}
    </select>
  );
}
