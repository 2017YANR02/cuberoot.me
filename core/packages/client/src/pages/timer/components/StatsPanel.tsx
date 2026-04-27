import type { Solve, EventId } from '../types';
import { summarize, subXBreakdown, eventDefaultFormat, formatPrimary, formatBestPrimary } from '../stats';

interface Props {
  solves: Solve[];
  isZh: boolean;
  event: EventId;
}

function primaryLabel(kind: 'ao5' | 'mo3' | 'bo3' | 'single', isZh: boolean): string {
  if (kind === 'ao5')    return isZh ? '五次平均' : 'Ao5';
  if (kind === 'mo3')    return isZh ? '三次平均' : 'Mo3';
  if (kind === 'bo3')    return isZh ? '三次最佳' : 'Bo3';
  return isZh ? '单次' : 'Single';
}

export default function StatsPanel({ solves, isZh, event }: Props) {
  const s = summarize(solves);
  const subX = subXBreakdown(solves);
  const fmt = eventDefaultFormat(event);
  const primaryNow = formatPrimary(solves, fmt);
  const primaryBest = formatBestPrimary(solves, fmt);
  const pLabel = primaryLabel(fmt.kind, isZh);
  const rows: { lbl: string; val: string }[] = [
    { lbl: isZh ? '总数' : 'Count',     val: s.count.toString() },
    { lbl: isZh ? '最佳' : 'Best',      val: s.best },
    { lbl: isZh ? '最差' : 'Worst',     val: s.worst },
    { lbl: isZh ? '平均' : 'Mean',      val: s.mean },
    { lbl: 'σ',                         val: s.sd },
    { lbl: 'CV',                        val: s.cv },
    { lbl: 'Ao5',                       val: s.ao5 },
    { lbl: 'Ao12',                      val: s.ao12 },
    { lbl: 'Mo3',                       val: s.mo3 },
    { lbl: 'Bo3',                       val: s.bo3 },
    { lbl: 'Ao50',                      val: s.ao50 },
    { lbl: 'Ao100',                     val: s.ao100 },
    { lbl: 'Ao1000',                    val: s.ao1000 },
    { lbl: isZh ? 'Ao5 最佳' : 'Best Ao5',     val: s.bestAo5 },
    { lbl: isZh ? 'Ao12 最佳' : 'Best Ao12',   val: s.bestAo12 },
    { lbl: isZh ? 'Mo3 最佳' : 'Best Mo3',     val: s.bestMo3 },
    { lbl: isZh ? 'Bo3 最佳' : 'Best Bo3',     val: s.bestBo3 },
    { lbl: isZh ? 'Ao50 最佳' : 'Best Ao50',   val: s.bestAo50 },
    { lbl: isZh ? 'Ao100 最佳' : 'Best Ao100', val: s.bestAo100 },
    { lbl: isZh ? 'Ao1000 最佳' : 'Best Ao1000', val: s.bestAo1000 },
  ];
  return (
    <div className="stats-panel">
      <h3>{isZh ? '统计' : 'Stats'}</h3>
      <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
          {isZh ? '主成绩' : 'Primary'} · {pLabel}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 18, lineHeight: 1.4 }}>
          <span style={{ opacity: 0.7, fontSize: 13 }}>{isZh ? '当前' : 'Current'}</span>
          <span style={{ fontWeight: 600, opacity: primaryNow === '-' ? 0.4 : 1 }}>{primaryNow}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 18, lineHeight: 1.4 }}>
          <span style={{ opacity: 0.7, fontSize: 13 }}>{isZh ? '最佳' : 'Best'}</span>
          <span style={{ fontWeight: 600, opacity: primaryBest === '-' ? 0.4 : 1 }}>{primaryBest}</span>
        </div>
      </div>
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
