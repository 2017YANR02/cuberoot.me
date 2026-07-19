'use client';

// /wca/result-watch — 关注选手「往期成绩变更」监控。
// 监控一批选手的全生涯 WCA 成绩,一旦某条往期成绩被取消 / 修正 / 纪录标记变动 / 整条移除,
// 后台 diff 检出并记录,这里按检出时间倒序展示。可按选手筛选。

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import Link from '@/components/AppLink';
import PersonLink from '@/components/PersonLink';
import { Flag } from '@/components/Flag';
import { EventIcon } from '@/components/EventIcon';
import { displayCuberName } from '@/lib/cuber-name-display';
import { localizeCompName } from '@/lib/comp-localize';
import { eventDisplayName } from '@/lib/wca-events';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';
import { useAuthStore } from '@/lib/auth-store';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import {
  fetchResultWatchStatus, fetchResultChanges, fetchPendingChanges, canonicalRound, formatChangeFieldValue,
  approveResultChange, rejectResultChange,
  type ResultWatchStatus, type ResultChange,
} from '@/lib/result-watch-api';
import {
  BellRing, RefreshCw, MinusCircle, PencilLine, Clock, ChevronDown, ShieldAlert, Hourglass, Check, X,
} from 'lucide-react';
import './result-watch.css';

const FIELD_ORDER = ['best', 'average', 'attempts', 'pos', 'regional_single_record', 'regional_average_record'];

