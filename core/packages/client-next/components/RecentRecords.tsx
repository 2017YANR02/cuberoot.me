'use client';

// Landing — WCA Live last-10-days WR/CR/NR list (60s sync).
// Text rendering reuses the server-side Python format_cli template (id-cached).
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Copy, Check } from 'lucide-react';
import { apiUrl } from '@/lib/api-base';
import { compLinkProps } from '@/lib/comp-link';
import { Flag } from '@/components/Flag';
import { ContinentIcon, RECORD_BADGE_CONTINENT } from '@/components/ContinentIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';
import './recent_records.css';

interface RecentRecord {
  id: string;
  tag: string;
  type: string;
  eventId: string;
  competitionId: string;
  formattedCn: string;
  formattedEn: string;
}

interface ApiResponse {
  fetchedAt: number;
  records: RecentRecord[];
}

function stripPrefix(text: string): string {
  return text.replace(/^(纪录快讯!\s*|BREAKING NEWS!\s*|Breaking News!\s*)/, '');
}

function shortenEvent(text: string, eventId: string, isZh: boolean): string {
  const short = eventDisplayName(eventId, isZh);
  if (isZh) {
    return text.replace(/^([\d:.,]+)(.+?)(单次|平均)/, (_m, val, _e, type) => `${val} ${short}${type}`);
  }
  return text.replace(
    /^([\d:.,]+\s)(\S+)(\s(?:WR|CR|NR|AsR|ER|NAR|SAR|OcR|AfR)\b)/,
    (_m, prefix, _e, tail) => `${prefix}${short}${tail}`,
  );
}

function renderFormatted(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /([\u{1F1E6}-\u{1F1FF}])([\u{1F1E6}-\u{1F1FF}])|(?<![A-Za-z])(WR|CR|NR|AsR|ER|NAR|SAR|OcR|AfR)(?![A-Za-z0-9])/gu;
  let lastEnd = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
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

  const filled = useMemo(
    () => (records ?? []).filter(r => (isZh ? r.formattedCn : r.formattedEn)),
    [records, isZh],
  );

  return { records, filled };
}

// Headless list — rendered inside the OngoingComps shared scroll panel (no own
// header / max-height; the panel owns the title tab and the scrollbar).
export function RecentRecordsList({ filled, isZh }: { filled: RecentRecord[]; isZh: boolean }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleCopy(r: RecentRecord) {
    const text = isZh ? r.formattedCn : r.formattedEn;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(r.id);
      setTimeout(() => setCopiedId(c => c === r.id ? null : c), 1500);
    }).catch(() => { /* ignore */ });
  }

  return (
    <ul className="recent-records-list">
      {filled.map(r => {
        const text = isZh ? r.formattedCn : r.formattedEn;
        const copied = copiedId === r.id;
        return (
          <li key={r.id} className="recent-records-row">
            <button
              type="button"
              className="recent-records-copy"
              onClick={() => handleCopy(r)}
              title={isZh ? (copied ? '已复制' : '复制') : (copied ? 'Copied' : 'Copy')}
              aria-label={isZh ? '复制' : 'Copy'}
            >
              {copied ? <Check size={13} strokeWidth={1.75} /> : <Copy size={13} strokeWidth={1.75} />}
            </button>
            <Link {...compLinkProps(r.competitionId)} className="recent-records-body">
              {renderFormatted(shortenEvent(stripPrefix(text), r.eventId, isZh))}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
