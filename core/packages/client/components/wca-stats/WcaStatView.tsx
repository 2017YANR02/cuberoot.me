'use client';

// Shared WCA stat renderer. Ported from packages/client-vite/src/pages/wca_stats/WcaStatsPage.tsx.
// Supports 4 render modes: rows / sections / panels / metricPanels.
// Used by the /wca/[statId] route (WcaStatClient, headerMode='full') AND embedded in
// /wca/results 的「记录·指标」视图(wr_metric, headerMode='note', urlScope='m')。
// NOTE: deferred — hasAbout 链接 (wca_about/registry) 暂未迁移,about 链接不显示。
//   Top10HistoryPage 嵌入(wr_metric ranking 面板 bar chart race)已迁移。
//
// This file is the orchestrator only. The data-shape types, the pure cell/markdown
// render helpers, and the 8 sub-view components live in the sibling
// WcaStatView.{types,cells,views} modules (split out 2026-07 — no behavior change).
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQueryStates, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import WcaEventSelector from '@/components/WcaEventSelector';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { EVENT_NAME_TO_ID, ALL_EVENT_IDS } from '@/lib/event-constants';
import { loadFlagData, flagDataVersion } from '@/lib/country-flags';
import { statsUrl } from '@/lib/stats-base';
import Top10HistoryPage from '@/components/wca-stats/Top10HistoryPage';
import type { Metric as Top10Metric } from '@/lib/top10-axis';
import type { StatData, StatSection, StatPanel, MetricPanel } from './WcaStatView.types';
import { getAllPanelsFromMetric } from './WcaStatView.cells';
import {
  WrByCountryYearView, StatsTable, SectionsView, PanelsView, MetricPanelsView,
} from './WcaStatView.views';
import '../../app/[lang]/wca/_wca_stats.css';
import { tr } from '@/i18n/tr';
import '@/i18n/i18n-client';

interface WcaStatViewProps {
  statId: string;
  /** 'full' = 路由页(.wca-stats-page 暗锁外壳 + h1 + note + 设 document.title);
   *  'note' = 嵌入(渲染 note 段 + 选择器 + 面板,无 h1,不抢 document.title);
   *  'none' = 嵌入且连 note 也不渲染。 */
  headerMode?: 'full' | 'note' | 'none';
  /** nuqs 键前缀:嵌入宿主页时避免与其 URL 状态撞键(/wca/results 传 'm' → mevent/mtype/mmetric)。 */
  urlScope?: string;
  /** 受控指标 id(metricPanels 的 id,如 'bao5')。传了即由宿主页驱动:同步到对应面板 +
   *  隐藏组件内置的指标选择器(/wca/results 把它提升进顶层「类型」下拉,避免重复)。 */
  metricId?: string | null;
  /** 插在「项目选择器」与 note 之间的内容。/wca/results 指标视图把顶层「类型」下拉放这,
   *  实现 项目选择器 在 类型下拉 上方。 */
  afterEventSelector?: React.ReactNode;
}

// useDocumentTitle 必须无条件调用 —— 包成子组件,只在 headerMode='full' 时挂载;
// 嵌入页(如 /wca/results)不挂载它,免得覆盖宿主页自己的标题。
function DocTitle({ zh, en }: { zh: string; en: string }) {
  useDocumentTitle(zh, en);
  return null;
}

