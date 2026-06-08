// Headline horizontal bar: 16 events sorted by T_phys / WR%
// "谁离物理下界最近"
import { EVENTS } from '../events';
import { THEORETICAL_LIMITS } from '../theoretical_limits';
import { tr } from '@/i18n/tr';

interface EventSummary {
  ev: typeof EVENTS[number];
  lastWRval: number | null;
}

interface Props {
  eventSummaries: EventSummary[];
  isZh: boolean;
}

export function HeadlineBar({ eventSummaries, isZh }: Props) {
  const rows = eventSummaries
    .map((s) => {
      const lim = THEORETICAL_LIMITS[s.ev.id];
      if (!lim || !s.lastWRval) return null;
      const tPhys = lim.t_phys_single ?? (lim.decomp.length > 0
        ? (lim.decomp[lim.decomp.length - 1].T ?? (lim.decomp[lim.decomp.length - 1].M / lim.decomp[lim.decomp.length - 1].TPS + lim.decomp[lim.decomp.length - 1].R))
        : null);
      if (tPhys === null) return null;
      const pct = Math.min(100, Math.round((tPhys / s.lastWRval) * 100));
      return { ev: s.ev, pct, wr: s.lastWRval, tPhys };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.pct - a.pct);

  return (
    <div className="pred-headline-bar">
      <div className="pred-headline-bar-title">
        {tr({ zh: '当前 WR 距物理下界的占比 — 100% = 已撞墙', en: 'Current WR vs physical floor — 100% = at the wall',
            zhHant: "當前 WR 距物理下界的佔比 — 100% = 已撞牆"
        })}
      </div>
      <div className="pred-headline-bar-rows">
        {rows.map((r) => (
          <a key={r.ev.id} href={`#event-${r.ev.id}`} className="pred-headline-row">
            <span className="pred-headline-name">{isZh ? r.ev.name_zh : r.ev.name_en}</span>
            <span className="pred-headline-track">
              <span
                className={`pred-headline-fill ${r.pct >= 95 ? 'is-hot' : r.pct >= 80 ? 'is-warm' : r.pct >= 60 ? 'is-mid' : 'is-cool'}`}
                style={{ width: `${r.pct}%` }}
              />
              <span className="pred-headline-pct">{r.pct}%</span>
            </span>
          </a>
        ))}
      </div>
      <div className="pred-headline-bar-foot">
        {tr({ zh: '红 (≥ 95%) = 物理下界已贴脸  橙 (80-95%) = 紧逼  黄 (60-80%) = 仍有 1.5× 提升空间  灰 = 远未到墙', en: 'Red (≥95%) = at wall · Orange (80–95%) = closing in · Yellow (60–80%) = 1.5× headroom remaining · Grey = far from wall',
            zhHant: "紅 (≥ 95%) = 物理下界已貼臉  橙 (80-95%) = 緊逼  黃 (60-80%) = 仍有 1.5× 提升空間  灰 = 遠未到牆"
        })}
      </div>
    </div>
  );
}
