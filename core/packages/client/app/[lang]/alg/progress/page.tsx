'use client';

/**
 * /alg/progress — 公式学习进度总览。
 *
 * 两套数据合在一起讲同一件事:
 *   ① 手动标记(alg_case_marks):不熟 / 已掌握 / 星标 —— 用户自己的判断。
 *   ② 记忆调度(alg_case_srs):到期时刻 / 间隔 / 遗忘次数 —— 系统算出来的记忆强度。
 * 标记回答「我认不认」,调度回答「还记不记得住」。分开采集,合起来展示。
 *
 * 登录用户走云端(先冲防抖队列再拉),未登录扫本地 localStorage;云端不可用一律静默回落本地。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from '@/components/AppLink';
import { ArrowLeft, Star, Flame, Loader2 } from 'lucide-react';
import { ALG_CATALOG, ALG_PUZZLES, loadAlg, type AlgPuzzle, type AlgCase } from '@cuberoot/shared';
import { virtualAlgSet } from '@/lib/alg-virtual-sets';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { CaseThumb } from '@/components/CaseThumb';
import { eventDisplayName } from '@/lib/wca-events';
import { useTranslation } from 'react-i18next';
import { getSessionToken } from '@/lib/auth-store';
import { API_ORIGIN } from '@/lib/api-base';
import { loadMarkOverview, resetSetMarks, MARK_STATUS_LABEL, type MarkOverview, type SetMarkSummary } from '@/lib/trainer-marks';
import { loadSrsDashboard, resetSetSrs, resetSrsDaily, type SrsOverview } from '@/lib/alg-srs-store';
import {
  dueForecast, heatmapGrid, streakDays, dayKey, retention, weakness,
  emptySrsStat, MASTER_DAYS, type SrsDaily, type SrsRecs, type SrsSetStat,
} from '@/lib/alg-srs';
import { primaryCaseName } from '@/lib/alg_case_display';
import { caseKey } from '@/lib/trainer-case-key';
import { tr } from '@/i18n/tr';
import '../alg.css';
import './progress.css';

/** 每套 set 的总 case 数(进度条分母)。 */
async function fetchSetCounts(): Promise<Record<string, number>> {
  const res = await fetch(`${API_ORIGIN}/v1/alg/sets`);
  if (!res.ok) return {};
  const rows = (await res.json()) as Array<{ puzzle: string; setSlug: string; count?: number }>;
  const out: Record<string, number> = {};
  for (const r of rows) if (typeof r.count === 'number') out[`${r.puzzle}/${r.setSlug}`] = r.count;
  return out;
}

interface SetRow {
  puzzle: AlgPuzzle;
  slug: string;
  key: string;             // `${puzzle}/${slug}`
  name: string;
  total: number | null;    // null = 分母未知(缓存过期/离线)
  marks: SetMarkSummary;
  srs: SrsSetStat;
}

const emptyMarks = (): SetMarkSummary => ({ learning: 0, mastered: 0, starred: 0 });

/** 两张表的 key 并集 → 按 puzzle 分组的行,保持 ALG_CATALOG 里的 set 顺序。 */
function buildRows(
  marks: MarkOverview, srs: SrsOverview, counts: Record<string, number>,
): Map<AlgPuzzle, SetRow[]> {
  const byPuzzle = new Map<AlgPuzzle, SetRow[]>();
  const allKeys = new Set([...Object.keys(marks), ...Object.keys(srs)]);
  for (const p of ALG_PUZZLES) {
    const rows: SetRow[] = [];
    const seen = new Set<string>();
    const push = (slug: string, name: string) => {
      const key = `${p}/${slug}`;
      if (seen.has(key) || !allKeys.has(key)) return;
      seen.add(key);
      rows.push({
        puzzle: p, slug, key, name,
        total: counts[key] ?? null,
        marks: marks[key] ?? emptyMarks(),
        srs: srs[key] ?? emptySrsStat(),
      });
    };
    for (const meta of ALG_CATALOG[p]) push(meta.slug, tr({ zh: meta.zh, en: meta.en }));
    // catalog 里没有、但有记录的孤儿 set:虚拟集(LSLL)用它自己的名字,真孤儿(set 下线)用 slug
    for (const key of allKeys) {
      const [kp, ...rest] = key.split('/');
      if (kp !== p) continue;
      const slug = rest.join('/');
      const virtual = virtualAlgSet(p, slug);
      push(slug, virtual ? tr(virtual.meta) : slug);
    }
    if (rows.length) byPuzzle.set(p, rows);
  }
  return byPuzzle;
}