export function WcaStatView({ statId, headerMode = 'full', urlScope = '', metricId = null, afterEventSelector = null }: WcaStatViewProps) {
  const { i18n } = useTranslation();
  const [data, setData] = useState<StatData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [activePanel, setActivePanel] = useState(0);
  const [activeMetric, setActiveMetric] = useState(0);

  // nuqs 键前缀:默认无前缀(event/type/metric);嵌入页传 urlScope 改成 <scope>event 等,避免撞键。
  const k = useCallback((s: string) => (urlScope ? `${urlScope}${s}` : s), [urlScope]);

  // ?event= ?type= ?metric=(按 urlScope 前缀)走 nuqs(replace,无历史 — 等价于原 hash replaceState)。
  // 单页内的 事件 / 面板 / 指标 选择,深链可恢复,后退不堆历史。(从 #hash 迁来:旧 # 链接失效可接受)
  // 只用 setter 写 URL;读取在数据加载时直接读 window.location.search(一次性深链,不入 effect deps)。
  const [, setUrlState] = useQueryStates(
    { [k('event')]: parseAsString, [k('type')]: parseAsString, [k('metric')]: parseAsString },
    { history: 'replace', scroll: false },
  );

  const isZh = i18n.language === 'zh';

  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    loadFlagData().then(v => { if (v !== flagVer) setFlagVer(v); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!statId) return;
    setLoading(true);
    setError(null);
    setSelectedEvent('');
    setActivePanel(0);
    setActiveMetric(0);

    fetch(statsUrl(`/stats/${statId}.json`))
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: StatData) => {
        setData(json);
        setLoading(false);
        // 初始深链:从 ?type= / ?metric=(带前缀)还原面板/指标(挂载读一次,直接读 URL 不入 effect deps)
        const sp = new URLSearchParams(window.location.search);
        const typeId = sp.get(k('type'));
        const metricId = sp.get(k('metric'));
        if (typeId) {
          const panels = json.panels ?? json.metricPanels?.[0]?.panels ?? [];
          const idx = panels.findIndex((p: StatPanel) => p.id === typeId);
          if (idx !== -1) setActivePanel(idx);
        }
        if (metricId && json.metricPanels) {
          const idx = json.metricPanels.findIndex((mp: MetricPanel) => mp.id === metricId);
          if (idx !== -1) setActiveMetric(idx);
        }
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [statId, k]);

  // 受控指标:宿主页(/wca/results 顶层「类型」下拉)传 metricId 时,跟随它切换面板,免重挂载/闪烁。
  useEffect(() => {
    if (metricId == null || !data?.metricPanels) return;
    const idx = data.metricPanels.findIndex(mp => mp.id === metricId);
    if (idx !== -1) setActiveMetric(idx);
  }, [metricId, data]);

  const handleSelectEvent = useCallback((ev: string) => {
    setSelectedEvent(ev);
    setUrlState({ [k('event')]: ev || null });
  }, [setUrlState, k]);

  const handleSetActivePanel = useCallback((idx: number, panels: StatPanel[]) => {
    setActivePanel(idx);
    const id = panels[idx]?.id;
    if (id) setUrlState({ [k('type')]: id });
  }, [setUrlState, k]);

  const handleSetActiveMetric = useCallback((idx: number, metricPanels: MetricPanel[]) => {
    setActiveMetric(idx);
    const id = metricPanels[idx]?.id;
    if (id) setUrlState({ [k('metric')]: id });
  }, [setUrlState, k]);

  const renderMode = useMemo(() => {
    if (!data) return 'empty';
    if (data.metricPanels && data.metricPanels.length > 0) return 'metricPanels';
    if (data.panels && data.panels.length > 0) return 'panels';
    if (data.sections && data.sections.length > 0) return 'sections';
    if (data.rows && data.rows.length > 0) return 'rows';
    return 'empty';
  }, [data]);

  const availableEvents = useMemo((): Set<string> => {
    if (!data) return new Set();
    const ids = new Set<string>();
    const extractFromSections = (sections: StatSection[]) => {
      sections.forEach(s => {
        let eventId = EVENT_NAME_TO_ID[s.title];
        if (!eventId && s.title.includes(' - ')) {
          const eventName = s.title.substring(0, s.title.lastIndexOf(' - '));
          eventId = EVENT_NAME_TO_ID[eventName];
        }
        if (eventId) ids.add(eventId);
      });
    };
    if (data.sections) extractFromSections(data.sections);
    if (data.panels) data.panels.forEach(p => extractFromSections(p.sections));
    if (data.metricPanels) {
      data.metricPanels.forEach(mp => {
        const allPanels = getAllPanelsFromMetric(mp);
        allPanels.forEach(p => extractFromSections(p.sections));
      });
    }
    return ids;
  }, [data]);

  useEffect(() => {
    if (availableEvents.size > 0 && !selectedEvent) {
      const urlEvent = new URLSearchParams(window.location.search).get(k('event'));
      const initial = (urlEvent && availableEvents.has(urlEvent))
        ? urlEvent
        : ALL_EVENT_IDS.find((id: string) => availableEvents.has(id));
      if (initial) {
        setSelectedEvent(initial);
        setUrlState({ [k('event')]: initial });
      }
    }
  }, [availableEvents, selectedEvent, setUrlState, k]);

  const showEventSelector = renderMode !== 'rows' && renderMode !== 'empty' && availableEvents.size >= 2;

  // headerMode='full' = 路由页:.wca-stats-page 自带暗锁 + 页面内边距 + h1。
  // 嵌入页(note/none)宿主已是暗锁的 .wse-page,用轻量壳,免重复暗锁/双层内边距。
  const wrapperClass = headerMode === 'full' ? 'wca-stats-page' : 'wca-stats-embedded';
  const docTitle = headerMode === 'full'
    ? <DocTitle zh={data?.titleZh ?? 'WCA 统计'} en={data?.title ?? 'WCA Stats'} />
    : null;

  if (loading) {
    return (
      <div className={wrapperClass}>
        {docTitle}
        <div className="wca-stats-loading">{tr({ zh: '加载中...', en: 'Loading...'
        })}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={wrapperClass}>
        {docTitle}
        <div className="wca-stats-error">
          <h2>{tr({ zh: '加载失败', en: 'Failed to load'
        })}</h2>
          <p>{error || tr({ zh: '未知错误', en: 'Unknown error'
                        })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      {docTitle}
      {headerMode === 'full' && (
        <div className="wca-stats-header">
          <h1>{tr({ zh: data.titleZh, en: data.title })}</h1>
          {data.note && (
            <p className="wca-stats-note">{tr({ zh: data.noteZh ?? data.note, en: data.note })}</p>
          )}
        </div>
      )}
      {/* 项目选择器放最上面;afterEventSelector(/wca/results 的顶层「类型」下拉)紧随其后 → 项目在类型上方 */}
      {showEventSelector && (
        <WcaEventSelector
          availableEvents={availableEvents}
          selectedEvent={selectedEvent}
          onSelect={handleSelectEvent}
          isZh={isZh}
        />
      )}
      {afterEventSelector}
      {headerMode === 'note' && data.note && (
        <p className="wca-stats-note wca-stats-embedded-note">{tr({ zh: data.noteZh ?? data.note, en: data.note })}</p>
      )}

      {renderMode === 'rows' && data.rows && data.years && data.cumulative && (
        <WrByCountryYearView
          header={data.header}
          years={data.years}
          cumulative={data.cumulative}
          searchTerm={searchTerm}
          isZh={isZh}
        />
      )}
      {renderMode === 'rows' && data.rows && !(data.years && data.cumulative) && (
        <StatsTable header={data.header} rows={data.rows} searchTerm={searchTerm} isZh={isZh} />
      )}

      {renderMode === 'sections' && data.sections && (
        <SectionsView
          header={data.header}
          sections={data.sections}
          searchTerm={searchTerm}
          isZh={isZh}
          selectedEvent={showEventSelector ? selectedEvent : undefined}
        />
      )}

      {renderMode === 'panels' && data.panels && (
        <PanelsView
          panels={data.panels}
          searchTerm={searchTerm}
          isZh={isZh}
          selectedEvent={showEventSelector ? selectedEvent : undefined}
          activePanel={activePanel}
          onSetActivePanel={(idx) => handleSetActivePanel(idx, data.panels!)}
        />
      )}

      {renderMode === 'metricPanels' && data.metricPanels && (
        <MetricPanelsView
          metricPanels={data.metricPanels}
          metricGroups={data.metricGroups}
          searchTerm={searchTerm}
          isZh={isZh}
          selectedEvent={showEventSelector ? selectedEvent : undefined}
          hideSelector={metricId != null}
          activeMetric={activeMetric}
          onSetActiveMetric={(idx) => handleSetActiveMetric(idx, data.metricPanels!)}
          onSetActivePanel={(idx, panels) => handleSetActivePanel(idx, panels)}
          activePanel={activePanel}
          belowTabs={(() => {
            // NOTE: wr_metric ranking 面板专属——bar chart race 渲染在 排名/历史 tabs 下方、表格上方
            if (statId !== 'wr_metric' || activePanel !== 0) return null;
            const METRIC_KEY: Record<string, Top10Metric> = {
              single: 'single', average: 'average',
              bao5: 'bao5', wao5: 'wao5', mo5: 'mo5',
              bpa: 'bpa', wpa: 'wpa',
              median: 'median', bestc: 'best_counting', worstc: 'worst_counting',
              worst: 'worst',
            };
            const mp = data.metricPanels?.[activeMetric];
            const m = mp ? METRIC_KEY[mp.id] : undefined;
            if (!m) return null;
            return (
              <Top10HistoryPage
                controlledEventId={selectedEvent || '333'}
                controlledMetric={m}
                controlledMetricLabelZh={mp?.labelZh}
                controlledMetricLabelEn={mp?.labelEn}
              />
            );
          })()}
        />
      )}

      {renderMode === 'empty' && (
        <div className="wca-stats-empty-state">
          <div className="wca-stats-empty-title">
            {tr({ zh: '暂无数据', en: 'No data yet'
            })}
          </div>
          <div className="wca-stats-empty-hint">
            {tr({ zh: '此统计项当前为空 —— 可能是下一次 stats-build 会补全,或该口径下无人达成。', en: 'This stat is currently empty — either no one meets the criteria, or it has yet to be computed.'
            })}
          </div>
        </div>
      )}
    </div>
  );
}
