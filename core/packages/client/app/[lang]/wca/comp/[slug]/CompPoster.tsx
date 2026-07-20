'use client';

// 9:16 竖版比赛分享图(issue #22):比赛日期 / 城市 / 报名 / 上限 / 项目及轮次 / 赛程
// (只含轮次,不含签到 / 午餐 / 颁奖)+ 页面链接,固定 540×960 逻辑像素,toPng ×2 导出
// 1080×1920。作为赛程 tab 的 layout=poster 直接渲染在页面上(原弹窗形态已移除),
// 窄屏按容器宽等比缩放预览,导出节点本身不带 transform;右上角悬浮下载按钮。
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Spinner } from '@/components/Spinner/Spinner';
import { toBlob } from 'html-to-image';
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
import { encode as encodeQr } from 'uqr';
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

// 右下角二维码:uqr 编码出模块矩阵,渲成单 <path> SVG。二维码要保证可扫,
// 固定真黑白、不随主题/配色 token 走(海报深浅底都压白底卡)。
function QrSvg({ text, className }: { text: string; className?: string }) {
  const { size, data } = useMemo(() => encodeQr(text, { border: 1, ecc: 'M' }), [text]);
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y]![x]) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return (
    <svg className={className} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" aria-hidden>
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
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

  // 赛程主体:只保留轮次活动(过滤签到 / 午餐 / 颁奖等无项目归属的活动)。
  // 同一轮次被拆成多组/多舞台(多个同时段 top-level activity)时合并成一行取
  // 最早开始/最晚结束 —— 海报只报轮次不报分组(issue #33);不同时段的同轮次
  // (如上下午两波)仍分行。key = activityCode 去掉分组段(-gN),attempt 段保留。
  const days = useMemo(() => {
    if (!data) return [];
    const dedupKey = (code: string) => code.split('-').filter(s => !/^g\d+$/.test(s)).join('-');
    return computeDayColumns(data, tz).days
      .map(d => {
        const acts = d.activities
          .filter(a => eventOfActivity(a) !== '')
          .sort((a, b) => a.startMin - b.startMin || a.roomName.localeCompare(b.roomName));
        const merged: typeof acts = [];
        const lastByKey = new Map<string, (typeof acts)[number]>();
        for (const a of acts) {
          const k = dedupKey(a.activityCode);
          const prev = lastByKey.get(k);
          if (prev && a.startMin < prev.endMin) { // 时段重叠 = 同轮次的并行分组/舞台
            prev.endMin = Math.max(prev.endMin, a.endMin);
            if (a.endTime > prev.endTime) prev.endTime = a.endTime;
            continue;
          }
          const copy = { ...a };
          merged.push(copy);
          lastByKey.set(k, copy);
        }
        return { dateKey: d.dateKey, activities: merged };
      })
      .filter(d => d.activities.length > 0);
  }, [data, tz]);

  // 多栏(issue #33):常规最多 2 栏;仅 5-6 天的比赛放宽到 3 栏。
  // ≥2 天 = 一天一栏的对齐网格(grid,行优先自动换行 —— 超出栏数的天
  // 折回前排下方:2 栏时第 3/4 天在第 1/2 天下,3 栏时第 4/5/6 天在第 1/2/3 天下);
  // 单日比赛按行数 1-2 栏连续分栏,避免右侧大面积留白。
  // 字号不分档,由下面的 fit 连续缩放铺满版面。
  const totalRows = days.reduce((n, d) => n + d.activities.length, 0) + days.length;
  const dayGrid = days.length >= 2;
  const schedCols = dayGrid
    ? (days.length >= 5 ? 3 : Math.min(days.length, 2))
    : totalRows <= 8 ? 1 : 2;

  // 铺满版面:海报内字号/间距全部 em(基准 14px),渲染后实测内容高度,把基准字号
  // 乘上 (可用高 / 实际用高) 迭代逼近——内容刚好填满 960px 且不溢出(余量 ≤4% 收敛)。
  // 多栏后行宽是第二道约束(issue #33):轮次标签被省略号截断时,只把赛程区自己的
  // 字号(schedFit,em 叠乘)按实测溢出比例压回栏宽内 —— 标题/信息区不受行宽牵连,
  // 仍由 fit 按高度放大铺满。换行/分栏是非线性的,第 10 轮停手,"不溢出"优先。
  const mainRef = useRef<HTMLDivElement>(null);
  const daysRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [schedFit, setSchedFit] = useState(1);
  const fitIter = useRef(0);
  useLayoutEffect(() => { fitIter.current = 0; setFit(1); setSchedFit(1); }, [data, isZh, info]);
  useLayoutEffect(() => {
    if (loading || days.length === 0) return;
    const main = mainRef.current;
    const daysEl = daysRef.current;
    if (!main || !daysEl) return;
    if (fitIter.current >= 12) return;
    // 行宽:行内容全部 flex:none 不收缩(轮次标签必须显示全,禁省略号),
    // 溢出栏宽时 row.scrollWidth > clientWidth,按最大溢出比例一次性把 schedFit 压回去
    let widthFactor = 1;
    for (const row of Array.from(daysEl.querySelectorAll<HTMLElement>('.comp-poster-row'))) {
      if (row.clientWidth > 0) widthFactor = Math.max(widthFactor, row.scrollWidth / row.clientWidth);
    }
    if (widthFactor > 1.01) {
      fitIter.current += 1;
      setSchedFit(s => Math.max(0.4, s / (widthFactor * 1.03)));
      return;
    }
    // offsetTop/offsetHeight 是布局值,不受预览 transform: scale 影响
    const avail = main.clientHeight;
    const used = daysEl.offsetTop + daysEl.offsetHeight - main.offsetTop;
    if (avail <= 0 || used <= 0) return;
    const ratio = avail / used;
    if (ratio >= 1 && ratio <= 1.04) return;
    fitIter.current += 1;
    setFit(f => Math.min(2, Math.max(0.55, f * ratio)));
  }, [fit, schedFit, loading, days, isZh]);

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
      const blob = await toBlob(node, { pixelRatio: 2 });
      if (!blob) throw new Error('toBlob returned null');
      let fileLang = 'en';
      if (isZh) fileLang = 'zh';
      const fileName = `${slug}-poster-${fileLang}.png`;
      // iOS Safari 对 data:/blob: 的 <a download> 落地不可靠(弹 View/Download 后无文件,
      // issue #33)—— 触屏设备优先走系统分享单(可直接存入相册);用户取消不算失败。
      if (typeof navigator.canShare === 'function' && window.matchMedia('(pointer: coarse)').matches) {
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file] });
            setDownloadState('idle');
            return;
          } catch (e) {
            if ((e as DOMException).name === 'AbortError') { setDownloadState('idle'); return; }
            // 分享不可用(NotAllowedError 等)→ 回落 blob URL 下载
          }
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
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
          <div ref={posterRef} className="comp-poster" style={{ fontSize: `${(14 * fit).toFixed(2)}px` }}>
            <div className="comp-poster-main" ref={mainRef}>
              <header className="comp-poster-head">
                <div className="comp-poster-name">
                  {compIso2 && <Flag iso2={compIso2} className="comp-flag comp-poster-flag" />}
                  <span>{compName}</span>
                </div>
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
                  {info?.city && (
                    <div className="comp-poster-fact">
                      <dt>{tr({ zh: '城市', en: 'City' })}</dt>
                      <dd>{localizeCity(info.city, isZh, info.country_iso2)}</dd>
                    </div>
                  )}
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
                  <div className="comp-poster-empty"><Spinner size={18} label={tr({ zh: '加载赛程…', en: 'Loading schedule…' })} /></div>
                ) : days.length === 0 ? (
                  <div className="comp-poster-empty">{tr({ zh: '暂无赛程', en: 'No schedule available' })}</div>
                ) : (
                  <div
                    className={`comp-poster-days${dayGrid ? ' comp-poster-days--grid' : ''}`}
                    ref={daysRef}
                    style={{
                      ...(dayGrid
                        ? { gridTemplateColumns: `repeat(${schedCols}, minmax(0, 1fr))` }
                        : schedCols > 1 ? { columnCount: schedCols } : null),
                      ...(schedFit !== 1 ? { fontSize: `${schedFit.toFixed(3)}em` } : null),
                    }}
                  >
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

            <footer className="comp-poster-foot">
              <span>{url}</span>
              <QrSvg text={`https://${url}`} className="comp-poster-qr" />
            </footer>
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
