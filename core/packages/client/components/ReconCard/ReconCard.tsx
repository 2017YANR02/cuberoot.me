'use client';

// 复盘卡片(卡片视图单卡)——/recon?view=grid 与首页「今日复盘」共用。
// 整张卡是一个 <a>(AppLink,支持中键新开),故内部名字/比赛只渲染纯文本,禁套 <a>。
// 从 app/[lang]/recon/page.tsx 提取,样式见 ./recon_card.css。
import { WcaPersonTeamBadge } from '@/components/WcaPersonTeamBadge';
import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { Video, Link2, Lock } from '@app-foundation/icons/lucide';
import type { ReconSolve } from '@cuberoot/shared';
import { getReconScramble } from '@cuberoot/shared/recon-completion';
import { reconCoverCandidates, coverSyncSrc, coverPreviewSrc, loadBiliCover, loadDouyinCover, type CoverRef } from '@/lib/recon-video-cover';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { formatAvg, formatReconSingle } from '@/lib/recon-utils';
import { displayCuberName } from '@/lib/cuber-name-display';
import { CompCell } from '@/components/CompCell/CompCell';
import { Flag } from '@/components/Flag';
import { RecordBadge } from '@/components/RecordBadge';
import { EventIcon } from '@/components/EventIcon';
import { isWcaEvent, eventDisplayName } from '@/lib/wca-events';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import { tr } from '@/i18n/tr';
import { ReconCompletionBadge } from '@/components/recon/ReconCompletionBadge';
import './recon_card.css';

// 卡片媒体区：有视频→封面图（YouTube 直链 / B 站 / 抖音异步取），否则打乱公式，再否则项目图标。
// 首页保留已知视频的媒体区，即使所有封面都失败也不改变卡片高度。
type ReconCardMediaProps = { solve: ReconSolve; isZh: boolean; showScrambleFallback: boolean };
function ReconCardMedia(props: ReconCardMediaProps) {
  return <ReconCardMediaSource key={`${props.isZh}\n${props.solve.videoUrl ?? ''}`} {...props} />;
}

function ReconCardMediaSource({ solve, isZh, showScrambleFallback }: ReconCardMediaProps) {
  const covers = useMemo(() => reconCoverCandidates(solve.videoUrl, isZh), [solve.videoUrl, isZh]);
  const [coverIndex, setCoverIndex] = useState(0);
  const cover = covers[coverIndex] ?? null;
  const ytSrc = cover ? coverSyncSrc(cover) : null;
  const [loaded, setLoaded] = useState<{ cover: CoverRef; src: string } | null>(null);

  useEffect(() => {
    if (cover?.kind !== 'bili' && cover?.kind !== 'douyin') return;
    let alive = true;
    const loader = cover.kind === 'bili' ? loadBiliCover(cover.id) : loadDouyinCover(cover.id);
    void loader.then(pic => {
      if (!alive) return;
      if (pic) setLoaded({ cover, src: pic }); else setCoverIndex(index => index + 1);
    });
    return () => { alive = false; };
  }, [cover]);

  const imgSrc = ytSrc ?? (loaded?.cover === cover ? loaded.src : null);

  if (imgSrc) {
    return (
      <div className="recon-card-media">
        <ProgressiveImage
          className="recon-card-cover"
          src={imgSrc}
          previewSrc={coverPreviewSrc(cover, imgSrc)}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          fallback={<Video size={24} />}
          onError={() => setCoverIndex(coverIndex + 1)}
        />
      </div>
    );
  }

  // A known video owns its media slot before the cover request completes.
  // Keep it on failure too, so sibling cards and everything below never move.
  if (!showScrambleFallback) return covers.length ? (
    <div className="recon-card-media" aria-hidden="true">
      <Video size={24} className="recon-card-media-empty" />
    </div>
  ) : null;

  const scramble = getReconScramble(solve);
  const displayScramble = formatScrambleForEvent(solve.event, scramble);
  const hasVideo = !!solve.videoUrl && solve.videoUrl.trim() !== '';
  return (
    <div className="recon-card-media">
      {displayScramble ? (
        <span className="recon-card-scramble mono" title={displayScramble}>{displayScramble}</span>
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
    </div>
  );
}

export function ReconCard({ solve, isZh, href, horizontal = false, showScrambleFallback = true }: {
  solve: ReconSolve; isZh: boolean; href: string; horizontal?: boolean; showScrambleFallback?: boolean;
}) {
  const cubers = [
    { name: solve.person || '', id: solve.personId, country: solve.personCountry },
    ...(solve.coPersons ?? []).map(c => ({ name: c.name, id: c.id, country: c.country })),
  ].filter(c => c.name);
  const single = formatReconSingle(solve.event, solve.value, solve.rawTime);

  return (
    <Link href={href} prefetch={false} className={`recon-card${horizontal ? ' recon-card--row' : ''}`}>
      <ReconCardMedia solve={solve} isZh={isZh} showScrambleFallback={showScrambleFallback} />
      <div className="recon-card-body">
        {/* 成绩 + 项目图标 + 国旗 + 选手名；宽度不足时姓名换行完整显示。 */}
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
          <ReconCompletionBadge recordType={solve.recordType} status={solve.completionStatus} />
          <span className="recon-card-solver">
            {cubers.map((c, i) => (
              <span key={i}>
                {i > 0 ? <span className="recon-cuber-sep"> &amp; </span> : null}
                {c.country ? <><Flag iso2={c.country} className="recon-inline-flag" />{' '}</> : null}
                {displayCuberName(c.name, isZh)}<WcaPersonTeamBadge wcaId={c.id} />
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
            <span className="recon-card-comp">{solve.comp ? <CompCell compId={solve.compWcaId ?? ''} compName={solve.comp} country={solve.country} isZh={isZh} date={null} /> : tr({ zh: '非官方', en: 'Unofficial' })}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
