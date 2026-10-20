'use client';

/**
 * 停表排名：PR 比较本人 WCA 正式成绩，NR/CR/WR 比较 WCA 历史个人最佳。
 * 只显示用户选择且有数据的范围；缺 WCA ID 时不查 PR，缺国家时不查 NR/CR。
 * 输入为时间厘秒，FMC/多盲不能按计时时长排名。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TIMER_RANK_SCOPES, type TimerRankScope } from '@cuberoot/shared/timer';
import { EVENT_DISPLAY_EN, EVENT_DISPLAY_ZH } from '@cuberoot/shared/wca-events';
import { toWcaEventForRank, type RankResult } from '@cuberoot/shared/timer/rank-client';

import type { EventId } from '@cuberoot/shared/timer';
import { timerPersonalOfficialRank, timerRankPills, type TimerRankOfficialRow } from '@cuberoot/shared/timer/rank-presentation';
export type { TimerRankOfficialRow } from '@cuberoot/shared/timer/rank-presentation';
import { RecordBadge } from './RecordBadge';
import { WCA_ID_REGEX } from '@cuberoot/shared/wca-person';
import './timer-rank.css';
export interface TimerRankHost { fetchRankFor(event: string, centis: number, type: 'single' | 'average', country?: string): Promise<RankResult | null>; fetchOfficial(wcaId: string): Promise<TimerRankOfficialRow[]>; }

export interface RankBadgeProps {
  host: TimerRankHost;
  /** 计时器内部 EventId */
  eventId: string;
  /** 有效成绩,单位厘秒;null 或 DNF -> 不渲染 */
  centis: number | null;
  type: 'single' | 'average';
  /** 用户国家 iso2(如 'US' / 'CN');传了才查 NR/CR */
  country?: string;
  isZh?: boolean;
  className?: string;
  scopes?: readonly TimerRankScope[];
  wcaId?: string;
}

export function TimerRankBadge({
  host,
  eventId,
  centis,
  type,
  country,
  isZh = false,
  className,
  scopes = TIMER_RANK_SCOPES,
  wcaId = '',
}: RankBadgeProps) {
  const rowRef = useRef<HTMLSpanElement>(null);
  // Rankings stay on one line. Fit the actual text, including record badges,
  // after async results arrive and whenever its container or font changes.
  useLayoutEffect(() => {
    const row = rowRef.current;
    const line = row?.querySelector<HTMLElement>('.rank-chip-inner');
    if (!row || !line) return;
    const fit = () => {
      let size = parseFloat(getComputedStyle(row).fontSize) * 0.82;
      line.style.fontSize = `${size}px`;
      const available = row.clientWidth;
      if (available <= 0) return;
      for (let attempt = 0; attempt < 3; attempt++) {
        const width = line.getBoundingClientRect().width;
        if (width <= available) break;
        size *= Math.max(0, available - 1) / width;
        line.style.fontSize = `${size}px`;
      }
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(row);
    observer.observe(line);
    return () => observer.disconnect();
  });
  const tr = <T,>(text: { en: T; zh: T }) => text[isZh ? 'zh' : 'en'];
  const { fetchRankFor, fetchOfficial: fetchWcaPersonResults } = host;
  const wcaEvent = toWcaEventForRank(eventId as EventId);
  const valid = eventId !== '333fm' && eventId !== '333mbld'
    && centis != null && Number.isFinite(centis) && centis > 0;
  const queryCountry = scopes.includes('NR') || scopes.includes('CR') ? country : undefined;
  const queryWca = valid && wcaEvent != null && (scopes.includes('WR') || !!queryCountry);
  const personId = wcaId.trim().toUpperCase();
  const queryPersonal = valid && wcaEvent != null && scopes.includes('PR') && WCA_ID_REGEX.test(personId);
  const [official, setOfficial] = useState<{ personId: string; rows: TimerRankOfficialRow[] } | null>(null);
  useEffect(() => {
    if (!queryPersonal) return;
    let alive = true;
    void fetchWcaPersonResults(personId).then((rows) => {
      if (alive) setOfficial({ personId, rows });
    }).catch(() => {
      if (alive) setOfficial(null);
    });
    return () => { alive = false; };
  }, [queryPersonal, personId, fetchWcaPersonResults]);

  const personal = useMemo(() => {
    if (!queryPersonal || official?.personId !== personId) return null;
    return timerPersonalOfficialRank(official.rows, wcaEvent!, centis!, type);
  }, [queryPersonal, official, personId, wcaEvent, type, centis]);

  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'none'>('idle');
  const [result, setResult] = useState<{ key: string; value: RankResult } | null>(null);
  const queryKey = JSON.stringify([eventId, centis, type, queryCountry]);

  useEffect(() => {
    if (!queryWca) {
      setState('none');
      setResult(null);
      return;
    }
    let alive = true;
    setState('loading');
    fetchRankFor(eventId, centis as number, type, queryCountry || undefined)
      .then((r) => {
        if (!alive) return;
        if (r) {
          setResult({ key: queryKey, value: r });
          setState('done');
        } else {
          setResult(null);
          setState('none');
        }
      })
      .catch(() => {
        if (!alive) return;
        setResult(null);
        setState('none');
      });
    return () => {
      alive = false;
    };
  }, [queryWca, eventId, centis, type, queryCountry, queryKey, fetchRankFor]);

  if (!valid || scopes.length === 0) return null;

  const eventName = wcaEvent ? (isZh ? EVENT_DISPLAY_ZH : EVENT_DISPLAY_EN)[wcaEvent] ?? wcaEvent : eventId;
  const typeWord = type === 'average' ? tr({ zh: '平均', en: 'average' }) : tr({ zh: '单次', en: 'single' });
  const scopeNames = {
    PR: tr({ zh: '个人 WCA 正式成绩', en: 'Personal WCA official results' }),
    NR: tr({ zh: '全国', en: 'National' }),
    CR: tr({ zh: '大洲', en: 'Continent' }),
    WR: tr({ zh: '世界', en: 'World' }),
  };

  const pills = timerRankPills(scopes, personal, queryWca && state === 'done' && result?.key === queryKey ? result.value : null, country);
  if (pills.length === 0) return null;

  // 悬停说明：对比历史比赛成绩，非实时官方排名。
  const parts = pills.map(({ scope, data }) => {
    const n = data.rank.toLocaleString('en-US');
    return `${scopeNames[scope]} #${n}`;
  });
  const detail = parts.join(' / ') + tr({
    zh: `（WCA ${eventName}${typeWord}，对比历史比赛成绩，非实时官方排名）`,
    en: ` (WCA ${eventName} ${typeWord}, vs historical competition results, not a live official rank)`,
  });

  return (
    <span ref={rowRef} className={`rank-badge-row${className ? ` ${className}` : ''}`}>
      <span className="rank-pills">
        <span
          className="rank-pill"
          title={detail}
        >
          {/* 单 chip:WR12/AsR9/NR9;名次为 1 即该档纪录,改用 RecordBadge(WR/AsR/NR) */}
          <span className="rank-chip-inner">
            {pills.map(({ scope, label, data }, i) => (
              <span key={scope}>
                {i > 0 && <span className="rank-chip-sep">/</span>}
                {data.rank === 1
                  ? <RecordBadge record={label} variant="standalone" />
                  : `${label}${data.rank.toLocaleString('en-US')}`}
              </span>
            ))}
          </span>
        </span>
      </span>
    </span>
  );
}
