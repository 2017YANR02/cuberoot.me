'use client';

// Landing — WCA Live last-10-days WR/CR/NR list (60s sync).
// Text rendering reuses the API's Bark formatter (id-cached).
import { useEffect, useState, useMemo } from 'react';
import Link from '@/components/AppLink';
import { Copy, Check } from 'lucide-react';
import { apiUrl } from '@/lib/api-base';
import { compLinkProps } from '@/lib/comp-link';
import { Flag } from '@/components/Flag';
import { ContinentIcon, RECORD_BADGE_CONTINENT } from '@/components/ContinentIcon';
import { eventDisplayName, toWcaEventId } from '@/lib/wca-events';
import { formatWcaResult } from '@/lib/wca-format-result';
import { displayCuberName } from '@/lib/cuber-name-display';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';
import { usePinnedCountries } from '@/hooks/usePinnedCountries';
import { useCopy } from '@/hooks/useCopy';
import { stripRecordNewsPrefix } from '@/lib/record-news';
import './recent_records.css';
import { tr } from '@/i18n/tr';

interface RecentRecord {
  id: string;
  tag: string;
  type: string;
  eventId: string;
  competitionId: string;
  // Structured fields — used for the client-side fallback when the server's
  // pre-rendered formattedCn/En are empty (format_cli down / timing out).
  attemptResult: number;
  personName: string;
  countryIso2: string;
  formattedCn: string;
  formattedEn: string;
}

interface ApiResponse {
  fetchedAt: number;
  records: RecentRecord[];
}

/** Stable within each tier; country priority applies only to national records. */
export function sortRecentRecords<T extends Pick<RecentRecord, 'tag' | 'countryIso2'>>(
  records: readonly T[], countries: readonly string[],
): T[] {
  const level = (tag: string) => {
    if (tag === 'WR' || tag === 'FWR') return 0;
    if (tag === 'CR' || Object.hasOwn(RECORD_BADGE_CONTINENT, tag)) return 1;
    return tag === 'NR' ? 2 : 3;
  };
  const countryRank = (record: T) => {
    const index = countries.indexOf((record.countryIso2 || '').toLowerCase());
    return index < 0 ? countries.length : index;
  };
  return [...records].sort((a, b) => level(a.tag) - level(b.tag)
    || (a.tag === 'NR' && b.tag === 'NR' ? countryRank(a) - countryRank(b) : 0));
}

function shortenEvent(text: string, eventId: string, isZh: boolean): string {
  const short = eventDisplayName(eventId, isZh);
  if (isZh) {
    return text.replace(/^([\d:.,]+)(.+?)(单次|平均)/, (_m, val, _e, type) => `${val} ${short}${type}`);
  }
  return text.replace(
    /^([\d:.,]+\s)(\S+)(\s(?:FWR|WR|CR|NR|AsR|ER|NAR|SAR|OcR|AfR)\b)/,
    (_m, prefix, _e, tail) => `${prefix}${short}${tail}`,
  );
}

// Fallback when the server's pre-rendered text is missing (format_cli down /
// timing out). Build the line from the structured fields the API still returns.
function fallbackTypeLabel(kind: 'single' | 'average', isZh: boolean): string {
  if (isZh) return kind === 'average' ? '平均' : '单次';
  return kind === 'average' ? ' Avg' : '';
}

function renderFallback(r: RecentRecord, isZh: boolean): React.ReactNode[] {
  const kind = r.type === 'average' ? 'average' : 'single';
  const eid = toWcaEventId(r.eventId);
  const time = formatWcaResult(r.attemptResult, eid, kind);
  const ev = eventDisplayName(r.eventId, isZh);
  const name = displayCuberName(r.personName, isZh);
  const iso2 = (r.countryIso2 || '').toLowerCase();
  const contSlug = RECORD_BADGE_CONTINENT[r.tag];
  const nodes: React.ReactNode[] = [];
  if (iso2) nodes.push(<Flag key="f" iso2={iso2} className="recent-records-inline-flag" />);
  nodes.push(<span key="t">{time} </span>);
  nodes.push(<span key="e">{ev}{fallbackTypeLabel(kind, isZh)} </span>);
  if (contSlug) nodes.push(<ContinentIcon key="c" slug={contSlug} className="recent-records-continent-icon" />);
  nodes.push(<RecordBadge key="b" record={r.tag} variant="inline" />);
  if (name) nodes.push(<span key="n"> {name}</span>);
  return nodes;
}

