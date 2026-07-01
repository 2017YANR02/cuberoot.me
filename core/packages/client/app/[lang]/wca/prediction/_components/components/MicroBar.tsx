// [T_phys ─ L ─ WR] 三点微型条
// 一眼看出 "Current WR 离物理下界还有多远 / 拟合 L 落在哪"
import { formatVal, type EventMeta } from '../events';

interface Props {
  tPhys: number | null;     // green floor (displayed unit)
  fitL: number | null;      // orange trajectory floor
  wr: number | null;        // red current WR
  event: EventMeta;
  kind?: 'single' | 'average';
}

export function MicroBar({ tPhys, fitL, wr, event, kind = 'single' }: Props) {
  if (wr === null) return null;
  // 用 WR 作为右端, 物理下界 (或 0) 作为左端
  const left = Math.min(tPhys ?? 0, fitL ?? wr, wr) - 0.05 * wr;
  const right = wr + 0.05 * wr;
  const span = Math.max(right - left, 0.0001);
  // 钳到 [0,100]:fitL(轨道下界)偶尔劣于当前 WR(> 1.05×wr)时 pos 会 >100%,
  // 点会飞出定长条右端 → 手机端整页横向溢出。定长指示条任何值都该落在条内。
  const pos = (v: number) => `${Math.max(0, Math.min(100, (v - left) / span * 100)).toFixed(1)}%`;

  return (
    <div className="pred-microbar" title={
      `WR ${formatVal(wr, event, kind)}` +
      (fitL !== null ? ` · Fit L ${formatVal(fitL, event, kind)}` : '') +
      (tPhys !== null ? ` · T_phys ${formatVal(tPhys, event, kind)}` : '')
    }>
      <div className="pred-microbar-track" />
      {tPhys !== null && (
        <div className="pred-microbar-dot pred-microbar-phys" style={{ left: pos(tPhys) }} />
      )}
      {fitL !== null && (
        <div className="pred-microbar-dot pred-microbar-fit" style={{ left: pos(fitL) }} />
      )}
      <div className="pred-microbar-dot pred-microbar-wr" style={{ left: pos(wr) }} />
    </div>
  );
}
