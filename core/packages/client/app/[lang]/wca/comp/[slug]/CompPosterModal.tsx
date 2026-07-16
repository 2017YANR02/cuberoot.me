'use client';

// 9:16 竖版比赛分享图(issue #22):比赛日期 / 报名日期 / 项目及轮次 / 赛程(只含轮次,
// 不含签到 / 午餐 / 颁奖)+ 页面链接,固定 540×960 逻辑像素,toPng ×2 导出 1080×1920。
// 预览按视口缩放,导出节点本身不带 transform。
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, X as XIcon, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { EventIcon } from '@/components/EventIcon';
import { Flag } from '@/components/Flag';
import { tr } from '@/i18n/tr';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { formatDateRangeIso, toIsoDate, weekdayRangeLabel } from '@/lib/wca-date';
import {
  fetchCompSchedule, computeDayColumns, localizeActivityName, eventOfActivity,
  dayHeaderLabel, roundIdOf,
  type ScheduleData,
} from '@/lib/comp-schedule';
import { eventDisplayName } from '@/lib/wca-events';
import type { CompInfo } from '@/lib/comp-wcif';

const POSTER_W = 540;
const POSTER_H = 960;

interface CompPosterModalProps {
  slug: string;
  compName: string;
  /** 比赛所在国家 iso2(小写) */
  compIso2: string;
  info: CompInfo | null;
  isZh: boolean;
  onClose: () => void;
}

