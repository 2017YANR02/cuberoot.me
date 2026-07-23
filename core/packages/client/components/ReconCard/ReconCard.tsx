'use client';

// 复盘卡片(卡片视图单卡)——/recon?view=grid 与首页「今日复盘」共用。
// 整张卡是一个 <a>(AppLink,支持中键新开),故内部名字/比赛只渲染纯文本,禁套 <a>。
// 从 app/[lang]/recon/page.tsx 提取,样式见 ./recon_card.css。
import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { Video, Link2, Lock } from 'lucide-react';
import type { ReconSolve } from '@cuberoot/shared';
import { pickReconCover, coverSyncSrc, loadBiliCover, loadDouyinCover } from '@/lib/recon-video-cover';
import { formatAvg, formatReconSingle } from '@/lib/recon-utils';
import { displayCuberName } from '@/lib/cuber-name-display';
import { Flag } from '@/components/Flag';
import { localizeCompName } from '@/lib/comp-localize';
import { RecordBadge } from '@/components/RecordBadge';
import { EventIcon } from '@/components/EventIcon';
import { isWcaEvent, eventDisplayName, toWcaEventId } from '@/lib/wca-events';
import { ScramblePreview2D, eventHasScramblePreview } from '@/components/ScramblePreview2D';
import { tr } from '@/i18n/tr';
import './recon_card.css';

// 卡片缩略图：有视频→封面图（YouTube 直链 / B 站 / 抖音异步取），否则打乱图，再否则项目图标。
function ReconCardMedia({ solve, isZh }: { solve: ReconSolve; isZh: boolean }) {
  const cover = useMemo(() => pickReconCover(solve.videoUrl, isZh), [solve.videoUrl, isZh]);
  const ytSrc = cover ? coverSyncSrc(cover) : null;
  const [asyncSrc, setAsyncSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setAsyncSrc(null);
    if (cover?.kind !== 'bili' && cover?.kind !== 'douyin') return;
    let alive = true;
    const loader = cover.kind === 'bili' ? loadBiliCover(cover.id) : loadDouyinCover(cover.id);
    void loader.then(pic => {
      if (!alive) return;
      if (pic) setAsyncSrc(pic); else setFailed(true);
    });
    return () => { alive = false; };
  }, [cover]);

  const imgSrc = failed ? null : (ytSrc ?? asyncSrc);

  if (imgSrc) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="recon-card-cover"
          src={imgSrc}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </>
    );
  }

  // 无封面：打乱图（自包含 SVG）→ 项目图标兜底
  const previewEvent = toWcaEventId(solve.event);
  const scramble = solve.optimalScramble || solve.wcaScramble || '';
  const hasVideo = !!solve.videoUrl && solve.videoUrl.trim() !== '';
  return (
    <>
      {scramble && eventHasScramblePreview(previewEvent) ? (
        <ScramblePreview2D event={previewEvent} scramble={scramble} size={52} />
      ) : (
        <div className="recon-card-media-empty">
          {isWcaEvent(solve.event)
            ? <EventIcon event={solve.event} title={eventDisplayName(solve.event, isZh)} />
            : <span>{solve.event}</span>}
        </div>
      )}
      {hasVideo && <span className="recon-card-video"><Video size={13} /></span>}
      {/* 可见性角标——仅非公开时出现(这些卡片只对本人 / 管理员进列表),标明分享状态 */}
      {solve.visibility === 'unlisted' && (
        <span className="recon-card-vis" title={tr({ zh: '不公开列出', en: 'Unlisted' })}><Link2 size={12} /></span>
      )}
      {solve.visibility === 'private' && (
        <span className="recon-card-vis recon-card-vis--private" title={tr({ zh: '私享', en: 'Private' })}><Lock size={12} /></span>
      )}
    </>
  );
}

export function ReconCard({ solve, isZh, href, horizontal = false }: {
  solve: ReconSolve; isZh: boolean; href: string; horizontal?: boolean;
}) {
  const cubers = [
    { name: solve.person || '', country: solve.personCountry },
    ...(solve.coPersons ?? []).map(c => ({ name: c.name, country: c.country })),
  ].filter(c => c.name);
  const single = formatReconSingle(solve.event, solve.value, solve.rawTime);
  const compName = localizeCompName(solve.compWcaId ?? '', solve.comp || '', isZh);

  return (
    <Link href={href} prefetch={false} className={`recon-card${horizontal ? ' recon-card--row' : ''}`}>
      <div className="recon-card-media">
        <ReconCardMedia solve={solve} isZh={isZh} />
      </div>
      <div className="recon-card-body">
        {/* 表头风格:成绩 + 项目图标 + 项目名 + 国旗 + 选手名,同一行(对齐 /recon 详情页标题) */}
        <div className="recon-card-head">
          {/* 纪录标志(PB/WR…)作为成绩数字的右上角标,需与数字同处 inline 上下文才生效 vertical-align */}
          <span className="recon-card-result mono">
            {single}
            {solve.regionalSingleRecord && (
              <RecordBadge record={solve.regionalSingleRecord} variant="inline" iso2={solve.personCountry} />
            )}
          </span>
          {solve.event && (
            <span className="recon-card-evt">
              {isWcaEvent(solve.event)
                ? <EventIcon event={solve.event} title={eventDisplayName(solve.event, isZh)} />
                : solve.event}
            </span>
          )}
          <span className="recon-card-solver">
            {cubers.map((c, i) => (
              <span key={i}>
                {i > 0 ? <span className="recon-cuber-sep"> &amp; </span> : null}
                {c.country ? <><Flag iso2={c.country} className="recon-inline-flag" />{' '}</> : null}
                {displayCuberName(c.name, isZh)}
              </span>
            ))}
          </span>
        </div>
        {/* 均值 + 比赛同一行,放不下时比赛整体折到下一行(不硬拆) */}
        <div className="recon-card-sub">
          {solve.average != null && (
            <span className="recon-card-avg">
              <span className="mono">{formatAvg(solve.average)}</span>
              {solve.regionalAverageRecord && (
                <RecordBadge record={solve.regionalAverageRecord} variant="inline" iso2={solve.personCountry} />
              )}{' '}
              <span className="recon-card-avg-label">{tr({ zh: '平均', en: 'Avg' })}</span>
            </span>
          )}
          <span className="recon-card-foot">
            {solve.country ? <Flag iso2={solve.country} className="recon-inline-flag" /> : null}
            <span className="recon-card-comp">{compName || tr({ zh: '非官方', en: 'Unofficial' })}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
