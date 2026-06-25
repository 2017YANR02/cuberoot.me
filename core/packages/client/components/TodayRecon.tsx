'use client';

// Landing「今日复盘」— /recon 最新录入那天的全部复盘。每次加载自动取最新一天。
// 默认只显示最新一条静态预览卡(打乱 2D 展开图 + 成绩/选手/比赛/方法摘要);
// 当天录入多条时下方出现展开按钮,展开后逐条列出。点卡进 /recon/[id] 看完整回放。
// 数据:lib/recon-api getTodayRecons()(主用 /v1/recon/today,回退 /latest 单条)。
import { useEffect, useState } from 'react';
import Link from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import type { ReconSolve } from '@cuberoot/shared';
import { getTodayRecons } from '@/lib/recon-api';
import { formatTime, formatRound } from '@/lib/recon-utils';
import { eventDisplayName, toWcaEventId, isWcaEvent } from '@/lib/wca-events';
import { EventIcon } from '@/components/EventIcon';
import { Flag } from '@/components/Flag';
import { RecordBadge } from '@/components/RecordBadge';
import { displayCuberName } from '@/lib/cuber-name-display';
import { localizeCompName } from '@/lib/comp-localize';
import { reconPathSeg } from '@/lib/recon-seo';
import { ScramblePreview2D, eventHasScramblePreview } from '@/components/ScramblePreview2D';
import './today_recon.css';
import { tr } from '@/i18n/tr';

interface Props { lang: 'zh' | 'en' }

function ReconCard({ solve, isZh }: { solve: ReconSolve; isZh: boolean }) {
  const timeText = solve.value || (solve.rawTime != null ? formatTime(solve.rawTime) : '');
  const scramble = solve.optimalScramble || solve.wcaScramble || '';
  const wcaEvent = solve.event ? toWcaEventId(solve.event) : '';
  const showNet = !!scramble && !!wcaEvent && eventHasScramblePreview(wcaEvent);
  const compName = solve.comp ? localizeCompName(solve.compWcaId ?? '', solve.comp, isZh) : '';
  const roundText = formatRound(solve.round, solve.solveNum);

  return (
    <Link href={`/recon/${reconPathSeg(solve)}`} prefetch={false} className="tr-card">
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
          {(() => {
            // 主选手 + 共同完成者(整卡是 Link,名字不单独成链)
            const cubers = [
              { name: solve.person || '', country: solve.personCountry },
              ...(solve.coPersons ?? []),
            ].filter(c => c.name);
            if (cubers.length === 0) return null;
            return (
              <span className="tr-person">
                {cubers.map((c, i) => (
                  <span key={i} className="tr-person-one">
                    {i > 0 ? <span className="tr-cuber-sep"> &amp; </span> : null}
                    {c.country && <Flag iso2={c.country} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                    {displayCuberName(c.name, isZh)}
                  </span>
                ))}
              </span>
            );
          })()}
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
    </Link>
  );
}

export default function TodayRecon({ lang }: Props) {
  const isZh = lang === 'zh';
  const [recons, setRecons] = useState<ReconSolve[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  // idle-defer fetch(同 RecentScrambles / OngoingComps,不阻塞首屏)
  useEffect(() => {
    let on = true;
    const kick = () => {
      if (!on) return;
      getTodayRecons()
        .then((list) => { if (on) setRecons(list); })
        .catch(() => { if (on) setRecons([]); });
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

  if (!recons || recons.length === 0) return null;

  // 默认显示首行两条(一行两卡);其余折进「更多」。
  const visible = expanded ? recons : recons.slice(0, 2);

  return (
    <div className="today-recon">
      <div className="tr-head">
        <span className="tr-title">{tr({ zh: '今日复盘', en: 'Recon of the Day'
        })}</span>
        <Link href="/recon" prefetch={false} className="tr-all">{tr({ zh: '全部', en: 'All recons' })}</Link>
      </div>

      <div className="tr-cards">
        {visible.map((s) => <ReconCard key={s.id} solve={s} isZh={isZh} />)}
      </div>

      {recons.length > 2 && (
        <MoreToggle expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
      )}
    </div>
  );
}
