'use client';

// Landing「今日复盘」— /recon 最新录入的一条(id 最大),每次加载自动取最新。
// 静态预览卡(打乱 2D 展开图 + 成绩/选手/比赛/方法摘要),点卡进 /recon/[id] 看完整回放。
// 数据:lib/recon-api getLatestRecon()(主用 /v1/recon/latest,回退 /list 首条)。
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ReconSolve } from '@cuberoot/shared';
import { getLatestRecon } from '@/lib/recon-api';
import { formatTime, formatRound } from '@/lib/recon-utils';
import { eventDisplayName, toWcaEventId, isWcaEvent } from '@/lib/wca-events';
import { EventIcon } from '@/components/EventIcon';
import { Flag } from '@/components/Flag';
import { RecordBadge } from '@/components/RecordBadge';
import { displayCuberName } from '@/lib/cuber-name-display';
import { localizeCompName } from '@/lib/comp-localize';
import { ScramblePreview2D, eventHasScramblePreview } from '@/components/ScramblePreview2D';
import './today_recon.css';

interface Props { lang: 'zh' | 'en' }

export default function TodayRecon({ lang }: Props) {
  const isZh = lang === 'zh';
  const [solve, setSolve] = useState<ReconSolve | null>(null);

  // idle-defer fetch(同 RecentScrambles / OngoingComps,不阻塞首屏)
  useEffect(() => {
    let on = true;
    const kick = () => {
      if (!on) return;
      getLatestRecon()
        .then((s) => { if (on) setSolve(s); })
        .catch(() => { if (on) setSolve(null); });
    };
    type RIC = (cb: () => void, opts?: { timeout?: number }) => number;
    const w = window as Window & { requestIdleCallback?: RIC; cancelIdleCallback?: (id: number) => void };
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (w.requestIdleCallback) idleId = w.requestIdleCallback(kick, { timeout: 2000 });
    else timeoutId = setTimeout(kick, 200);
    return () => {
      on = false;
      if (idleId !== null) w.cancelIdleCallback?.(idleId);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);

  if (!solve) return null;

  const timeText = solve.value || (solve.rawTime != null ? formatTime(solve.rawTime) : '');
  const scramble = solve.optimalScramble || solve.wcaScramble || '';
  const wcaEvent = solve.event ? toWcaEventId(solve.event) : '';
  const showNet = !!scramble && !!wcaEvent && eventHasScramblePreview(wcaEvent);
  const compName = solve.comp ? localizeCompName(solve.compWcaId ?? '', solve.comp, isZh) : '';
  const roundText = formatRound(solve.round, solve.solveNum);

  return (
    <div className="today-recon">
      <div className="tr-head">
        <span className="tr-title">{isZh ? '今日复盘' : 'Recon of the Day'}</span>
        <Link href="/recon" prefetch={false} className="tr-all">{isZh ? '全部' : 'All recons'}</Link>
      </div>

      <Link href={`/recon/${solve.id}`} prefetch={false} className="tr-card">
        <div className="tr-cube">
          {showNet
            ? <ScramblePreview2D event={wcaEvent} scramble={scramble} size={56} />
            : timeText
              ? <b className="tr-time-big">{timeText}</b>
              : <EventIcon event={solve.event} className="tr-evt-big" />}
        </div>

        <div className="tr-info">
          <div className="tr-line tr-line-main">
            {showNet && timeText && <b className="tr-time">{timeText}</b>}
            {solve.regionalSingleRecord && (
              <RecordBadge record={solve.regionalSingleRecord} variant="inline" iso2={solve.personCountry} />
            )}
            {solve.event && isWcaEvent(solve.event) && (
              <EventIcon event={solve.event} className="tr-evt" title={eventDisplayName(solve.event, isZh)} />
            )}
            {solve.person && (
              <span className="tr-person">
                {solve.personCountry && <Flag iso2={solve.personCountry} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                {displayCuberName(solve.person, isZh)}
              </span>
            )}
          </div>

          {(solve.method || solve.stm || typeof solve.tps === 'number') && (
            <div className="tr-line tr-meta">
              {solve.method && <span>{solve.method}</span>}
              {solve.stm ? <span>{solve.stm} STM</span> : null}
              {typeof solve.tps === 'number' ? <span>{solve.tps.toFixed(2)} TPS</span> : null}
            </div>
          )}

          {compName && (
            <div className="tr-line tr-comp">
              {solve.country && <Flag iso2={solve.country} spanClassName="country-flag" imgClassName="country-flag-ct" />}
              <span className="tr-comp-name">{compName}</span>
              {roundText && <span className="tr-round">{roundText}</span>}
            </div>
          )}
        </div>

        <span className="tr-arrow" aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
