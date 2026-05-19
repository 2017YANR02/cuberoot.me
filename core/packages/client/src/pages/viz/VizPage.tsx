// NOTE: Viz 模块页面入口
// 组装所有子组件：搜索框、项目选择、CSV 下载、Canvas、统计面板、播放控制、脊线图
// 1:1 翻译自 viz/index.html 的 DOM 结构 + viz.js init() 的初始化逻辑

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { WcaPersonPicker } from '@cuberoot/shared';
import { useVizStore } from './stores/viz_store';
import { download as downloadCsv } from './engine/csv_export';
import { playerHSL } from './engine/data_fetch';
import VizCanvas from './components/VizCanvas';
import type { StatsCallback, RidgeHighlightCallback } from './components/VizCanvas';
import StatsBar from './components/StatsBar';
import PlayControls from './components/PlayControls';
import ModeSelector from './components/ModeSelector';
import PlayerChips from './components/PlayerChips';
import LegendPanel from './components/LegendPanel';
import RidgelineCanvas from './components/RidgelineCanvas';
import { Flag } from '../../utils/flag';
import { personFlagIso2, loadFlagData, flagDataVersion } from '../../utils/country_flags';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import './viz.css';

// NOTE: WCA 项目列表
const EVENTS = [
  { id: '333', label: '3×3' },
  { id: '222', label: '2×2' },
  { id: '444', label: '4×4' },
  { id: '555', label: '5×5' },
  { id: '666', label: '6×6' },
  { id: '777', label: '7×7' },
  { id: '333oh', label: '3×3 OH' },
  { id: '333bf', label: '3×3 BLD' },
  { id: 'pyram', label: 'Pyraminx' },
  { id: 'skewb', label: 'Skewb' },
  { id: 'sq1', label: 'Square-1' },
  { id: 'clock', label: 'Clock' },
  { id: 'minx', label: 'Megaminx' },
  { id: '333fm', label: 'FMC' },
  { id: '444bf', label: '4×4 BLD' },
  { id: '555bf', label: '5×5 BLD' },
  { id: '333mbf', label: 'MBLD' },
];

