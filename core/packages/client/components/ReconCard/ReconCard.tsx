'use client';

// 复盘卡片(卡片视图单卡)——/recon?view=grid 与首页「今日复盘」共用。
// 整张卡是一个 <a>(AppLink,支持中键新开),故内部名字/比赛只渲染纯文本,禁套 <a>。
// 从 app/[lang]/recon/page.tsx 提取,样式见 ./recon_card.css。
import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { Video } from 'lucide-react';
import type { ReconSolve } from '@cuberoot/shared';
import { getBiliCover, getDouyinCover } from '@/lib/recon-api';
import { formatTime, formatAvg, padReconSingle } from '@/lib/recon-utils';
import { displayCuberName } from '@/lib/cuber-name-display';
import { Flag } from '@/components/Flag';
import { localizeCompName } from '@/lib/comp-localize';
import { RecordBadge } from '@/components/RecordBadge';
import { EventIcon } from '@/components/EventIcon';
import { isWcaEvent, eventDisplayName, toWcaEventId } from '@/lib/wca-events';
import { ScramblePreview2D, eventHasScramblePreview } from '@/components/ScramblePreview2D';
import { tr } from '@/i18n/tr';
import './recon_card.css';

// videoUrl 多行。按语言挑能出封面的视频：中文优先 B 站、英文优先 YouTube；
// 首选平台没有就退而用另一平台（覆盖「只有一个链接直接用」）；两者皆无 → null（回退打乱图）。
// b23.tv 短链不含 BV id、无法取封面，视作无 B 站封面。
function pickReconCover(videoUrl: string | undefined, isZh: boolean): { kind: 'yt' | 'bili' | 'douyin'; id: string } | null {
  if (!videoUrl) return null;
  let yt = '';
  let bili = '';
  let douyin = '';
  for (const u of videoUrl.split('\n').map(s => s.trim()).filter(Boolean)) {
    if (!yt && /youtu\.?be/i.test(u)) {
      const m = u.match(/(?:v=|youtu\.be\/|\/(?:embed|shorts|live|v)\/)([A-Za-z0-9_-]{6,})/);
      if (m) yt = m[1];
    }
    if (!bili) {
      const m = u.match(/(BV[A-Za-z0-9]+)/);
      if (m) bili = m[1];
    }
    // 抖音封面在服务端按完整 URL(短链/长链)解析,故 id 存原始 URL。
    if (!douyin && /douyin\.com/i.test(u)) douyin = u;
  }
  const order: ('yt' | 'bili' | 'douyin')[] = isZh ? ['bili', 'douyin', 'yt'] : ['yt', 'bili', 'douyin'];
  for (const k of order) {
    if (k === 'yt' && yt) return { kind: 'yt', id: yt };
    if (k === 'bili' && bili) return { kind: 'bili', id: bili };
    if (k === 'douyin' && douyin) return { kind: 'douyin', id: douyin };
  }
  return null;
}

// B 站 / 抖音封面需走后端代理（无直链 URL 规律）；模块级缓存按 key 去重，避免同一卡重挂载重复拉取。
const biliCoverCache = new Map<string, Promise<string | null>>();
function loadBiliCover(bvid: string): Promise<string | null> {
  let p = biliCoverCache.get(bvid);
  if (!p) {
    p = getBiliCover(bvid).then(r => r.pic || null).catch(() => null);
    biliCoverCache.set(bvid, p);
  }
  return p;
}

const douyinCoverCache = new Map<string, Promise<string | null>>();
function loadDouyinCover(url: string): Promise<string | null> {
  let p = douyinCoverCache.get(url);
  if (!p) {
    p = getDouyinCover(url).then(r => r.pic || null).catch(() => null);
    douyinCoverCache.set(url, p);
  }
  return p;
}

// 卡片缩略图：有视频→封面图（YouTube 直链 / B 站 / 抖音异步取），否则打乱图，再否则项目图标。
function ReconCardMedia({ solve, isZh }: { solve: ReconSolve; isZh: boolean }) {
  const cover = useMemo(() => pickReconCover(solve.videoUrl, isZh), [solve.videoUrl, isZh]);
  const ytSrc = cover?.kind === 'yt' ? `https://img.youtube.com/vi/${cover.id}/mqdefault.jpg` : null;
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
  const single = padReconSingle(solve.value) || formatTime(solve.rawTime);
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
