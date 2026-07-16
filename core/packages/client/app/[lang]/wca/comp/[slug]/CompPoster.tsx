'use client';

// 9:16 竖版比赛分享图(issue #22):比赛日期 / 城市 / 报名 / 上限 / 项目及轮次 / 赛程
// (只含轮次,不含签到 / 午餐 / 颁奖)+ 页面链接,固定 540×960 逻辑像素,toPng ×2 导出
// 1080×1920。作为赛程 tab 的 layout=poster 直接渲染在页面上(原弹窗形态已移除),
// 窄屏按容器宽等比缩放预览,导出节点本身不带 transform;右上角悬浮下载按钮。
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { EventIcon } from '@/components/EventIcon';
import { Flag } from '@/components/Flag';
import { tr } from '@/i18n/tr';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { formatDateRangeIso, toIsoDate, weekdayRangeLabel } from '@/lib/wca-date';
import {
  fetchCompSchedule, computeDayColumns, localizeActivityName, eventOfActivity,
  dayHeaderLabel, roundIdOf, getRoundTypeId, roundTypeShort,
  type ScheduleData,
} from '@/lib/comp-schedule';
import { eventDisplayName } from '@/lib/wca-events';
import { localizeCity } from '@/lib/city-localize';
import type { CompInfo } from '@/lib/comp-wcif';

const POSTER_W = 540;
const POSTER_H = 960;

// 海报赛程行已有项目图标,轮次用 /wca/persons 同款紧凑记号 R1/R2/R3/Fi(中英同一套,
// 组合制并入同名);FM/多盲的 attempt 后缀显示为 "#N"。非轮次活动回退完整本地化名。
function posterActivityName(
  a: Parameters<typeof localizeActivityName>[0],
  rounds: Parameters<typeof localizeActivityName>[1],
  isZh: boolean,
): string {
  const round = rounds[roundIdOf(a.activityCode)];
  if (!round) return localizeActivityName(a, rounds, isZh, () => '').trim();
  const rtId = getRoundTypeId(round.roundNumber, round.totalRounds, !!round.cutoff);
  const attempt = /-a(\d+)$/.exec(a.activityCode)?.[1];
  return `${roundTypeShort(rtId, isZh)}${attempt ? ` #${attempt}` : ''}`;
}

interface CompPosterProps {
  slug: string;
  compName: string;
  /** 比赛所在国家 iso2(小写) */
  compIso2: string;
  info: CompInfo | null;
  isZh: boolean;
}

export default function CompPoster({ slug, compName, compIso2, info, isZh }: CompPosterProps) {
  const posterRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadState, setDownloadState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let cancel = false;
    fetchCompSchedule(slug)
      .then(d => { if (!cancel) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [slug]);

  // 页内缩放:容器宽 ≥540 时 1:1,窄屏等比缩小(导出用未缩放节点,不受影响)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.min(1, w / POSTER_W));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
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

  // 行数多切双栏;字号不再分档,由下面的 fit 连续缩放铺满版面
  const totalRows = days.reduce((n, d) => n + d.activities.length, 0) + days.length;
  const twoCol = totalRows > 26 ? ' comp-poster--2col' : '';

  // 铺满版面:海报内字号/间距全部 em(基准 14px),渲染后实测内容高度,把基准字号
  // 乘上 (可用高 / 实际用高) 迭代逼近——内容刚好填满 960px 且不溢出(余量 ≤4% 收敛)。
  // 换行/分栏是非线性的,收敛不了就在第 6 轮停手,保持"不溢出"优先。
  const mainRef = useRef<HTMLDivElement>(null);
  const daysRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const fitIter = useRef(0);
  useLayoutEffect(() => { fitIter.current = 0; setFit(1); }, [data, isZh, info]);
  useLayoutEffect(() => {
    if (loading || days.length === 0) return;
    const main = mainRef.current;
    const daysEl = daysRef.current;
    if (!main || !daysEl) return;
    if (fitIter.current >= 6) return;
    // offsetTop/offsetHeight 是布局值,不受预览 transform: scale 影响
    const avail = main.clientHeight;
    const used = daysEl.offsetTop + daysEl.offsetHeight - main.offsetTop;
    if (avail <= 0 || used <= 0) return;
    const ratio = avail / used;
    if (ratio >= 1 && ratio <= 1.04) return;
    fitIter.current += 1;
    setFit(f => Math.min(2, Math.max(0.55, f * ratio)));
  }, [fit, loading, days, isZh]);

  const t24 = (iso: string) => new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));

  const dateStr = info?.start_date ? formatDateRangeIso(info.start_date, info.end_date) : '';
  const dateWd = info?.start_date ? weekdayRangeLabel(info.start_date, info.end_date, isZh) : '';
  // 报名窗口已过(比赛已结束/临近)就不占版面,与信息面板同口径
  const regOpenIso = info?.registration_open ? toIsoDate(new Date(info.registration_open)) : '';
  const regCloseIso = info?.registration_close ? toIsoDate(new Date(info.registration_close)) : '';
  const regPast = !!regCloseIso && regCloseIso < toIsoDate(new Date());
  const regStr = regOpenIso && regCloseIso && !regPast ? formatDateRangeIso(regOpenIso, regCloseIso) : '';
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
    <div className="comp-poster-inline" ref={wrapRef}>
      <div className="comp-poster-frame" style={{ width: POSTER_W * scale, height: POSTER_H * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <div ref={posterRef} className={`comp-poster${twoCol}`} style={{ fontSize: `${(14 * fit).toFixed(2)}px` }}>
            <div className="comp-poster-main" ref={mainRef}>
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
                  {info?.city && (
                    <div className="comp-poster-fact">
                      <dt>{tr({ zh: '城市', en: 'City' })}</dt>
                      <dd>{localizeCity(info.city, isZh, info.country_iso2)}</dd>
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
                  <div className="comp-poster-days" ref={daysRef}>
                    {days.map(d => (
                      <section key={d.dateKey} className="comp-poster-day">
                        <h4 className="comp-poster-day-h">{dayHeaderLabel(d.dateKey, tz, isZh)}</h4>
                        {d.activities.map(a => (
                          <div key={a.id} className="comp-poster-row">
                            <span className="comp-poster-row-time">{t24(a.startTime)}-{t24(a.endTime)}</span>
                            <EventIcon event={eventOfActivity(a)} className="comp-poster-row-icon" />
                            <span className="comp-poster-row-name">
                              {posterActivityName(a, data!.rounds, isZh)}
                            </span>
                          </div>
                        ))}
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <footer className="comp-poster-foot">{url}</footer>
          </div>
        </div>
        <div className="comp-poster-actions">
          <button
            type="button"
            className="comp-poster-action-btn"
            onClick={handleDownload}
            disabled={downloadState === 'busy' || loading}
            title={tr({ zh: '下载为图片', en: 'Download as image' })}
            aria-label={tr({ zh: '下载为图片', en: 'Download as image' })}
          >
            <Download size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
