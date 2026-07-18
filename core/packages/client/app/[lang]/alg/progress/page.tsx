'use client';

/**
 * /alg/progress — 跨 set 学习进度总览。
 *
 * 汇总用户在所有公式集里打过的标记(4 态 + 星标),分母来自 /v1/alg/sets 的 count。
 * 登录用户走云端聚合(GET /v1/alg/marks,先冲防抖队列),未登录扫本地 localStorage。
 * 每套 set 一行,进度条 + 已掌握 m/total,星标 / 学习中 / 搁置作为「直接跳去练」的入口
 * (链到该 set 的 select 页并带 ?mark= 过滤)。
 */
import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { ArrowLeft, Star } from 'lucide-react';
import { ALG_CATALOG, ALG_PUZZLES, type AlgPuzzle } from '@cuberoot/shared';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';
import { getSessionToken } from '@/lib/auth-store';
import { API_ORIGIN } from '@/lib/api-base';
import { loadMarkOverview, type MarkOverview, type SetMarkSummary } from '@/lib/trainer-marks';
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
  name: string;
  total: number | null; // null = 分母未知(缓存过期/离线)
  sum: SetMarkSummary;
}

/** 把 overview + counts 拼成按 puzzle 分组的行,保持 ALG_CATALOG 里的 set 顺序。 */
function buildRows(overview: MarkOverview, counts: Record<string, number>): Map<AlgPuzzle, SetRow[]> {
  const byPuzzle = new Map<AlgPuzzle, SetRow[]>();
  for (const p of ALG_PUZZLES) {
    const rows: SetRow[] = [];
    for (const meta of ALG_CATALOG[p]) {
      const key = `${p}/${meta.slug}`;
      const sum = overview[key];
      if (!sum) continue;
      rows.push({
        puzzle: p,
        slug: meta.slug,
        name: tr({ zh: meta.zh, en: meta.en }),
        total: counts[key] ?? null,
        sum,
      });
    }
    // catalog 里没有、但本地/云端有标记的孤儿 set(极少见:set 被下线)也带上
    for (const key in overview) {
      const [kp, ...rest] = key.split('/');
      if (kp !== p) continue;
      const slug = rest.join('/');
      if (ALG_CATALOG[p].some((m) => m.slug === slug)) continue;
      rows.push({ puzzle: p, slug, name: slug, total: counts[key] ?? null, sum: overview[key] });
    }
    if (rows.length) byPuzzle.set(p, rows);
  }
  return byPuzzle;
}

const STAT_FILTER: Array<{ k: keyof SetMarkSummary; mark: string; zh: string; en: string }> = [
  { k: 'learning', mark: 'learning', zh: '学习中', en: 'Learning' },
  { k: 'paused', mark: 'paused', zh: '搁置', en: 'Paused' },
];

function ProgressBar({ sum, total }: { sum: SetMarkSummary; total: number | null }) {
  const denom = total && total > 0 ? total : (sum.learning + sum.mastered + sum.paused) || 1;
  const pct = (n: number) => `${(n / denom) * 100}%`;
  return (
    <div className="alg-prog-bar" role="img"
      aria-label={tr({ zh: `已掌握 ${sum.mastered}`, en: `${sum.mastered} mastered` })}>
      <span className="is-mastered" style={{ width: pct(sum.mastered) }} />
      <span className="is-learning" style={{ width: pct(sum.learning) }} />
      <span className="is-paused" style={{ width: pct(sum.paused) }} />
    </div>
  );
}