export default function ResultWatchClient() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = useT();
  useDocumentTitle('成绩变更监控', 'Result Change Monitor');

  const [wcaId, setWcaId] = useQueryState(
    'wcaId',
    parseAsString.withOptions({ history: 'replace', scroll: false }),
  );
  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum(['all', 'pending']).withDefault('all').withOptions({ history: 'replace', scroll: false }),
  );
  const myWcaId = useAuthStore((s) => s.user?.wcaId);
  const admin = isAdminWcaId(myWcaId);

  const [status, setStatus] = useState<ResultWatchStatus | null>(null);
  const [changes, setChanges] = useState<ResultChange[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    fetchResultWatchStatus(ac.signal)
      .then((s) => setStatus(s))
      .catch((e) => { if (e.name !== 'AbortError') setErr(String(e.message ?? e)); });
    return () => ac.abort();
  }, [reloadKey]);

  useEffect(() => {
    const ac = new AbortController();
    setChanges(null);
    setErr(null);
    const p = view === 'pending'
      ? fetchPendingChanges(300, ac.signal)
      : fetchResultChanges(wcaId || null, 300, ac.signal);
    p.then((c) => setChanges(c))
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setErr(String(e.message ?? e));
        setChanges([]); // 停 loading;错误信息单独展示(避免「加载中…」与错误并存)
      });
    return () => ac.abort();
  }, [wcaId, view, reloadKey]);

  // 选手筛选下拉:有变更的排前,其余按名字。无计数(站规)。
  const personOptions = useMemo(() => {
    const ps = [...(status?.persons ?? [])];
    ps.sort((a, b) =>
      (b.changeCount > 0 ? 1 : 0) - (a.changeCount > 0 ? 1 : 0) ||
      displayCuberName(a.name ?? a.wcaId, isZh).localeCompare(displayCuberName(b.name ?? b.wcaId, isZh)),
    );
    return ps;
  }, [status, isZh]);

  const lastChecked = status?.lastCheckedAt ? relTime(status.lastCheckedAt, t) : null;
  const watchedCount = status?.persons.length ?? 0;

  return (
    <div className="result-watch-page">
      <header className="rw-header">
        <div className="rw-title-row">
          <BellRing size={22} strokeWidth={1.75} className="rw-title-icon" />
          <h1 className="rw-title">{t('往期成绩变更监控', 'Result Change Monitor')}</h1>
          <button
            type="button"
            className="rw-refresh"
            onClick={() => setReloadKey((k) => k + 1)}
            title={t('刷新', 'Refresh')}
            aria-label={t('刷新', 'Refresh')}
          >
            <RefreshCw size={16} strokeWidth={1.75} />
          </button>
        </div>
        <p className="rw-intro">
          {t(
            '持续监控一批选手的全部历史成绩。一旦某条往期成绩被取消、修正或纪录标记变动,就会出现在下方。',
            'Continuously watches a roster of cubers’ full result history. Whenever a past result is cancelled, corrected, or its record marker changes, it shows up below.',
          )}
        </p>
      </header>

      <div className="rw-stats">
        <span className="rw-stat">
          <strong>{watchedCount}</strong>
          {t(' 位选手', ' cubers')}
        </span>
        <span className="rw-stat-sep" />
        <span className="rw-stat">
          <strong>{status?.totalChanges ?? 0}</strong>
          {t(' 条变更', ' changes')}
        </span>
        {(status?.pendingChanges ?? 0) > 0 && (
          <>
            <span className="rw-stat-sep" />
            <button
              type="button"
              className={`rw-stat rw-stat-pending ${view === 'pending' ? 'is-active' : ''}`}
              onClick={() => setView(view === 'pending' ? 'all' : 'pending')}
              title={t('待管理员审核的提议', 'Proposals awaiting admin review')}
            >
              <Hourglass size={13} strokeWidth={1.75} />
              <strong>{status?.pendingChanges}</strong>{t(' 待审核', ' pending')}
            </button>
          </>
        )}
        {lastChecked && (
          <>
            <span className="rw-stat-sep" />
            <span className="rw-stat rw-stat-muted">
              <Clock size={13} strokeWidth={1.75} />
              {t('最近检查 ', 'Checked ')}{lastChecked}
            </span>
          </>
        )}
      </div>

      <div className="rw-toolbar">
        <div className="rw-select-wrap">
          <select
            className="rw-select"
            value={wcaId ?? ''}
            onChange={(e) => setWcaId(e.target.value || null)}
          >
            <option value="">{t('全部选手', 'All cubers')}</option>
            {personOptions.map((p) => (
              <option key={p.wcaId} value={p.wcaId}>
                {displayCuberName(p.name ?? p.wcaId, isZh)}
              </option>
            ))}
          </select>
          <ChevronDown size={15} className="rw-select-chev" />
        </div>
      </div>

      {err && <div className="rw-error">{t('加载失败:', 'Failed to load: ')}{err}</div>}

      {status && !status.enabled && (changes?.length ?? 0) === 0 && (
        <div className="rw-note">
          <ShieldAlert size={15} strokeWidth={1.75} />
          {t('监控当前未启用,暂不会产生新记录。', 'Monitoring is currently off; no new changes will be recorded.')}
        </div>
      )}

      {changes === null && <div className="rw-loading">{t('加载中…', 'Loading…')}</div>}

      {changes !== null && changes.length === 0 && !err && (
        <div className="rw-empty">
          <BellRing size={26} strokeWidth={1.25} />
          <p className="rw-empty-title">{t('暂无成绩变更', 'No result changes yet')}</p>
          <p className="rw-empty-sub">
            {watchedCount > 0 && <><strong>{watchedCount}</strong> </>}
            {t('位选手的历史成绩,一切正常。', 'cubers’ result history watched — all clear.')}
          </p>
        </div>
      )}

      {changes !== null && changes.length > 0 && (
        <div className="rw-feed">
          {changes.map((c) => (
            <ChangeCard key={c.id} change={c} isZh={isZh} t={t} admin={admin} onModerated={() => setReloadKey((k) => k + 1)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChangeCard({ change: c, isZh, t, admin, onModerated }: {
  change: ResultChange;
  isZh: boolean;
  t: (zh: string, en: string) => string;
  admin: boolean;
  onModerated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isPending = c.status === 'pending';
  const moderate = async (action: 'approve' | 'reject') => {
    setBusy(true);
    try {
      await (action === 'approve' ? approveResultChange : rejectResultChange)(c.id);
      onModerated();
    } catch (e) {
      window.alert((e as Error).message);
      setBusy(false);
    }
  };
  const removed = c.changeType === 'removed';
  const eventId = c.eventId || '333';
  const rl = canonicalRound(c.roundTypeId);
  const roundText =
    rl === 'f' ? t('决赛', 'Final')
      : rl === '1' ? t('一轮', 'Round 1')
        : rl === '2' ? t('二轮', 'Round 2')
          : rl === '3' ? t('三轮', 'Round 3')
            : (c.roundTypeId || '');

  const personName = displayCuberName(c.personName ?? c.wcaId, isZh);
  const compLabel = c.compName ? localizeCompName(c.competitionId ?? '', c.compName, isZh) : (c.competitionId ?? '');

  return (
    <article className={`rw-card rw-card-${c.changeType}`}>
      <div className="rw-card-top">
        <span className={`rw-badge rw-badge-${c.changeType}`}>
          {removed ? <MinusCircle size={13} strokeWidth={2} /> : <PencilLine size={13} strokeWidth={2} />}
          {removed ? t('成绩移除', 'Removed') : t('成绩修改', 'Modified')}
        </span>
        {isPending && (
          <span className="rw-badge rw-badge-pending">
            <Hourglass size={12} strokeWidth={2} />
            {t('待审核', 'Pending')}
          </span>
        )}
        <time className="rw-card-time" title={c.detectedAt}>{relTime(c.detectedAt, t)}</time>
      </div>

      <div className="rw-card-person">
        {c.personIso2 && <Flag iso2={c.personIso2} spanClassName="rw-flag" imgClassName="rw-flag-ct" />}
        <PersonLink wcaId={c.wcaId} className="rw-person-link">{personName}</PersonLink>
      </div>

      <div className="rw-card-context">
        <EventIcon event={eventId} className="rw-evt-icon" />
        <span className="rw-ctx-event">{eventDisplayName(eventId, isZh)}</span>
        {roundText && <><span className="rw-ctx-dot" />{roundText}</>}
        {c.competitionId && (
          <>
            <span className="rw-ctx-dot" />
            <Link prefetch={false} href={`/wca/comp/${c.competitionId}`} className="rw-comp-link">{compLabel}</Link>
          </>
        )}
        {c.compStartDate && <span className="rw-ctx-date">{c.compStartDate}</span>}
      </div>

      <div className="rw-card-diff">
        {removed ? (
          <div className="rw-removed-line">
            {t('该成绩已从 WCA 数据库移除', 'This result was removed from the WCA database')}
            {c.before && (
              <span className="rw-removed-val">
                {' ('}{formatChangeFieldValue('best', c.before.b, eventId)}
                {c.before.a > 0 ? ` / ${formatChangeFieldValue('average', c.before.a, eventId)}` : ''}{')'}
              </span>
            )}
          </div>
        ) : (
          <ul className="rw-diff-list">
            {orderedFields(c.fields).map((f, i) => (
              <li key={i} className="rw-diff-row">
                <span className="rw-diff-label">{fieldLabel(f.field, t)}</span>
                <span className="rw-diff-old">{formatChangeFieldValue(f.field, f.old, eventId)}</span>
                <span className="rw-diff-arrow">→</span>
                <span className="rw-diff-new">{formatChangeFieldValue(f.field, f.new, eventId)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isPending && (
        <div className="rw-card-actions">
          <span className="rw-proposer">
            {t('提议人 ', 'by ')}{c.createdBy ?? t('匿名', 'anon')}
            {c.note ? ` · ${c.note}` : ''}
          </span>
          {admin && (
            <span className="rw-mod-buttons">
              <button type="button" className="rw-approve" disabled={busy} onClick={() => moderate('approve')}>
                <Check size={13} strokeWidth={2.2} />{t('批准', 'Approve')}
              </button>
              <button type="button" className="rw-reject" disabled={busy} onClick={() => moderate('reject')}>
                <X size={13} strokeWidth={2.2} />{t('驳回', 'Reject')}
              </button>
            </span>
          )}
        </div>
      )}
    </article>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function orderedFields(fields: ResultChange['fields']): NonNullable<ResultChange['fields']> {
  if (!fields) return [];
  return [...fields].sort((a, b) => FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field));
}

function fieldLabel(field: string, t: (zh: string, en: string) => string): string {
  switch (field) {
    case 'best': return t('单次', 'Single');
    case 'average': return t('平均', 'Average');
    case 'attempts': return t('各次', 'Solves');
    case 'pos': return t('名次', 'Place');
    case 'regional_single_record': return t('单次纪录', 'Single record');
    case 'regional_average_record': return t('平均纪录', 'Average record');
    default: return field;
  }
}

/** 相对时间。翻译部分只放不含数字的单位词(可被 zh:gen-localt 生成繁体)。 */
function relTime(iso: string, t: (zh: string, en: string) => string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return iso;
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return t('刚刚', 'just now');
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} ${t('分钟前', 'min ago')}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${t('小时前', 'h ago')}`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} ${t('天前', 'd ago')}`;
  // 超过 30 天直接显示日期
  return iso.slice(0, 10);
}