export default function VizPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('成绩分布', 'Distribution');
  const players = useVizStore(s => s.players);
  const currentEventId = useVizStore(s => s.currentEventId);
  const addPlayer = useVizStore(s => s.addPlayer);
  const reloadAllPlayers = useVizStore(s => s.reloadAllPlayers);

  const [loading, setLoading] = useState(false);
  const [ridgeHighlight, setRidgeHighlight] = useState(-1);
  // NOTE: country_flags.json 异步加载；ready 后触发重渲染让 chip / title 拿到 iso2
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    loadFlagData().then(v => { if (v !== flagVer) setFlagVer(v); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 统计面板数据
  const [stats, setStats] = useState({
    mean: '--', std: '--', syncLabel: '把数', syncValue: '--',
    compName: '--', delta: 0, improved: false, regressed: false,
  });

  // NOTE: 统计回调 — VizCanvas 每帧调用
  const onStats: StatsCallback = useCallback((s) => {
    setStats(s);
  }, []);

  // NOTE: 脊线图联动回调
  const onRidgeHighlight: RidgeHighlightCallback = useCallback((idx) => {
    setRidgeHighlight(idx);
  }, []);

  // NOTE: 默认加载（首次挂载）
  useEffect(() => {
    // 只在 players 为空时默认加载
    if (players.length === 0) {
      setLoading(true);
      addPlayer('2023GENG02', '333').finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NOTE: 搜索选手回调
  const handlePersonSelect = useCallback(async (person: { wcaId?: string } | null) => {
    if (!person?.wcaId) return;
    setLoading(true);
    try {
      await addPlayer(person.wcaId, currentEventId);
    } finally {
      setLoading(false);
    }
  }, [addPlayer, currentEventId]);

  // NOTE: 项目切换
  const handleEventChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLoading(true);
    try {
      await reloadAllPlayers(e.target.value);
    } finally {
      setLoading(false);
    }
  }, [reloadAllPlayers]);

  // NOTE: CSV 下载（多选手时弹出选择菜单）
  const [csvMenuOpen, setCsvMenuOpen] = useState(false);
  const handleCsvDownload = useCallback(() => {
    if (players.length === 0) return;
    if (players.length === 1) {
      const p = players[0];
      downloadCsv({
        wcaId: p.wcaId, eventId: currentEventId,
        solveEntries: p.solveEntries, stats: p.statsData,
        roundMetrics: p.roundMetrics,
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
      solveEntries: p.solveEntries, stats: p.statsData,
      roundMetrics: p.roundMetrics,
    });
    setCsvMenuOpen(false);
  }, [players, currentEventId]);

  // NOTE: 标题文本（JSX 形式以便嵌国旗）
  const evLabel = currentEventId === '333' ? '3×3' : currentEventId;
  const noPlayerTitle = isZh ? '分布演变' : 'Distribution Evolution';
  const renderName = (p: typeof players[number]) => {
    const iso2 = personFlagIso2(p.wcaId);
    const name = isZh ? p.nameZh : p.name;
    return (
      <>
        {iso2 && <Flag iso2={iso2} className="viz-title-flag" />}
        {name}
      </>
    );
  };
  let titleNode: React.ReactNode = noPlayerTitle;
  let metaNode: React.ReactNode = '';
  if (players.length === 1) {
    const p = players[0];
    titleNode = (
      <>
        {renderName(p)} {evLabel} {isZh ? '分布演变' : 'Distribution Evolution'}
      </>
    );
    metaNode = `${p.name} · ${p.wcaId} · ${p.solveData.length} solves`;
  } else if (players.length > 1) {
    titleNode = (
      <>
        {players.map((p, i) => (
          <span key={p.wcaId}>
            {i > 0 ? ' vs ' : ''}
            {renderName(p)}
          </span>
        ))}
        {' '}{evLabel} {isZh ? '分布对比' : 'Distribution Comparison'}
      </>
    );
    metaNode = players.map(p => `${p.name}(${p.solveData.length})`).join(' · ');
  }

  return (
    <div className="page viz-page">
      {/* 顶部标题区 */}
      <header className="header">
        <div className="title-block">
          <h1 id="playerName">{titleNode}</h1>
          <div className="subtitle" id="playerMeta">{metaNode}</div>
        </div>
        <ModeSelector />
      </header>

      {/* 搜索栏 + 项目选择器 + CSV 下载 */}
      <div className="toolbar">
        <div className="toolbar-search">
          <WcaPersonPicker
            mode="inline"
            placeholder={isZh ? '搜索选手...' : 'Search cuber...'}
            onSelect={handlePersonSelect}
          />
        </div>
        <PlayerChips />
        <select
          className="toolbar-select"
          value={currentEventId}
          onChange={handleEventChange}
        >
          {EVENTS.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.label}</option>
          ))}
        </select>
        <div style={{ position: 'relative' }}>
          <button className="toolbar-btn" title={isZh ? '下载 CSV' : 'Download CSV'} onClick={handleCsvDownload}>
            📥 CSV
          </button>
          {csvMenuOpen && players.length > 1 && (
            <div className="csv-player-menu">
              {players.map((p, i) => (
                <div key={p.wcaId} className="csv-menu-item" onClick={() => downloadForPlayer(i)}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: playerHSL(i), marginRight: 6 }} />
                  {p.nameZh || p.name} ({p.wcaId})
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 主可视化区域 */}
      <main className="viz-main">
        <div style={{ position: 'relative' }}>
          <VizCanvas onStats={onStats} onRidgeHighlight={onRidgeHighlight} />
          <LegendPanel />
        </div>

        <StatsBar {...stats} />
        <PlayControls />

        <div className="shortcuts-hint">
          <kbd>Space</kbd> {isZh ? '播放/暂停' : 'Play/Pause'}&nbsp;
          <kbd>←</kbd><kbd>→</kbd> {isZh ? '步进' : 'Step'}&nbsp;
          <kbd>Shift</kbd>+<kbd>←</kbd><kbd>→</kbd> {isZh ? '快进' : 'Fast-forward'}
        </div>

        <RidgelineCanvas highlightSolveIdx={ridgeHighlight} />
      </main>

      {/* Loading overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-text">Loading...</div>
        </div>
      )}
    </div>
  );
}
