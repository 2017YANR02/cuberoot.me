'use client';

/**
 * /timer/marks — 打乱足迹:全站最近的 WCA 真实打乱「打卡」feed(公开)。
 * 登录用户在 /timer 用 WCA 真实打乱练习时可标记做过的打乱(可带成绩);
 * 这里按时间倒序展示所有人的标记。
 *   ?wcaId= 过滤单人(「只看我的」)、?q= 搜选手/比赛(服务端 ILIKE)。
 * 每行可删:本人删自己,管理员删任何人。keyset 分页(before=上页最后一条 id)。
 */
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryStates, parseAsString } from 'nuqs';
import { CheckCircle2, Search, Trash2 } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { ClearButton } from '@/components/ClearButton';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { Flag } from '@/components/Flag';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore, isAdmin } from '@/lib/auth-store';
import { ownerKey as computeOwnerKey } from '@cuberoot/shared/account';
import { displayCuberName } from '@/lib/name-utils';
import { localizeCompName } from '@/lib/comp-localize';
import { compFlagIso2, loadFlagData, flagDataVersion } from '@/lib/country-flags';
import { compSourceLine } from '@/lib/comp-schedule';
import { tr } from '@/i18n/tr';
import { fetchRecentMarks, deleteMarkById, type RecentMark } from '../_lib/marks';
import { formatMs } from '../_lib/stats';
import './marks.css';

const PAGE_SIZE = 30;

function fmtDate(epochSec: number): string {
  return new Date(epochSec * 1000).toISOString().slice(0, 10);
}

