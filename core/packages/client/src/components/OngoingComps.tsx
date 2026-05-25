// 落地页 — 搜索框下方展示当前正在进行的 WCA 比赛(start_date ≤ today ≤ end_date)
// 按国家分组(国旗为标识,不写国名);默认只展开 CN + US,其它一键展开。
// 数据走 utils/comp_search 的 loadComps()(LandingSearch 已 eager 预拉,共享缓存)
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ChevronDown, ChevronUp } from 'lucide-react';
import { loadComps, type Comp } from '../utils/comp_search';
import { compLinkProps } from '../utils/comp_link';
import { localizeCompName } from '../utils/comp_localize';
import { Flag } from '../utils/flag';
import { toIsoDate, formatDateRangeIso } from '../utils/date_range';
import { countryName } from '../utils/country_name';
import './ongoing_comps.css';

interface Props { lang: 'zh' | 'en' }

interface CountryGroup {
  iso2: string;
  comps: Comp[];
}

const DEFAULT_VISIBLE = new Set(['cn', 'us']);

// 都是今天的比赛,年份冗余 — 末尾 4 位数字(可能前面带空格)整段去掉
function stripTrailingYear(s: string): string {
  return s.replace(/\s?\d{4}$/, '').trim();
}

export default function OngoingComps({ lang }: Props) {
  const isZh = lang === 'zh';
  const [comps, setComps] = useState<Comp[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;

    const kick = () => {
      if (!mounted) return;
      loadComps().then(all => {
        if (!mounted) return;
        const today = toIsoDate(new Date());
        const ongoing = all.filter(
          c => c.start_date <= today && (c.end_date || c.start_date) >= today,
        );
        setComps(ongoing);
      }).catch(() => { if (mounted) setComps([]); });
    };

    type RIC = (cb: () => void, opts?: { timeout?: number }) => number;
    type CIC = (id: number) => void;
    const w = window as Window & { requestIdleCallback?: RIC; cancelIdleCallback?: CIC };
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (w.requestIdleCallback) {
      idleId = w.requestIdleCallback(kick, { timeout: 2000 });
    } else {
      timeoutId = setTimeout(kick, 200);
    }

    return () => {
      mounted = false;
      if (idleId !== null) w.cancelIdleCallback?.(idleId);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);

  const groups = useMemo<CountryGroup[]>(() => {
    if (!comps) return [];
    const byIso = new Map<string, Comp[]>();
    for (const c of comps) {
      const k = (c.country || '').toLowerCase();
      const arr = byIso.get(k) ?? [];
      arr.push(c);
      byIso.set(k, arr);
    }
    for (const arr of byIso.values()) {
      arr.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id));
    }
    const list: CountryGroup[] = [...byIso.entries()].map(([iso2, comps]) => ({ iso2, comps }));
    // CN > US > 其它(按比赛数倒序;ties 按英文国名字母序)
    const rank = (iso2: string) => iso2 === 'cn' ? 0 : iso2 === 'us' ? 1 : 2;
    list.sort((a, b) => {
      const ra = rank(a.iso2), rb = rank(b.iso2);
      if (ra !== rb) return ra - rb;
      if (a.comps.length !== b.comps.length) return b.comps.length - a.comps.length;
      return countryName(a.iso2, false).localeCompare(countryName(b.iso2, false));
    });
    return list;
  }, [comps]);

  if (!comps || comps.length === 0) return null;

  const visibleGroups = expanded ? groups : groups.filter(g => DEFAULT_VISIBLE.has(g.iso2));
  const hasCollapsible = groups.some(g => !DEFAULT_VISIBLE.has(g.iso2));

  return (
    <div className="ongoing-comps">
      <div className="ongoing-comps-header">
        <CalendarClock size={14} strokeWidth={1.75} />
        <span className="ongoing-comps-title">{isZh ? '正在进行' : 'Ongoing'}</span>
        <span className="ongoing-comps-count">{comps.length}</span>
      </div>
      <div className="ongoing-comps-groups">
        {visibleGroups.map(g => (
          <div key={g.iso2} className="ongoing-comps-group">
            <Flag iso2={g.iso2} className="ongoing-comps-flag" />
            <div className="ongoing-comps-list">
              {g.comps.map(c => (
                <Link
                  key={c.id}
                  {...compLinkProps(c.id)}
                  className="ongoing-comps-chip"
                  title={`${c.name}  ${formatDateRangeIso(c.start_date, c.end_date)}`}
                >
                  {stripTrailingYear(localizeCompName(c.id, c.name, isZh))}
                </Link>
              ))}
            </div>
          </div>
        ))}
        {hasCollapsible && (
          <button
            type="button"
            className="ongoing-comps-expand"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? <ChevronUp size={14} strokeWidth={1.75} /> : <ChevronDown size={14} strokeWidth={1.75} />}
            {expanded ? (isZh ? '收起' : 'Collapse') : (isZh ? '更多…' : 'More…')}
          </button>
        )}
      </div>
    </div>
  );
}