// ── 小组件 ─────────────────────────────────────────────────────

function StatTile({ n, label, sub, tone }: { n: ReactNode; label: string; sub?: string; tone?: string }) {
  return (
    <div className={`alg-prog-tile${tone ? ` is-${tone}` : ''}`}>
      <b>{n}</b>
      <span>{label}</span>
      {sub && <i>{sub}</i>}
    </div>
  );
}

/**
 * 复习热力图(一年)。单色顺序标度:同一个 hue 由浅到深五档,数值越大越深 —— 不用彩虹。
 * 每格带 title,数字本身在 tooltip 里,不在格子上(格子只有 11px)。
 */
function Heatmap({ daily }: { daily: SrsDaily }) {
  const now = Date.now();
  const weeks = 53;
  const grid = useMemo(() => heatmapGrid(daily, now, weeks), [daily, now]);
  // 窄屏放不下一年 → 横向滚动。默认停在最右(本周),而不是让人先划半天才看到今天。
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [grid]);
  const max = useMemo(() => {
    let m = 0;
    for (const col of grid) for (const cell of col) if (cell && cell.n > m) m = cell.n;
    return m;
  }, [grid]);
  const level = (n: number) => {
    if (n === 0) return 0;
    if (max <= 4) return Math.min(4, n);
    return Math.min(4, Math.ceil((n / max) * 4));
  };
  // 月份标签:每列取该列首日的月份,与上一列不同才标
  const monthLabels = grid.map((col, i) => {
    const first = col.find(Boolean);
    if (!first) return null;
    const d = new Date(first.ts);
    const prev = i > 0 ? grid[i - 1].find(Boolean) : null;
    if (prev && new Date(prev.ts).getMonth() === d.getMonth()) return null;
    return { i, label: tr({ zh: `${d.getMonth() + 1}月`, en: d.toLocaleString('en', { month: 'short' }) }) };
  }).filter(Boolean) as Array<{ i: number; label: string }>;

  return (
    <div className="alg-prog-heat-wrap">
      <div className="alg-prog-heat" ref={scrollRef} style={{ gridTemplateColumns: `repeat(${weeks}, 11px)` }}>
        {monthLabels.map(m => (
          <span key={m.i} className="alg-prog-heat-month" style={{ gridColumn: m.i + 1, gridRow: 1 }}>
            {m.label}
          </span>
        ))}
        {grid.map((col, w) => col.map((cell, d) => (
          <span
            key={`${w}-${d}`}
            className={`alg-prog-heat-cell${cell ? ` lv${level(cell.n)}` : ' is-future'}`}
            style={{ gridColumn: w + 1, gridRow: d + 2 }}
            title={cell ? `${cell.day} · ${cell.n} ${tr({ zh: '次复习', en: 'reviews' })}` : ''}
          />
        )))}
      </div>
      <div className="alg-prog-heat-legend">
        <span>{tr({ zh: '少', en: 'Less' })}</span>
        {[0, 1, 2, 3, 4].map(l => <span key={l} className={`alg-prog-heat-cell lv${l}`} />)}
        <span>{tr({ zh: '多', en: 'More' })}</span>
      </div>
    </div>
  );
}