function MarksFeed() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('打乱足迹', 'Scramble Marks');
  const user = useAuthStore((st) => st.user);
  // 所有权键(与服务端一致):非 WCA 账号也能筛「只看我的」/ 删自己的标记。展示链接仍用真实 wcaId。
  const myKey = user ? computeOwnerKey(user.uid, user.wcaId) : '';
  // SSR/首帧统一为未登录,挂载后再放开,避免 hydration mismatch。
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const admin = mounted && isAdmin();

  const [{ wcaId: wcaIdFilter, q }, setQuery] = useQueryStates(
    { wcaId: parseAsString.withDefault(''), q: parseAsString.withDefault('') },
    { history: 'replace', scroll: false },
  );

  const [marks, setMarks] = useState<RecentMark[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [done, setDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  // 搜索框:本地 input + 防抖写回 URL(?q)。
  const [searchInput, setSearchInput] = useState(q);
  const [composing, setComposing] = useState(false);
  useEffect(() => { setSearchInput((prev) => (prev === q ? prev : q)); }, [q]);
  useEffect(() => {
    if (searchInput === q || composing) return;
    const t = setTimeout(() => void setQuery({ q: searchInput || null }), 250);
    return () => clearTimeout(t);
  }, [searchInput, composing, q, setQuery]);

  // 比赛名/国旗索引懒加载完成后重渲一次。
  const [, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => { void loadFlagData().then(setFlagVer); }, []);

  useEffect(() => {
    let cancel = false;
    setMarks(null);
    setLoadErr(false);
    setDone(false);
    fetchRecentMarks({ wcaId: wcaIdFilter || undefined, q: q || undefined, limit: PAGE_SIZE })
      .then((rows) => {
        if (cancel) return;
        setMarks(rows);
        setDone(rows.length < PAGE_SIZE);
      })
      .catch(() => { if (!cancel) setLoadErr(true); });
    return () => { cancel = true; };
  }, [wcaIdFilter, q]);

  const loadMore = useCallback(() => {
    const last = marks?.[marks.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    fetchRecentMarks({ wcaId: wcaIdFilter || undefined, q: q || undefined, limit: PAGE_SIZE, before: last.id })
      .then((rows) => {
        setMarks((cur) => [...(cur ?? []), ...rows]);
        setDone(rows.length < PAGE_SIZE);
      })
      .catch(() => { /* 下一次点重试 */ })
      .finally(() => setLoadingMore(false));
  }, [marks, loadingMore, wcaIdFilter, q]);

  const mineOnly = mounted && !!user && wcaIdFilter === myKey;
  const canDelete = (m: RecentMark) => mounted && !!user && (m.wcaId === myKey || admin);

  const onDelete = useCallback(async (m: RecentMark) => {
    const isOwn = !!user && m.wcaId === myKey;
    const msg = isOwn
      ? tr({ zh: '删除这条标记?', en: 'Delete this mark?' })
      : tr({ zh: `以管理员身份删除 ${displayCuberName(m.name, isZh) || m.wcaId} 的这条标记?`,
             en: `Delete ${displayCuberName(m.name, isZh) || m.wcaId}'s mark as admin?` });
    if (!window.confirm(msg)) return;
    setDeleting(m.id);
    try {
      await deleteMarkById(m.id);
      setMarks((cur) => (cur ?? []).filter((x) => x.id !== m.id));
    } catch {
      window.alert(tr({ zh: '删除失败,稍后再试。', en: 'Delete failed — try again.' }));
    }
    setDeleting(null);
  }, [user, isZh]);

  return (
    <div className="scrmarks-page">
      <h1 className="scrmarks-title">{tr({ zh: '打乱足迹', en: 'Scramble Marks'
    })}</h1>
      <p className="scrmarks-sub">
        {tr({
          zh: '在计时器里用 WCA 真实比赛打乱练习时,登录后可以给做过的打乱打卡。这里是全站最近的足迹。',
          en: 'When practicing with real WCA competition scrambles in the timer, signed-in users can mark the scrambles they have done. This is the site-wide trail.'
        })}
        {' '}
        <AppLink href="/timer">{tr({ zh: '去计时器', en: 'Open the timer'
        })}</AppLink>
      </p>

      <div className="scrmarks-search">
        <Search size={15} className="scrmarks-search-icon" />
        <input
          className="scrmarks-search-input"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={(e) => { setComposing(false); setSearchInput(e.currentTarget.value); }}
          placeholder={tr({ zh: '搜索选手 / 比赛…', en: 'Search cuber / competition…' })}
        />
        {searchInput && <ClearButton onClick={() => setSearchInput('')} isZh={isZh} variant="inline" />}
      </div>

      <div className="scrmarks-filter">
        {mounted && user && (
          <button
            type="button"
            className={`scrmarks-mine${mineOnly ? ' on' : ''}`}
            onClick={() => void setQuery({ wcaId: mineOnly ? null : myKey })}
          >
            {tr({ zh: '只看我的', en: 'Mine only' })}
          </button>
        )}
        {wcaIdFilter && !mineOnly && (
          <span className="scrmarks-filter-tag">
            {wcaIdFilter}
            <button type="button" className="scrmarks-filter-tag-btn" onClick={() => void setQuery({ wcaId: null })} aria-label="clear">×</button>
          </span>
        )}
      </div>

      {loadErr && <p className="scrmarks-empty">{tr({ zh: '加载失败,稍后再试。', en: 'Failed to load — try again later.'
    })}</p>}
      {!loadErr && marks === null && <p className="scrmarks-empty">{tr({ zh: '加载中…', en: 'Loading…'
    })}</p>}
      {!loadErr && marks !== null && marks.length === 0 && (
        <p className="scrmarks-empty">{q
          ? tr({ zh: '没有匹配的标记。', en: 'No matching marks.' })
          : tr({ zh: '还没有任何标记。', en: 'No marks yet.' })}</p>
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
                  {canDelete(m) && (
                    <button
                      type="button"
                      className="scrmarks-del"
                      disabled={deleting === m.id}
                      onClick={() => void onDelete(m)}
                      title={m.wcaId === myKey
                        ? tr({ zh: '删除', en: 'Delete' })
                        : tr({ zh: '管理员删除', en: 'Delete (admin)' })}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className="scrmarks-row-src">
                  <EventIcon event={m.e} className="scrmarks-evt" />
                  {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                  <AppLink href={`/scramble/gen?comp=${encodeURIComponent(m.ci)}`} prefetch={false} className="scrmarks-comp">
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
          {loadingMore ? tr({ zh: '加载中…', en: 'Loading…'
                          }) : tr({ zh: '加载更多', en: 'Load more'
                              })}
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