function fallbackText(r: RecentRecord, isZh: boolean): string {
  const kind = r.type === 'average' ? 'average' : 'single';
  const eid = toWcaEventId(r.eventId);
  const time = formatWcaResult(r.attemptResult, eid, kind);
  const ev = eventDisplayName(r.eventId, isZh);
  const name = displayCuberName(r.personName, isZh);
  return `${time} ${ev}${fallbackTypeLabel(kind, isZh)} ${r.tag} ${name}`.replace(/\s+/g, ' ').trim();
}

function renderFormatted(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /([\u{1F1E6}-\u{1F1FF}])([\u{1F1E6}-\u{1F1FF}])|(FWR|WR|CR|NR|AsR|ER|NAR|SAR|OcR|AfR)(?![A-Za-z0-9])/gu;
  let lastEnd = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[3] && /[A-Za-z]/.test(text[m.index - 1] ?? '')) continue;
    if (m.index > lastEnd) parts.push(text.slice(lastEnd, m.index));
    if (m[1] && m[2]) {
      const cp1 = m[1].codePointAt(0)! - 0x1F1E6;
      const cp2 = m[2].codePointAt(0)! - 0x1F1E6;
      const iso2 = String.fromCharCode(0x61 + cp1, 0x61 + cp2);
      parts.push(<Flag key={`f${key++}`} iso2={iso2} className="recent-records-inline-flag" />);
    } else if (m[3]) {
      const slug = RECORD_BADGE_CONTINENT[m[3]];
      if (slug) parts.push(<ContinentIcon key={`c${key++}`} slug={slug} className="recent-records-continent-icon" />);
      parts.push(<RecordBadge key={`b${key++}`} record={m[3]} variant="inline" />);
    }
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd < text.length) parts.push(text.slice(lastEnd));
  return parts;
}

// Data hook — fetch + 60s sync + language-filtered list. Lifted out so the host
// (OngoingComps) can show a tab with the count and render the list inside the
// shared scroll panel.
export function useRecentRecords(isZh: boolean) {
  const [records, setRecords] = useState<RecentRecord[] | null>(null);
  const [, , defaultCountries] = usePinnedCountries();

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pull = () => {
      fetch(apiUrl('/v1/wca/recent-records'))
        .then(r => r.ok ? r.json() as Promise<ApiResponse> : Promise.reject(r.status))
        .then(j => { if (mounted) setRecords(j.records ?? []); })
        .catch(() => { if (mounted && records === null) setRecords([]); });
    };

    const kick = () => {
      if (!mounted) return;
      pull();
      timer = setInterval(pull, 60_000);
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
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep records that either have server-rendered text or enough structured
  // fields to render a client-side fallback (format_cli timing out → text empty).
  const filled = useMemo(
    () => sortRecentRecords((records ?? []).filter(
      r => (isZh ? r.formattedCn : r.formattedEn) || (r.eventId && r.attemptResult > 0),
    ), defaultCountries),
    [records, isZh, defaultCountries],
  );

  return { records, filled };
}

// Headless list — rendered inside the OngoingComps shared scroll panel (no own
// header / max-height; the panel owns the title tab and the scrollbar).
export function RecentRecordsList({ filled, isZh }: { filled: RecentRecord[]; isZh: boolean }) {
  const recordCopy = useCopy();

  function handleCopy(r: RecentRecord) {
    const text = (isZh ? r.formattedCn : r.formattedEn) || fallbackText(r, isZh);
    if (!text) return;
    recordCopy.copy(text, r.id);
  }

  return (
    <ul className="recent-records-list">
      {filled.map(r => {
        const text = isZh ? r.formattedCn : r.formattedEn;
        const copied = recordCopy.copiedKey === r.id;
        return (
          <li key={r.id} className="recent-records-row">
            <button
              type="button"
              className="recent-records-copy"
              onClick={() => handleCopy(r)}
              title={copied ? tr({ zh: '已复制', en: 'Copied' }) : tr({ zh: '复制', en: 'Copy' })}
              aria-label={tr({ zh: '复制', en: 'Copy'
            })}
            >
              {copied ? <Check size={13} strokeWidth={1.75} /> : <Copy size={13} strokeWidth={1.75} />}
            </button>
            <Link {...compLinkProps(r.competitionId)} className="recent-records-body">
              {text
                ? renderFormatted(shortenEvent(stripRecordNewsPrefix(text), r.eventId, isZh))
                : renderFallback(r, isZh)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