export default function CompPosterModal({ slug, compName, compIso2, info, isZh, onClose }: CompPosterModalProps) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadState, setDownloadState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    let cancel = false;
    fetchCompSchedule(slug)
      .then(d => { if (!cancel) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [slug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 预览缩放:竖图整体可见,底部留出操作条高度
  useEffect(() => {
    const compute = () => {
      const s = Math.min(
        (window.innerHeight - 120) / POSTER_H,
        (window.innerWidth - 48) / POSTER_W,
        1,
      );
      setScale(Math.max(0.25, s));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  const tz = data?.venues[0]?.timezone ?? 'UTC';

  // 项目 → 轮次数(从赛程活动推导,官方项目按 WCA 顺序排,其余排尾)
  const eventRounds = useMemo(() => {
    const m = new Map<string, Set<string>>();
    if (!data) return m;
    for (const a of data.activities) {
      const ev = eventOfActivity(a);
      if (!ev) continue;
      let s = m.get(ev);
      if (!s) { s = new Set(); m.set(ev, s); }
      s.add(roundIdOf(a.activityCode));
    }
    return m;
  }, [data]);
  const eventIds = useMemo(() => [
    ...ALL_EVENT_IDS.filter(id => eventRounds.has(id)),
    ...[...eventRounds.keys()].filter(id => !ALL_EVENT_IDS.includes(id)).sort(),
  ], [eventRounds]);

  // 赛程主体:只保留轮次活动(过滤签到 / 午餐 / 颁奖等无项目归属的活动)
  const days = useMemo(() => {
    if (!data) return [];
    return computeDayColumns(data, tz).days
      .map(d => ({
        dateKey: d.dateKey,
        activities: d.activities
          .filter(a => eventOfActivity(a) !== '')
          .sort((a, b) => a.startMin - b.startMin || a.roomName.localeCompare(b.roomName)),
      }))
      .filter(d => d.activities.length > 0);
  }, [data, tz]);

  const totalRows = days.reduce((n, d) => n + d.activities.length, 0) + days.length;
  const density = totalRows <= 14 ? ' comp-poster--roomy'
    : totalRows <= 26 ? ''
    : totalRows <= 64 ? ' comp-poster--compact' : ' comp-poster--dense';

  const t24 = (iso: string) => new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));

  const dateStr = info?.start_date ? formatDateRangeIso(info.start_date, info.end_date) : '';
  const dateWd = info?.start_date ? weekdayRangeLabel(info.start_date, info.end_date, isZh) : '';
  const regOpenIso = info?.registration_open ? toIsoDate(new Date(info.registration_open)) : '';
  const regCloseIso = info?.registration_close ? toIsoDate(new Date(info.registration_close)) : '';
  const regStr = regOpenIso && regCloseIso ? formatDateRangeIso(regOpenIso, regCloseIso) : '';
  const url = `cuberoot.me${isZh ? '/zh' : ''}/wca/comp/${slug}`;

  async function handleDownload() {
    const node = posterRef.current;
    if (!node) return;
    setDownloadState('busy');
    try {
      const dataUrl = await toPng(node, { pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${slug}-poster-${isZh ? 'zh' : 'en'}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setDownloadState('idle');
    } catch (e) {
      console.error('[comp poster] failed:', e);
      setDownloadState('error');
      setTimeout(() => setDownloadState('idle'), 2000);
    }
  }

  return (
    <div className="comp-modal-backdrop comp-modal-backdrop-2" onClick={onClose}>
      <div className="comp-poster-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="comp-poster-viewport" style={{ width: POSTER_W * scale, height: POSTER_H * scale }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <div ref={posterRef} className={`comp-poster${density}`}>
              <header className="comp-poster-head">
                <div className="comp-poster-name">
                  {compIso2 && <Flag iso2={compIso2} className="comp-flag comp-poster-flag" />}
                  <span>{compName}</span>
                </div>
                <div className="comp-poster-rule" />
                <dl className="comp-poster-facts">
                  {dateStr && (
                    <div className="comp-poster-fact">
                      <dt>{tr({ zh: '日期', en: 'Date' })}</dt>
                      <dd>{dateStr}{dateWd ? ` ${dateWd}` : ''}</dd>
                    </div>
                  )}
                  {regStr && (
                    <div className="comp-poster-fact">
                      <dt>{tr({ zh: '报名', en: 'Registration' })}</dt>
                      <dd>{regStr}</dd>
                    </div>
                  )}
                  {info?.competitor_limit ? (
                    <div className="comp-poster-fact">
                      <dt>{tr({ zh: '上限', en: 'Limit' })}</dt>
                      <dd>{info.competitor_limit}</dd>
                    </div>
                  ) : null}
                </dl>
              </header>

              {eventIds.length > 0 && (
                <div className="comp-poster-events">
                  {eventIds.map(id => (
                    <span key={id} className="comp-poster-ev" title={eventDisplayName(id, isZh)}>
                      <EventIcon event={id} className="comp-poster-ev-icon" />
                      <span className="comp-poster-ev-n">{eventRounds.get(id)?.size ?? 0}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="comp-poster-sched">
                {loading ? (
                  <div className="comp-poster-empty"><Loader2 size={18} className="is-spinning" /></div>
                ) : days.length === 0 ? (
                  <div className="comp-poster-empty">{tr({ zh: '暂无赛程', en: 'No schedule available' })}</div>
                ) : (
                  <div className="comp-poster-days">
                    {days.map(d => (
                      <section key={d.dateKey} className="comp-poster-day">
                        <h4 className="comp-poster-day-h">{dayHeaderLabel(d.dateKey, tz, isZh)}</h4>
                        {d.activities.map(a => (
                          <div key={a.id} className="comp-poster-row">
                            <span className="comp-poster-row-time">{t24(a.startTime)}-{t24(a.endTime)}</span>
                            <EventIcon event={eventOfActivity(a)} className="comp-poster-row-icon" />
                            <span className="comp-poster-row-name">
                              {localizeActivityName(a, data!.rounds, isZh, eventDisplayName)}
                            </span>
                          </div>
                        ))}
                      </section>
                    ))}
                  </div>
                )}
              </div>

              <footer className="comp-poster-foot">{url}</footer>
            </div>
          </div>
        </div>
        <div className="comp-poster-actions">
          <button
            type="button"
            className="comp-modal-copy-btn"
            onClick={handleDownload}
            disabled={downloadState === 'busy' || loading}
            title={tr({ zh: '下载为图片', en: 'Download as image' })}
          >
            <Download size={14} />
          </button>
          <button type="button" className="comp-modal-close-btn" onClick={onClose}>
            <XIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
