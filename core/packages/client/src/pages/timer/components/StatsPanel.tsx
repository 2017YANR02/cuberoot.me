import type { Solve } from '../types';
import { summarize } from '../stats';

interface Props {
  solves: Solve[];
  isZh: boolean;
}

export default function StatsPanel({ solves, isZh }: Props) {
  const s = summarize(solves);
  const rows: { lbl: string; val: string }[] = [
    { lbl: isZh ? '总数' : 'Count',     val: s.count.toString() },
    { lbl: isZh ? '最佳' : 'Best',      val: s.best },
    { lbl: isZh ? '最差' : 'Worst',     val: s.worst },
    { lbl: isZh ? '平均' : 'Mean',      val: s.mean },
    { lbl: 'Ao5',                       val: s.ao5 },
    { lbl: 'Ao12',                      val: s.ao12 },
    { lbl: 'Ao100',                     val: s.ao100 },
    { lbl: isZh ? 'Ao5 最佳' : 'Best Ao5',   val: s.bestAo5 },
    { lbl: isZh ? 'Ao12 最佳' : 'Best Ao12', val: s.bestAo12 },
    { lbl: isZh ? 'Ao100 最佳' : 'Best Ao100', val: s.bestAo100 },
  ];
  return (
    <div className="stats-panel">
      <h3>{isZh ? '统计' : 'Stats'}</h3>
      <div className="stats-grid">
        {rows.map(r => (
          <div className="row" key={r.lbl}>
            <span className="lbl">{r.lbl}</span>
            <span className={`val ${r.val === '-' ? 'muted' : ''}`}>{r.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
