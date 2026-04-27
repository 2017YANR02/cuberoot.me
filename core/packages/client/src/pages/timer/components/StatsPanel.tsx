import type { Solve } from '../types';
import { summarize, subXBreakdown } from '../stats';

interface Props {
  solves: Solve[];
  isZh: boolean;
}

export default function StatsPanel({ solves, isZh }: Props) {
  const s = summarize(solves);
  const subX = subXBreakdown(solves);
  const rows: { lbl: string; val: string }[] = [
    { lbl: isZh ? '总数' : 'Count',     val: s.count.toString() },
    { lbl: isZh ? '最佳' : 'Best',      val: s.best },
    { lbl: isZh ? '最差' : 'Worst',     val: s.worst },
    { lbl: isZh ? '平均' : 'Mean',      val: s.mean },
    { lbl: 'σ',                         val: s.sd },
    { lbl: 'CV',                        val: s.cv },
    { lbl: 'Ao5',                       val: s.ao5 },
    { lbl: 'Ao12',                      val: s.ao12 },
    { lbl: 'Ao50',                      val: s.ao50 },
    { lbl: 'Ao100',                     val: s.ao100 },
    { lbl: 'Ao1000',                    val: s.ao1000 },
    { lbl: isZh ? 'Ao5 最佳' : 'Best Ao5',     val: s.bestAo5 },
    { lbl: isZh ? 'Ao12 最佳' : 'Best Ao12',   val: s.bestAo12 },
    { lbl: isZh ? 'Ao50 最佳' : 'Best Ao50',   val: s.bestAo50 },
    { lbl: isZh ? 'Ao100 最佳' : 'Best Ao100', val: s.bestAo100 },
    { lbl: isZh ? 'Ao1000 最佳' : 'Best Ao1000', val: s.bestAo1000 },
  ];
  return (
    <div className="stats-panel">
      <h3>{isZh ? '统计' : 'Stats'}</h3>
      <div className="stats-grid">
        {rows.map(r => (
          <div className="row" key={r.lbl}>
            <span className="lbl">{r.lbl}</span>
            <span className={`val ${r.val === '-' || r.val === '—' ? 'muted' : ''}`}>{r.val}</span>
          </div>
        ))}
      </div>
      {subX.length > 0 && (
        <>
          <h3 style={{ marginTop: 12 }}>{isZh ? '阈值占比' : 'Sub-X'}</h3>
          <div className="subx-list">
            {subX.map(x => (
              <div className="subx-row" key={x.threshold}>
                <span className="subx-lbl">{x.label}</span>
                <div className="subx-bar">
                  <div className="subx-fill" style={{ width: `${x.pct}%` }} />
                </div>
                <span className="subx-pct">{x.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
