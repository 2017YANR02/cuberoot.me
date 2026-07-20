'use client';

// 「动态分布」可视化 —— 选手页「成绩 → 按项目」的子 tab。原 /wca/viz 整页移植进来后
// 该独立路由已退役,此处为唯一入口。引擎 / store / 子组件全在 components/distribution-viz/。
//   · 项目固定由 props.eventId 驱动(无下拉,避免和上方项目图标条语义重复)
//   · 默认加载 props.wcaId 这位选手;切人 / 切项目自动重载
//   · 仍保留「搜索选手」叠加对比、模式切换、播放、脊线、统计、CSV
//   · 明暗主题:chrome 走 viz.css 的 --ink-rgb,canvas 走 theme-sync.ts 同步翻

import { useState, useEffect, useCallback } from 'react';
import { WcaPersonPicker } from '@cuberoot/shared';
import { Download } from 'lucide-react';
import { Spinner } from '@/components/Spinner/Spinner';
import { useVizStore } from './_stores/viz_store';
import { download as downloadCsv } from './_engine/csv_export';
import { playerHSL } from './_engine/data_fetch';
import VizCanvas from './_components/VizCanvas';
import type { StatsCallback, RidgeHighlightCallback } from './_components/VizCanvas';
import StatsBar from './_components/StatsBar';
import PlayControls from './_components/PlayControls';
import ModeSelector from './_components/ModeSelector';
import PlayerChips from './_components/PlayerChips';
import LegendPanel from './_components/LegendPanel';
import RidgelineCanvas from './_components/RidgelineCanvas';
import { loadFlagData, flagDataVersion } from '@/lib/country-flags';
import { tr } from '@/i18n/tr';
import './viz.css';

interface Props {
  /** 主选手(选手页当前 person) */
  wcaId: string;
  /** 当前项目(选手页由上方项目图标条驱动,无内部下拉) */
  eventId: string;
}

export default function DistributionViz({ wcaId, eventId }: Props) {
  const players = useVizStore(s => s.players);
  const currentEventId = useVizStore(s => s.currentEventId);
  const addPlayer = useVizStore(s => s.addPlayer);
  const loadSingle = useVizStore(s => s.loadSingle);
  const reloadAllPlayers = useVizStore(s => s.reloadAllPlayers);

  const [loading, setLoading] = useState(false);
  const [ridgeHighlight, setRidgeHighlight] = useState(-1);

  // country_flags.json 异步加载;ready 后触发重渲染让 chip 拿到 iso2
  const [flagVer, setFlagVer] = useState(0);
  useEffect(() => {
    setFlagVer(flagDataVersion());
    loadFlagData().then(v => setFlagVer(prev => (v !== prev ? v : prev)));
  }, []);
  void flagVer;

  // 统计面板数据(VizCanvas 每帧回调)
  const [stats, setStats] = useState({
    mean: '--', std: '--', syncLabel: '把数', syncValue: '--',
    compName: '--', delta: 0, improved: false, regressed: false,
  });
  const onStats: StatsCallback = useCallback((s) => setStats(s), []);
  const onRidgeHighlight: RidgeHighlightCallback = useCallback((idx) => setRidgeHighlight(idx), []);

  // 进入 tab / 切人 / 切项目:把当前 person 设为主选手并在当前项目加载。
  //   · 主选手不是本人(首次进入 / 换了选手) → loadSingle 重置为仅本人
  //   · 主选手是本人但项目变了(上方图标条切项目) → reloadAllPlayers 按新项目重载(保留对比集)
  useEffect(() => {
    const st = useVizStore.getState();
    const primaryIsPerson = st.players[0]?.wcaId === wcaId;
    if (!primaryIsPerson) {
      setLoading(true);
      loadSingle(wcaId, eventId).finally(() => setLoading(false));
    } else if (st.currentEventId !== eventId) {
      setLoading(true);
      reloadAllPlayers(eventId).finally(() => setLoading(false));
    }
  }, [wcaId, eventId, loadSingle, reloadAllPlayers]);

  // 搜索叠加对比选手(在当前项目加载)
  const handlePersonSelect = useCallback(async (person: { wcaId?: string } | null) => {
    if (!person?.wcaId) return;
    setLoading(true);
    try {
      await addPlayer(person.wcaId, useVizStore.getState().currentEventId);
    } finally {
      setLoading(false);
    }
  }, [addPlayer]);

  // CSV 下载(多选手时弹选择菜单)
  const [csvMenuOpen, setCsvMenuOpen] = useState(false);
  const handleCsvDownload = useCallback(() => {
    if (players.length === 0) return;
    if (players.length === 1) {
      const p = players[0];
      downloadCsv({
        wcaId: p.wcaId, eventId: currentEventId,
        solveEntries: p.solveEntries, stats: p.statsData, roundMetrics: p.roundMetrics,
      });
    } else {
      setCsvMenuOpen(v => !v);
    }
  }, [players, currentEventId]);

  const downloadForPlayer = useCallback((idx: number) => {
    const p = players[idx];
    if (!p) return;
    downloadCsv({
      wcaId: p.wcaId, eventId: currentEventId,
      solveEntries: p.solveEntries, stats: p.statsData, roundMetrics: p.roundMetrics,
    });
    setCsvMenuOpen(false);
  }, [players, currentEventId]);

  return (
    <div className="viz-page wp-distviz">
      {/* 工具栏:搜索叠加对比 + chips + 模式 + CSV */}
      <div className="toolbar">
        <div className="toolbar-search">
          <WcaPersonPicker
            mode="inline"
            placeholder={tr({ zh: '叠加对比选手...', en: 'Add cuber to compare...' })}
            onSelect={handlePersonSelect}
          />
        </div>
        <PlayerChips />
        <div style={{ position: 'relative' }}>
          <button className="toolbar-btn toolbar-btn-icon" title={tr({ zh: '下载 CSV', en: 'Download CSV' })} aria-label={tr({ zh: '下载 CSV', en: 'Download CSV' })} onClick={handleCsvDownload}>
            <Download size={16} strokeWidth={1.75} />
          </button>
          {csvMenuOpen && players.length > 1 && (
            <div className="csv-player-menu">
              {players.map((p, i) => (
                <button key={p.wcaId} type="button" className="csv-menu-item" onClick={() => downloadForPlayer(i)}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: playerHSL(i), marginRight: 6 }} />
                  {p.nameZh || p.name} ({p.wcaId})
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ModeSelector />

      {/* 主可视化区域 */}
      <main className="viz-main">
        <div style={{ position: 'relative' }}>
          <VizCanvas onStats={onStats} onRidgeHighlight={onRidgeHighlight} />
          <LegendPanel />
        </div>

        <StatsBar {...stats} />
        <PlayControls />

        <div className="shortcuts-hint">
          <kbd>Space</kbd> {tr({ zh: '播放/暂停', en: 'Play/Pause' })}&nbsp;
          <kbd>←</kbd><kbd>→</kbd> {tr({ zh: '步进', en: 'Step' })}&nbsp;
          <kbd>Shift</kbd>+<kbd>←</kbd><kbd>→</kbd> {tr({ zh: '快进', en: 'Fast-forward' })}
        </div>

        <RidgelineCanvas highlightSolveIdx={ridgeHighlight} />
      </main>

      {loading && (
        <div className="loading-overlay">
          <Spinner size={40} className="loading-spinner" />
          <div className="loading-text">Loading...</div>
        </div>
      )}
    </div>
  );
}
