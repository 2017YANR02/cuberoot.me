// 拿方朝向下拉(24 档,csTimer 顺序)—— 全站唯一控件。
// 选项表在 lib/cube-orientation.ts;这里只负责渲染 + 兜住表外的值(不认识的前缀
// 补一项占位,免得 select 显示成空白)。
//
// 消费方:/timer 设置面板、/sim 播放条、/predict 与 /alg 公式图。
import { CUBE_ORIENTATIONS } from '@/lib/cube-orientation';

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
      {CUBE_ORIENTATIONS.map((o) => <option key={o.label} value={o.value}>{o.label}</option>)}
      {!CUBE_ORIENTATIONS.some((o) => o.value === value) && <option value={value}>{value}</option>}
    </select>
  );
}
