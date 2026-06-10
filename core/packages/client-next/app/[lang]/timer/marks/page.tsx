'use client';

/**
 * /timer/marks — 打乱足迹:全站最近的 WCA 真实打乱「打卡」feed(公开)。
 * 登录用户在 /timer 用 WCA 真实打乱练习时可标记做过的打乱(可带成绩);
 * 这里按时间倒序展示所有人的标记,?wcaId= 过滤单人(「只看我的」)。
 * keyset 分页(before=上页最后一条 id),数据走 /v1/scramble-marks/recent。
 */
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryState, parseAsString } from 'nuqs';
import { CheckCircle2 } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { Flag } from '@/components/Flag';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore } from '@/lib/auth-store';
import { displayCuberName } from '@/lib/name-utils';
import { localizeCompName } from '@/lib/comp-localize';
import { compFlagIso2, loadFlagData, flagDataVersion } from '@/lib/country-flags';
import { compSourceLine } from '@/lib/comp-schedule';
import { tr } from '@/i18n/tr';
import { fetchRecentMarks, type RecentMark } from '../_lib/marks';
import { formatMs } from '../_lib/stats';
import './marks.css';

const PAGE_SIZE = 30;

function fmtDate(epochSec: number): string {
  return new Date(epochSec * 1000).toISOString().slice(0, 10);
}

function MarksFeed() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('打乱足迹', 'Scramble Marks', '打亂足跡');
  const user = useAuthStore((st) => st.user);
  // SSR/首帧统一为未登录,挂载后再放开,避免 hydration mismatch。
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [wcaIdFilter, setWcaIdFilter] = useQueryState('wcaId', parseAsString.withDefault(''));

  const [marks, setMarks] = useState<RecentMark[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [done, setDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // 比赛名/国旗索引懒加载完成后重渲一次。
  const [, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => { void loadFlagData().then(setFlagVer); }, []);

  useEffect(() => {
    let cancel = false;
    setMarks(null);
    setLoadErr(false);
    setDone(false);
    fetchRecentMarks({ wcaId: wcaIdFilter || undefined, limit: PAGE_SIZE })
      .then((rows) => {
        if (cancel) return;
        setMarks(rows);
        setDone(rows.length < PAGE_SIZE);
      })
      .catch(() => { if (!cancel) setLoadErr(true); });
    return () => { cancel = true; };
  }, [wcaIdFilter]);

  const loadMore = useCallback(() => {
    const last = marks?.[marks.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    fetchRecentMarks({ wcaId: wcaIdFilter || undefined, limit: PAGE_SIZE, before: last.id })
      .then((rows) => {
        setMarks((cur) => [...(cur ?? []), ...rows]);
        setDone(rows.length < PAGE_SIZE);
      })
      .catch(() => { /* 下一次点重试 */ })
      .finally(() => setLoadingMore(false));
  }, [marks, loadingMore, wcaIdFilter]);

  const mineOnly = mounted && !!user && wcaIdFilter === user.wcaId;

  return (
    <div className="scrmarks-page">
      <h1 className="scrmarks-title">{tr({ zh: '打乱足迹', en: 'Scramble Marks',
          zhHant: "打亂足跡"
    })}</h1>
      <p className="scrmarks-sub">
        {tr({
          zh: '在计时器里用 WCA 真实比赛打乱练习时,登录后可以给做过的打乱打卡。这里是全站最近的足迹。',
          en: 'When practicing with real WCA competition scrambles in the timer, signed-in users can mark the scrambles they have done. This is the site-wide trail.',
            zhHant: "在計時器裡用 WCA 真實比賽打亂練習時,登入後可以給做過的打亂打卡。這裡是全站最近的足跡。"
        })}
        {' '}
        <AppLink href="/timer">{tr({ zh: '去计时器', en: 'Open the timer',
            zhHant: "去計時器"
        })}</AppLink>
      </p>

      {mounted && user && (
        <div className="scrmarks-filter">
          <button
            type="button"
            className={`scrmarks-mine${mineOnly ? ' on' : ''}`}
            onClick={() => void setWcaIdFilter(mineOnly ? null : user.wcaId)}
          >
            {tr({ zh: '只看我的', en: 'Mine only' })}
          </button>
        </div>
      )}
      {wcaIdFilter && !mineOnly && (
        <div className="scrmarks-filter">
          <span className="scrmarks-filter-tag">
            {wcaIdFilter}
            <button type="button" onClick={() => void setWcaIdFilter(null)} aria-label="clear">×</button>
          </span>
        </div>
      )}

      {loadErr && <p className="scrmarks-empty">{tr({ zh: '加载失败,稍后再试。', en: 'Failed to load — try again later.',
          zhHant: "載入失敗,稍後再試。"
    })}</p>}
      {!loadErr && marks === null && <p className="scrmarks-empty">{tr({ zh: '加载中…', en: 'Loading…',
          zhHant: "載入中…"
    })}</p>}
      {!loadErr && marks !== null && marks.length === 0 && (
        <p className="scrmarks-empty">{tr({ zh: '还没有任何标记。', en: 'No marks yet.',
            zhHant: "還沒有任何標記。"
        })}</p>
      )}

      {marks !== null && marks.length > 0 && (
        <ul className="scrmarks-list">
          {marks.map((m) => {
            const iso2 = compFlagIso2(m.ci);
            return (
              <li key={m.id} className="scrmarks-row">
                <div className="scrmarks-row-top">
                  <CheckCircle2 size={14} className="scrmarks-check" />
                  {m.country && <Flag iso2={m.country} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                  <AppLink href={`/wca/persons/${encodeURIComponent(m.wcaId)}`} className="scrmarks-name">
                    {displayCuberName(m.name, isZh) || m.wcaId}
                  </AppLink>
                  {m.timeCs != null && <span className="scrmarks-time">{formatMs(m.timeCs * 10)}</span>}
                  <span className="scrmarks-date">{fmtDate(m.createdAt)}</span>
                </div>
                <div className="scrmarks-row-src">
                  <EventIcon event={m.e} className="scrmarks-evt" />
                  {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                  <AppLink href={`/scramble/gen?comp=${encodeURIComponent(m.ci)}`} className="scrmarks-comp">
                    {localizeCompName(m.ci, m.cn, isZh)}
                  </AppLink>
                  <span className="scrmarks-srcline">{compSourceLine(m.r, m.g, m.n, isZh, !!m.x)}</span>
                </div>
                {m.scramble && <div className="scrmarks-scramble">{m.scramble}</div>}
              </li>
            );
          })}
        </ul>
      )}

      {marks !== null && marks.length > 0 && !done && (
        <button type="button" className="scrmarks-more" disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? (tr({ zh: '加载中…', en: 'Loading…',
              zhHant: "載入中…"
        })) : (tr({ zh: '加载更多', en: 'Load more',
            zhHant: "載入更多"
        }))}
        </button>
      )}
    </div>
  );
}

export default function ScrambleMarksPage() {
  return (
    <Suspense fallback={<div className="scrmarks-page"><p className="scrmarks-empty">Loading…</p></div>}>
      <MarksFeed />
    </Suspense>
  );
}