function SetProgressRow({ row }: { row: SetRow }) {
  const base = `/alg/${row.puzzle}/${row.slug}/select`;
  return (
    <div className="alg-prog-row">
      <div className="alg-prog-row-head">
        <Link href={base} className="alg-prog-set-name" prefetch={false}>{row.name}</Link>
        {row.sum.mastered > 0 ? (
          <Link href={`${base}?mark=mastered`} className="alg-prog-frac is-link" prefetch={false}>
            <b>{row.sum.mastered}</b>
            {row.total != null ? ` / ${row.total}` : ''}
            <span className="alg-prog-frac-label">{tr({ zh: '已掌握', en: 'mastered' })}</span>
          </Link>
        ) : (
          <span className="alg-prog-frac">
            <b>{row.sum.mastered}</b>
            {row.total != null ? ` / ${row.total}` : ''}
            <span className="alg-prog-frac-label">{tr({ zh: '已掌握', en: 'mastered' })}</span>
          </span>
        )}
      </div>
      <ProgressBar sum={row.sum} total={row.total} />
      <div className="alg-prog-stats">
        {row.sum.starred > 0 && (
          <Link href={`${base}?mark=star`} className="alg-prog-stat is-star" prefetch={false}>
            <Star size={12} className="alg-prog-stat-star" /> {row.sum.starred}
          </Link>
        )}
        {STAT_FILTER.map((f) => row.sum[f.k] > 0 && (
          <Link key={f.k} href={`${base}?mark=${f.mark}`} className={`alg-prog-stat is-${f.k}`} prefetch={false}>
            {tr({ zh: f.zh, en: f.en })} {row.sum[f.k]}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function AlgProgressPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('学习进度', 'Progress');
  const [overview, setOverview] = useState<MarkOverview | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const loggedIn = typeof window !== 'undefined' && !!getSessionToken();

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadMarkOverview(), fetchSetCounts().catch(() => ({}))]).then(([ov, ct]) => {
      if (cancelled) return;
      setCounts(ct);
      setOverview(ov);
    });
    return () => { cancelled = true; };
  }, []);

  const byPuzzle = useMemo<Map<AlgPuzzle, SetRow[]>>(
    () => (overview ? buildRows(overview, counts) : new Map()),
    [overview, counts],
  );
  const totals = useMemo(() => {
    const t = { sets: 0, marked: 0, mastered: 0, starred: 0 };
    if (!overview) return t;
    for (const key in overview) {
      const s = overview[key];
      const n = s.learning + s.mastered + s.paused;
      if (n === 0 && s.starred === 0) continue;
      t.sets++;
      t.marked += n;
      t.mastered += s.mastered;
      t.starred += s.starred;
    }
    return t;
  }, [overview]);

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
      {overview == null ? (
        <div className="alg-empty">{tr({ zh: '加载中…', en: 'Loading…' })}</div>
      ) : totals.sets === 0 ? (
        <div className="alg-prog-empty">
          <p>{tr({ zh: '还没有标记任何 case。', en: 'No cases marked yet.' })}</p>
          <p className="alg-prog-empty-hint">
            {tr({
              zh: '进任意公式集,给 case 标上「学习中 / 已掌握 / 搁置」或加星标,进度会汇总到这里。',
              en: 'Open any set and mark cases as Learning / Mastered / Paused or star them — your progress shows up here.',
            })}
          </p>
          <Link href="/alg" className="alg-prog-cta" prefetch={false}>
            {tr({ zh: '去公式库', en: 'Browse algorithms' })}
          </Link>
        </div>
      ) : (
        <>
          <div className="alg-prog-summary">
            <div className="alg-prog-summary-stat">
              <b>{totals.mastered}</b>
              <span>{tr({ zh: '已掌握', en: 'Mastered' })}</span>
            </div>
            <div className="alg-prog-summary-stat">
              <b>{totals.marked}</b>
              <span>{tr({ zh: '已标记', en: 'Marked' })}</span>
            </div>
            <div className="alg-prog-summary-stat">
              <b>{totals.starred}</b>
              <span>{tr({ zh: '星标', en: 'Starred' })}</span>
            </div>
            <div className="alg-prog-summary-stat">
              <b>{totals.sets}</b>
              <span>{tr({ zh: '套', en: 'Sets' })}</span>
            </div>
          </div>

          {!loggedIn && (
            <p className="alg-prog-note">
              {tr({
                zh: '当前记录只存在本机。登录后可跨设备同步。',
                en: 'Marks are stored on this device only. Log in to sync across devices.',
              })}
            </p>
          )}

          {ALG_PUZZLES.filter((p) => byPuzzle.has(p)).map((p) => (
            <div key={p} className="alg-prog-group">
              <h2 className="alg-prog-group-title">
                <EventIcon event={p} className="alg-prog-group-icon" />
                <span>{eventDisplayName(p, isZh)}</span>
              </h2>
              <div className="alg-prog-sets">
                {byPuzzle.get(p)!.map((row) => <SetProgressRow key={row.slug} row={row} />)}
              </div>
            </div>
          ))}
        </>
      )}
      </div>
    </div>
  );
}