/** 未来 14 天到期量。单系列柱状,一个轴,数值直接标在柱顶(只标非零)。 */
function DueForecast({ recs }: { recs: Record<string, SrsRecs> }) {
  const days = 14;
  const now = Date.now();
  const buckets = useMemo(() => {
    const out = new Array<number>(days).fill(0);
    for (const ps in recs) {
      const f = dueForecast(recs[ps], now, days);
      for (let i = 0; i < days; i++) out[i] += f[i];
    }
    return out;
  }, [recs, now]);
  const max = Math.max(1, ...buckets);
  if (buckets.every(b => b === 0)) return null;
  const dayLabel = (i: number) => {
    if (i === 0) return tr({ zh: '今天', en: 'Today' });
    const d = new Date(now + i * 86_400_000);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  return (
    <div className="alg-prog-forecast">
      {buckets.map((n, i) => (
        <div key={i} className="alg-prog-fc-col" title={`${dayLabel(i)} · ${n}`}>
          <span className="alg-prog-fc-num">{n > 0 ? n : ''}</span>
          <span
            className={`alg-prog-fc-bar${i === 0 ? ' is-today' : ''}`}
            style={{ height: `${Math.max(n > 0 ? 3 : 0, (n / max) * 62)}px` }}
          />
          <span className="alg-prog-fc-day">{i === 0 || i % 2 === 1 ? dayLabel(i) : ''}</span>
        </div>
      ))}
    </div>
  );
}

/** 记忆强度分布:没练过 / 重学中 / 短期(<21天) / 长期(≥21天)。每段都有文字标签,不靠颜色单独表意。 */
function MaturityBar({ neverStudied, relearn, young, mature }: {
  neverStudied: number; relearn: number; young: number; mature: number;
}) {
  const total = neverStudied + relearn + young + mature;
  if (total === 0) return null;
  const segs = [
    { n: mature, cls: 'mature', zh: `长期记住(≥${MASTER_DAYS} 天)`, en: `Long-term (≥${MASTER_DAYS}d)` },
    { n: young, cls: 'young', zh: '短期记住', en: 'Short-term' },
    { n: relearn, cls: 'relearn', zh: '重学中', en: 'Relearning' },
    { n: neverStudied, cls: 'never', zh: '没练过', en: 'Never studied' },
  ].filter(s => s.n > 0);
  return (
    <div className="alg-prog-maturity">
      <div className="alg-prog-mat-bar">
        {segs.map(s => (
          <span key={s.cls} className={`is-${s.cls}`} style={{ width: `${(s.n / total) * 100}%` }} />
        ))}
      </div>
      <div className="alg-prog-mat-legend">
        {segs.map(s => (
          <span key={s.cls} className="alg-prog-mat-key">
            <i className={`is-${s.cls}`} aria-hidden />
            {tr({ zh: s.zh, en: s.en })} <b>{s.n}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function SetProgressRow({ row, onReset, busy }: {
  row: SetRow;
  onReset: (row: SetRow) => void;
  busy: boolean;
}) {
  // 虚拟集(LSLL)没有 select 页 —— 「挑 case」回它自己的浏览页(?mark= 那层筛选它不支持)
  const base = virtualAlgSet(row.puzzle, row.slug)?.selectHref(null)
    ?? `/alg/${row.puzzle}/${row.slug}/select`;
  const { marks, srs } = row;
  const denom = row.total && row.total > 0
    ? row.total
    : (marks.learning + marks.mastered) || 1;
  const untouched = Math.max(0, denom - marks.mastered - marks.learning);
  const pct = (n: number) => `${(n / denom) * 100}%`;
  return (
    <div className="alg-prog-row">
      <div className="alg-prog-row-head">
        <Link href={base} className="alg-prog-set-name" prefetch={false}>{row.name}</Link>
        {srs.due > 0 && (
          <Link
            href={`/alg/${row.puzzle}/${row.slug}/run?mode=memo`}
            className="alg-prog-due-btn"
            prefetch={false}
          >
            {tr({ zh: '复习', en: 'Review' })} {srs.due}
          </Link>
        )}
        <span className="alg-prog-frac">
          <b>{marks.mastered}</b>
          {row.total != null ? ` / ${row.total}` : ''}
          <span className="alg-prog-frac-label">{tr({ zh: '已掌握', en: 'mastered' })}</span>
        </span>
      </div>
      <div className="alg-prog-bar" role="img"
        aria-label={tr({ zh: `已掌握 ${marks.mastered} / ${denom}`, en: `${marks.mastered} of ${denom} mastered` })}>
        <span className="is-mastered" style={{ width: pct(marks.mastered) }} />
        <span className="is-learning" style={{ width: pct(marks.learning) }} />
      </div>
      <div className="alg-prog-stats">
        {marks.starred > 0 && (
          <Link href={`${base}?mark=star`} className="alg-prog-stat is-star" prefetch={false}>
            <Star size={12} className="alg-prog-stat-star" /> {marks.starred}
          </Link>
        )}
        {marks.learning > 0 && (
          <Link href={`${base}?mark=learning`} className="alg-prog-stat is-learning" prefetch={false}>
            {MARK_STATUS_LABEL.learning()} {marks.learning}
          </Link>
        )}
        {untouched > 0 && (
          <Link href={`${base}?mark=none`} className="alg-prog-stat" prefetch={false}>
            {tr({ zh: '未学', en: 'New' })} {untouched}
          </Link>
        )}
        {srs.mature > 0 && (
          <span className="alg-prog-stat is-mature">
            {tr({ zh: '长期记住', en: 'Long-term' })} {srs.mature}
          </span>
        )}
        {srs.lapses > 0 && (
          <span className="alg-prog-stat is-lapse">
            {tr({ zh: '忘过', en: 'Lapses' })} {srs.lapses}
          </span>
        )}
        {/* 重置这一套:标记 + 记忆排期一起清,复习日历(跨 set 的活动流水)不动 */}
        <button
          type="button"
          className="alg-prog-stat is-reset"
          onClick={() => onReset(row)}
          disabled={busy}
        >
          {busy
            ? tr({ zh: '重置中…', en: 'Resetting…' })
            : tr({ zh: '重置', en: 'Reset' })}
        </button>
      </div>
    </div>
  );
}

interface WeakEntry { ps: string; puzzle: AlgPuzzle; set: string; key: string; lapses: number; ivl: number; score: number }

/**
 * 最该回头看的公式:按「忘过几次 + 难度因子 + 间隔短」排。缩略图要 case 数据,
 * 而 case 数据是每套几百 KB 的 JSON —— 所以按钮触发再拉,不在进入页面时默默下载。
 */
function WeakCards({ recs }: { recs: Record<string, SrsRecs> }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [byPs, setByPs] = useState<Record<string, AlgCase[]>>({});

  const top = useMemo<WeakEntry[]>(() => {
    const out: WeakEntry[] = [];
    for (const ps in recs) {
      const [puzzle, ...rest] = ps.split('/');
      if (!(ALG_PUZZLES as readonly string[]).includes(puzzle)) continue;
      for (const k in recs[ps]) {
        const r = recs[ps][k];
        if (r.n === 0 || r.l === 0) continue;   // 从没忘过的不算薄弱
        out.push({
          ps, puzzle: puzzle as AlgPuzzle, set: rest.join('/'), key: k,
          lapses: r.l, ivl: r.iv, score: weakness(r),
        });
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 18);
  }, [recs]);

  const reveal = useCallback(() => {
    setOpen(true);
    const sets = [...new Set(top.map(t => t.ps))];
    if (sets.length === 0) return;
    setLoading(true);
    Promise.all(sets.map(ps => {
      const [p, ...rest] = ps.split('/');
      const slug = rest.join('/');
      // 虚拟集(LSLL)库里没有这张表 —— 别去拉一个注定 404 的 JSON,下面按「查不到 case」渲染
      if (virtualAlgSet(p as AlgPuzzle, slug)) return Promise.resolve([ps, [] as AlgCase[]] as const);
      return loadAlg(p as AlgPuzzle, slug)
        .then(f => [ps, f.cases] as const)
        .catch(() => [ps, [] as AlgCase[]] as const);
    })).then(pairs => {
      setByPs(Object.fromEntries(pairs));
      setLoading(false);
    });
  }, [top]);

  if (top.length === 0) return null;

  return (
    <section className="alg-prog-section">
      <h2 className="alg-prog-h2">{tr({ zh: '最该回头看的', en: 'Worth another look' })}</h2>
      {!open ? (
        <button type="button" className="alg-prog-reveal" onClick={reveal}>
          {tr({ zh: `显示 ${top.length} 个薄弱公式`, en: `Show ${top.length} shaky algorithms` })}
        </button>
      ) : loading ? (
        <div className="alg-prog-loading"><Loader2 size={15} className="alg-prog-spin" /> {tr({ zh: '加载中…', en: 'Loading…' })}</div>
      ) : (
        <div className="alg-prog-weak-grid">
          {top.map(w => {
            const cs = byPs[w.ps] ?? [];
            const c = cs.find(x => caseKey(x) === w.key);
            const label = c ? primaryCaseName(w.puzzle, w.set, c) : w.key.split('|').pop() ?? w.key;
            return (
              <Link
                key={`${w.ps}|${w.key}`}
                href={`/alg/${w.puzzle}/${w.set}/run?mode=memo`}
                className="alg-prog-weak"
                prefetch={false}
                title={tr({
                  zh: `${w.set.toUpperCase()} ${label} · 忘过 ${w.lapses} 次`,
                  en: `${w.set.toUpperCase()} ${label} · ${w.lapses} lapses`,
                })}
              >
                {c ? (
                  <CaseThumb
                    puzzle={w.puzzle}
                    set={w.set}
                    sticker={c.sticker}
                    alg={c.algs.flat()[0]?.alg ?? c.standard ?? ''}
                    setup={c.setup}
                    size={62}
                  />
                ) : <span className="alg-prog-weak-blank" aria-hidden />}
                <span className="alg-prog-weak-name">{label}</span>
                <span className="alg-prog-weak-lapse">
                  {tr({ zh: `忘过 ${w.lapses}`, en: `${w.lapses}×` })}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── 页面 ───────────────────────────────────────────────────────

export default function AlgProgressPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [marks, setMarks] = useState<MarkOverview | null>(null);
  const [srsOv, setSrsOv] = useState<SrsOverview>({});
  const [recs, setRecs] = useState<Record<string, SrsRecs>>({});
  const [daily, setDaily] = useState<SrsDaily>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  /** 正在重置的对象:set 的 `puzzle/slug`,或 'all'。 */
  const [resetting, setResetting] = useState<string | null>(null);
  const loggedIn = typeof window !== 'undefined' && !!getSessionToken();

  const refresh = useCallback(async () => {
    const now = Date.now();
    const [mk, srs, ct] = await Promise.all([
      loadMarkOverview(),
      loadSrsDashboard(now),
      fetchSetCounts().catch(() => ({})),
    ]);
    setCounts(ct);
    setSrsOv(srs.overview);
    setRecs(srs.recs);
    setDaily(srs.daily);
    setMarks(mk);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const byPuzzle = useMemo<Map<AlgPuzzle, SetRow[]>>(
    () => (marks ? buildRows(marks, srsOv, counts) : new Map()),
    [marks, srsOv, counts],
  );

  const totals = useMemo(() => {
    const t = {
      sets: 0, marked: 0, mastered: 0, starred: 0, learning: 0,
      due: 0, tracked: 0, relearn: 0, young: 0, mature: 0, reviews: 0, lapses: 0,
      known: 0,   // 分母已知的 set 里一共多少 case
    };
    for (const rows of byPuzzle.values()) {
      for (const r of rows) {
        const n = r.marks.learning + r.marks.mastered;
        if (n === 0 && r.marks.starred === 0 && r.srs.tracked === 0) continue;
        t.sets++;
        t.marked += n;
        t.mastered += r.marks.mastered;
        t.learning += r.marks.learning;
        t.starred += r.marks.starred;
        t.due += r.srs.due;
        t.tracked += r.srs.tracked;
        t.relearn += r.srs.relearn;
        t.young += r.srs.young;
        t.mature += r.srs.mature;
        t.reviews += r.srs.reviews;
        t.lapses += r.srs.lapses;
        if (r.total) t.known += r.total;
      }
    }
    return t;
  }, [byPuzzle]);

  const streak = useMemo(() => streakDays(daily, Date.now()), [daily]);
  const today = daily[dayKey(Date.now())]?.[0] ?? 0;
  const ret = useMemo(() => {
    // 全部 set 合起来算保持率
    const all: SrsRecs = {};
    for (const ps in recs) Object.assign(all, Object.fromEntries(
      Object.entries(recs[ps]).map(([k, v]) => [`${ps}|${k}`, v]),
    ));
    return retention(all);
  }, [recs]);

  // 每套都重置完了、只剩复习日历时也不能落回空态 —— 否则日历还在,却没有入口清它
  const hasAny = totals.sets > 0 || Object.keys(daily).length > 0;

  /** 清一套:标记 + 记忆排期。云端先删,失败就整个中止(不留「本地清了云端还在」的半态)。 */
  const resetOne = async (row: SetRow) => {
    const ok = window.confirm(tr({
      zh: `重置「${row.name}」的学习进度?\n\n已掌握 / 不熟 / 星标 和这一套的记忆排期都会清空,不能撤销。复习日历不受影响。`,
      en: `Reset your progress on ${row.name}?\n\nIts marks (mastered / shaky / starred) and memory schedule will be cleared. This cannot be undone. The review calendar is not affected.`,
    }));
    if (!ok) return;
    setResetting(row.key);
    try {
      await resetSetMarks(row.puzzle, row.slug);
      await resetSetSrs(row.puzzle, row.slug);
      await refresh();
    } catch (e) {
      console.warn('[alg/progress] reset failed', e);
      window.alert(tr({
        zh: '重置失败:云端没同步成功,进度原样保留。检查网络后再试一次。',
        en: 'Reset failed — the change did not reach the server, so nothing was cleared. Check your connection and try again.',
      }));
    } finally {
      setResetting(null);
    }
  };

  /** 清全部:每一套 + 复习日历 / 连续天数。 */
  const resetAll = async () => {
    const rows = [...byPuzzle.values()].flat();
    const ok = window.confirm(tr({
      zh: `重置全部学习进度?\n\n${rows.length} 套公式集的标记与记忆排期、复习日历、连续天数会全部清空,不能撤销。`,
      en: `Reset all learning progress?\n\nMarks and memory schedules across ${rows.length} sets, plus the review calendar and day streak, will all be cleared. This cannot be undone.`,
    }));
    if (!ok) return;
    setResetting('all');
    try {
      for (const row of rows) {
        await resetSetMarks(row.puzzle, row.slug);
        await resetSetSrs(row.puzzle, row.slug);
      }
      const { cloudCleared } = await resetSrsDaily();
      await refresh();
      if (!cloudCleared) {
        window.alert(tr({
          zh: '标记和记忆排期都清干净了,但复习日历只清掉了本机那一份 —— 服务器没删成功,下次同步会合并回来。',
          en: 'Marks and memory schedules are cleared, but the review calendar was only cleared on this device — the server did not accept the delete, so it will sync back.',
        }));
      }
    } catch (e) {
      console.warn('[alg/progress] reset all failed', e);
      window.alert(tr({
        zh: '重置中断:云端没同步成功。已清掉的部分不会回来,剩下的原样保留,检查网络后可以再点一次。',
        en: 'Reset interrupted — the server did not accept the change. What was already cleared stays cleared; the rest is untouched. Check your connection and run it again.',
      }));
      await refresh();
    } finally {
      setResetting(null);
    }
  };

  return (
    <div className="alg-root">
      <div className="alg-cat-header">
        <Link href="/alg" className="alg-back">
          <ArrowLeft size={14} /> {tr({ zh: '公式库', en: 'Algorithms' })}
        </Link>
        <h1 className="alg-cat-title">
          <span>{tr({ zh: '学习进度', en: 'Learning Progress' })}</span>
        </h1>
      </div>

      <div className="alg-prog-body">
        {marks == null ? (
          <div className="alg-empty">{tr({ zh: '加载中…', en: 'Loading…' })}</div>
        ) : !hasAny ? (
          <div className="alg-prog-empty">
            <p>{tr({ zh: '还没有任何学习记录。', en: 'Nothing tracked yet.' })}</p>
            <p className="alg-prog-empty-hint">
              {tr({
                zh: '进任意公式集,用「记忆」模式看图回忆公式并自评,或手动标上「不熟 / 已掌握」—— 进度、复习排期和记忆曲线都会汇总到这里。',
                en: 'Open any set and use Memory mode — recall each alg from its picture and grade yourself — or mark cases as Shaky or Mastered. Progress, review scheduling and your memory curve all land here.',
              })}
            </p>
            <Link href="/alg" className="alg-prog-cta" prefetch={false}>
              {tr({ zh: '去公式库', en: 'Browse algorithms' })}
            </Link>
          </div>
        ) : (
          <>
            <div className="alg-prog-tiles">
              <StatTile n={totals.mastered} label={tr({ zh: '已掌握', en: 'Mastered' })} tone="ok"
                sub={totals.known > 0 ? `/ ${totals.known}` : undefined} />
              <StatTile n={totals.due} label={tr({ zh: '待复习', en: 'Due now' })} tone={totals.due > 0 ? 'due' : undefined} />
              <StatTile n={totals.learning} label={MARK_STATUS_LABEL.learning()} tone="warn" />
              <StatTile n={today} label={tr({ zh: '今日复习', en: 'Reviewed today' })} />
              <StatTile
                n={<span className="alg-prog-streak"><Flame size={17} />{streak}</span>}
                label={tr({ zh: '连续天数', en: 'Day streak' })}
                tone={streak > 0 ? 'warn' : undefined}
              />
              {ret.samples >= 10 && (
                <StatTile n={`${Math.round(ret.rate * 100)}%`} label={tr({ zh: '记忆保持率', en: 'Retention' })}
                  sub={tr({ zh: `${ret.samples} 次复习`, en: `${ret.samples} reviews` })} />
              )}
              <StatTile n={totals.starred} label={tr({ zh: '星标', en: 'Starred' })} />
              <StatTile n={totals.sets} label={tr({ zh: '套', en: 'Sets' })} />
            </div>

            {!loggedIn && (
              <p className="alg-prog-note">
                {tr({
                  zh: '当前记录只存在本机。登录后可跨设备同步。',
                  en: 'Everything is stored on this device only. Log in to sync across devices.',
                })}
              </p>
            )}

            {totals.tracked > 0 && (
              <section className="alg-prog-section">
                <h2 className="alg-prog-h2">{tr({ zh: '记忆强度', en: 'Memory strength' })}</h2>
                <MaturityBar
                  neverStudied={Math.max(0, totals.known - totals.tracked)}
                  relearn={totals.relearn}
                  young={totals.young}
                  mature={totals.mature}
                />
                <p className="alg-prog-sub">
                  {tr({
                    zh: `累计复习 ${totals.reviews} 次,其中忘掉 ${totals.lapses} 次。间隔涨过 ${MASTER_DAYS} 天就算长期记住了。`,
                    en: `${totals.reviews} reviews so far, ${totals.lapses} of them lapses. Past a ${MASTER_DAYS}-day interval a card counts as long-term.`,
                  })}
                </p>
              </section>
            )}

            <section className="alg-prog-section">
              <h2 className="alg-prog-h2">{tr({ zh: '复习日历', en: 'Review calendar' })}</h2>
              <Heatmap daily={daily} />
            </section>

            {totals.tracked > 0 && (
              <section className="alg-prog-section">
                <h2 className="alg-prog-h2">{tr({ zh: '接下来两周的复习量', en: 'Next two weeks' })}</h2>
                <DueForecast recs={recs} />
              </section>
            )}

            <WeakCards recs={recs} />

            <section className="alg-prog-section">
              <h2 className="alg-prog-h2">{tr({ zh: '各公式集', en: 'By set' })}</h2>
              {ALG_PUZZLES.filter(p => byPuzzle.has(p)).map(p => (
                <div key={p} className="alg-prog-group">
                  <h3 className="alg-prog-group-title">
                    <EventIcon event={p} className="alg-prog-group-icon" />
                    <span>{eventDisplayName(p, isZh)}</span>
                  </h3>
                  <div className="alg-prog-sets">
                    {byPuzzle.get(p)!.map(row => (
                      <SetProgressRow
                        key={row.slug}
                        row={row}
                        onReset={resetOne}
                        busy={resetting === row.key || resetting === 'all'}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {/* 重置全部:放在最底下,离日常操作最远的地方 */}
            <section className="alg-prog-section">
              <button
                type="button"
                className="alg-prog-reset-all"
                onClick={resetAll}
                disabled={resetting !== null}
              >
                {resetting === 'all'
                  ? tr({ zh: '重置中…', en: 'Resetting…' })
                  : tr({ zh: '重置全部学习进度', en: 'Reset all progress' })}
              </button>
              <p className="alg-prog-sub">
                {tr({
                  zh: loggedIn
                    ? '清空全部标记、记忆排期与复习日历,所有设备一起生效,不能撤销。'
                    : '清空本机的全部标记、记忆排期与复习日历,不能撤销。',
                  en: loggedIn
                    ? 'Clears every mark, memory schedule and the review calendar, on all your devices. Cannot be undone.'
                    : 'Clears every mark, memory schedule and the review calendar stored on this device. Cannot be undone.',
                })}
              </p>
            </section>

            <p className="alg-prog-foot">
              {tr({
                zh: '排期用 SM-2 间隔重复:记得越牢,下次见面隔得越久;一旦忘了,当场重来并把间隔清零。',
                en: 'Scheduling is SM-2 spaced repetition — the stronger the recall, the longer until you see it again; a lapse resets the interval and repeats the card immediately.',
              })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
