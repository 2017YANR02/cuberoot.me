'use client';

import { useEffect, useRef, useState } from 'react';
import AppLink from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import { useEntryRouter } from '@/hooks/useEntryRouter';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { competitionDateTime } from '@/lib/competition-date';
import { competitionHref } from '@/lib/competition-links';
import { checkInCompetition, listMyCompetitionEntries, type MyCompetitionEntry } from '@/lib/online-competition-api';

function roomHref(entry: MyCompetitionEntry) {
  return `${competitionHref(entry.competitionId)}?entry=${encodeURIComponent(entry.registrationId)}`;
}

export function MyCompetitions() {
  const t = useT();
  const lang = useLang();
  const router = useEntryRouter();
  const [entries, setEntries] = useState<MyCompetitionEntry[]>([]);
  const [revision, setRevision] = useState(0);
  const [busyEntry, setBusyEntry] = useState('');
  const [actionError, setActionError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [now, setNow] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const { entries } = await listMyCompetitionEntries();
        if (active) { setEntries(entries); setLoadFailed(false); }
      } catch {
        if (active) setLoadFailed(true);
      } finally { pending = false; }
    };
    void load();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [revision]);

  const hasReservations = entries.some(entry => entry.action === 'pay' && entry.reservationExpiresAt);
  useEffect(() => {
    if (!hasReservations) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [hasReservations]);

  async function checkIn(entry: MyCompetitionEntry) {
    if (busyEntry) return;
    setBusyEntry(entry.registrationId);
    setActionError('');
    try {
      await checkInCompetition(entry.registrationId);
      if (mounted.current) {
        setEntries(current => current.map(item => item.registrationId === entry.registrationId ? { ...item, action: 'enter' } : item));
        router.push((lang === 'zh' ? '/zh' : '') + roomHref(entry));
        setRevision(value => value + 1);
      }
    } catch {
      if (mounted.current) {
        setActionError(t('检录未完成，请查看比赛详情或重试。', 'Check-in did not complete. Open the competition or try again.'));
        setRevision(value => value + 1);
      }
    } finally {
      if (mounted.current) setBusyEntry('');
    }
  }

  const labels = {
    pay: t('继续付款', 'Continue to payment'),
    results: t('查看成绩', 'View results'),
    enter: t('进入赛场', 'Enter session'),
    enter_bracket: t('进入对阵', 'Enter bracket'),
    check_in: t('检录', 'Check in'),
    upcoming: t('查看参赛安排', 'View session details'),
    details: t('查看比赛', 'View competition'),
  };
  function renderEntry(entry: MyCompetitionEntry) {
    const detail = competitionHref(entry.competitionId);
    const deadline = Date.parse(entry.reservationExpiresAt ?? '');
    const seconds = entry.action === 'pay' && now && Number.isFinite(deadline)
      ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
    const action = seconds === 0 ? 'details' : entry.action;
    const target = action === 'pay' ? `/platform/orders/${encodeURIComponent(entry.orderId)}`
      : action === 'enter' ? roomHref(entry) : action === 'enter_bracket' ? `${detail}#competition-bracket` : detail;
    const actionLabel = labels[action];
    const remaining = seconds === null ? null : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    return <div className="my-competition-row" key={entry.registrationId}>
      <div>
        <h3><AppLink href={detail} prefetch={false}>{t(entry.titleZh || entry.titleEn, entry.titleEn || entry.titleZh)}</AppLink></h3>
        <p><time dateTime={entry.sessionStartsAt}>{competitionDateTime(entry.sessionStartsAt)}</time> {t('北京时间', 'UTC+8')}{entry.status === 'refunded' && <> · {t('已退款', 'Refunded')}</>}</p>
        {remaining !== null && <p className="competition-reservation-remaining" data-status={seconds === 0 ? 'expired' : (seconds ?? Infinity) <= 300 ? 'expiring' : undefined}>
          {seconds === 0 ? t('锁位已到期', 'Reservation expired') : t(`锁位剩余 ${remaining}`, `Seat held for ${remaining}`)}
        </p>}
      </div>
      {action === 'check_in'
        ? <button type="button" className="competition-primary" disabled={!!busyEntry} onClick={() => { void checkIn(entry); }}>{busyEntry === entry.registrationId ? t('正在检录…', 'Checking in…') : actionLabel}</button>
        : <AppLink href={target} className={['pay', 'enter', 'enter_bracket'].includes(action) ? 'competition-primary' : 'competition-secondary'} prefetch={false}>{actionLabel}</AppLink>}
    </div>;
  }

  const [next, ...other] = entries;
  if (!next && !loadFailed) return null;
  return <section className="my-competitions" data-site-surface="panel" aria-labelledby="my-competitions-title">
    <h2 id="my-competitions-title">{t('我的比赛', 'My competitions')}</h2>
    {next && renderEntry(next)}
    {other.length > 0 && <details className="my-competition-more"><MoreToggle as="summary">{t('其他报名', 'Other entries')}</MoreToggle>{other.map(renderEntry)}</details>}
    {actionError && <p role="alert" className="competition-error">{actionError}</p>}
    {loadFailed && <div className="my-competition-error">
      <p role="status">{t('暂时无法加载参赛记录。', 'Could not load your entries.')}</p>
      <button type="button" className="competition-secondary" onClick={() => setRevision(value => value + 1)}>{t('重试', 'Retry')}</button>
    </div>}
  </section>;
}
