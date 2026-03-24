/**
 * BattlePage — 对战计时器主页面
 * 1:1 翻译自 battle/index.html + battle.js init()
 *
 * NOTE: 核心组件结构：
 * - Player Area (上方, rotated 180°) — 1v1 模式时显示
 * - Middle Bar（比分 + 设置/全屏/历史按钮）
 * - Player Area (下方)
 * - Bottom Nav（Solo 模式 tab 导航）
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useBattleStore } from './engine/battle_store';
import { KEY_MAP, PUZZLES, PENALTY, I18N_TEXT } from './engine/constants';
import { formatTime } from './engine/format_time';
import { computeAo5 } from './engine/stats';
import type { PenaltyType } from './engine/constants';
import HistoryPanel from './HistoryPanel';
import { MilestoneToast } from './AdvancedFeatures';

import './battle.css';

// NOTE: 加载 scramble_module.js 全局脚本（打乱引擎）
// scramble_module.js 是 csTimer 打包代码，依赖 jQuery 子集 + kernel 配色
function useScrambleScript() {
  useEffect(() => {
    if (typeof window.scrMgr !== 'undefined') return;

    // NOTE: 1:1 翻译自 battle/index.html 行 308~328
    // scramble_module.js 内部使用 jQuery 的 $.isArray / $.now / $.noop / $.map / $.fn 等
    // 提供最小 shim 而非引入完整 jQuery（原版方案）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.$) {
      const jqShim: Record<string, unknown> = {
        isArray: Array.isArray,
        now: Date.now,
        noop: () => {},
        map: (arr: unknown[], fn: (item: unknown, i: number) => unknown) =>
          Array.prototype.map.call(arr, fn),
        fn: {},
      };
      w.$ = jqShim;
    }
    // NOTE: kernel.getProp 为 image.js 提供 WCA 标准配色（默认值），不读取 localStorage
    if (!w.kernel) {
      w.kernel = {
        getProp: (key: string): string | null => {
          const defaults: Record<string, string> = {
            'colcube': '#ff0#fa0#00f#fff#f00#0d0',
            'colclk': '#f00#37b#5cf#ff0#850',
            'colsq1': '#ff0#f80#0f0#fff#f00#00f',
            'colpyr': '#0f0#f00#00f#ff0',
            'colskb': '#ff0#fa0#00f#fff#f00#0d0',
            'colmgm': '#fff#d00#060#81f#fc0#00b#ffb#8df#f83#7e0#f9f#999',
            'colfto': '#fff#808#0d0#f00#00f#bbb#ff0#fa0',
            'colico': '#fff#084#b36#a85#088#811#e71#b9b#05a#ed1#888#6a3#e8b#a52#6cb#c10#fa0#536#49c#ec9',
            'col15p': '#f00#fa0#ff0#0d0#00f#fff#888#000',
            'col-font': '#fff',
            'col-board': '#000',
          };
          return defaults[key] !== undefined ? defaults[key] : null;
        },
      };
    }

    const script = document.createElement('script');
    script.src = '/app/scramble_module.js';
    script.async = true;
    document.head.appendChild(script);


    return () => {
      // NOTE: 不移除 script — 加载后全局持久化
    };
  }, []);
}

// NOTE: 键盘控制 hook — 1:1 翻译自 battle.js handleKeyDown/handleKeyUp（行 755~783）
function useKeyboardControls() {
  const keyPressedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const store = useBattleStore.getState();

      // NOTE: 设置面板打开时不响应键盘
      // (由 React 状态控制，无需 DOM 检查)

      const playerId = KEY_MAP[e.key];
      if (playerId === undefined) return;

      if (store.mode === 'solo' && playerId !== 0) return;

      e.preventDefault();

      if (keyPressedRef.current[e.key]) return;
      keyPressedRef.current[e.key] = true;

      store.playerDown(playerId);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const playerId = KEY_MAP[e.key];
      if (playerId === undefined) return;

      e.preventDefault();
      keyPressedRef.current[e.key] = false;

      useBattleStore.getState().playerUp(playerId);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
}

// NOTE: 计时器动画 hook — 通过 RAF 直接写 DOM（不走 React state）
// 1:1 翻译自 battle.js startTimerAnimation()（行 918~934）
function useTimerAnimation(playerId: number, timeRef: React.RefObject<HTMLDivElement | null>) {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = useBattleStore.subscribe((state) => {
      const p = state.players[playerId];
      if (p.isTiming && !rafRef.current) {
        // 开始 RAF 循环
        const tick = () => {
          const curr = useBattleStore.getState();
          const cp = curr.players[playerId];
          if (!cp.isTiming) {
            rafRef.current = null;
            return;
          }
          const elapsed = performance.now() - cp.startTime;
          if (timeRef.current) {
            const timeStr = curr.showTime ? formatTime(elapsed, curr.timerPrecision) : '⏱️';
            timeRef.current.innerHTML = timeStr;
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } else if (!p.isTiming && rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    });

    return () => {
      unsubscribe();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [playerId, timeRef]);
}

// NOTE: WCA Inspection 倒计时显示 — 通过 subscribe 直接写 DOM
function useInspectionDisplay(playerId: number, timeRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const unsubscribe = useBattleStore.subscribe((state) => {
      const p = state.players[playerId];
      if (p.isInspecting && timeRef.current) {
        const elapsed = (performance.now() - p.inspectionStart) / 1000;
        const limit = state.inspectionTime;
        if (limit < 9999) {
          if (elapsed >= limit + 2) {
            timeRef.current.textContent = 'DNF';
          } else if (elapsed >= limit) {
            timeRef.current.textContent = '+2';
          } else {
            timeRef.current.textContent = Math.floor(elapsed).toString();
          }
        } else {
          timeRef.current.textContent = Math.floor(elapsed).toString();
        }
      }
    });
    return () => unsubscribe();
  }, [playerId, timeRef]);
}

// ===== PenaltyDropdown 组件 =====
// 1:1 翻译自 battle/index.html penalty-dropdown 结构

function PenaltyDropdown({ playerId }: { playerId: number }) {
  const player = useBattleStore(s => s.players[playerId]);
  const handlePenalty = useBattleStore(s => s.handlePenalty);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isOpen = useRef(false);

  const enabled = player.hasFinished && !player.isTiming && player.time > 0;

  const toggleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!enabled) return;
    isOpen.current = !isOpen.current;
    dropdownRef.current?.classList.toggle('open', isOpen.current);
  }, [enabled]);

  const selectPenalty = useCallback((penalty: PenaltyType, e: React.MouseEvent) => {
    e.stopPropagation();
    handlePenalty(playerId, penalty);
    isOpen.current = false;
    dropdownRef.current?.classList.remove('open');
  }, [playerId, handlePenalty]);

  // NOTE: 点击外部关闭
  useEffect(() => {
    const handler = () => {
      isOpen.current = false;
      dropdownRef.current?.classList.remove('open');
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <div className="penalty-dropdown" ref={dropdownRef}
      onPointerDown={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
    >
      <button className="penalty-trigger" disabled={!enabled} onClick={toggleOpen}>
        <span className="penalty-label">{player.penalty.toUpperCase()}</span>
        <span className="penalty-arrow">▼</span>
      </button>
      <div className="penalty-menu">
        {([PENALTY.OK, PENALTY.PLUS2, PENALTY.DNF] as PenaltyType[]).map(p => (
          <div
            key={p}
            className={`penalty-option${player.penalty === p ? ' active' : ''}`}
            onClick={(e) => selectPenalty(p, e)}
            onPointerDown={e => e.stopPropagation()}
            onPointerUp={e => e.stopPropagation()}
          >
            {p.toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== TimerArea 组件 =====
// 1:1 翻译自 battle/index.html player-area 结构

function TimerArea({ playerId, rotated }: { playerId: number; rotated?: boolean }) {
  const player = useBattleStore(s => s.players[playerId]);
  const store = useBattleStore();
  const areaRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);

  // NOTE: 高频计时器动画（不走 React re-render）
  useTimerAnimation(playerId, timeRef);
  // NOTE: Inspection 倒计时显示
  useInspectionDisplay(playerId, timeRef);

  // NOTE: pointer 事件处理 — 1:1 翻译自 battle.js handlePointerDown/Up/Cancel
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const curr = useBattleStore.getState();
    const p = curr.players[playerId];
    if (p.pointerId !== null) return;

    // 捕获此 pointer
    areaRef.current?.setPointerCapture(e.pointerId);

    // NOTE: 写入 pointerId — 这个需要直接变异（高频触摸不适合走 immutable set）
    const newPlayers = [...curr.players] as [typeof curr.players[0], typeof curr.players[1]];
    newPlayers[playerId] = { ...p, pointerId: e.pointerId };
    useBattleStore.setState({ players: newPlayers });

    curr.playerDown(playerId);
  }, [playerId]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const curr = useBattleStore.getState();
    const p = curr.players[playerId];
    if (p.pointerId !== e.pointerId) return;

    const newPlayers = [...curr.players] as [typeof curr.players[0], typeof curr.players[1]];
    newPlayers[playerId] = { ...p, pointerId: null };
    useBattleStore.setState({ players: newPlayers });

    curr.playerUp(playerId);
  }, [playerId]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    const curr = useBattleStore.getState();
    const p = curr.players[playerId];
    if (p.pointerId !== e.pointerId) return;

    const newPlayers = [...curr.players] as [typeof curr.players[0], typeof curr.players[1]];
    newPlayers[playerId] = { ...p, pointerId: null };
    useBattleStore.setState({ players: newPlayers });

    curr.playerUp(playerId);
  }, [playerId]);

  // NOTE: 获取区域 CSS 类名
  const areaClasses = [
    'player-area',
    rotated ? 'rotated' : '',
    player.canStart ? 'state-can-start' : '',
    player.isReady && !player.canStart ? 'state-ready' : '',
    player.isTiming ? 'is-timing' : '',
    player.isInspecting ? 'state-inspecting' : '',
  ].filter(Boolean).join(' ');

  // NOTE: 构建时间显示内容（非计时状态时由 React 渲染，计时中由 RAF 渲染）
  const renderTimeContent = () => {
    if (player.isTiming) return ''; // RAF 会接管
    if (player.isInspecting) return ''; // 由 subscription 接管
    if (player.time === 0) return '0.000';
    if (player.penalty === PENALTY.DNF) return 'DNF';

    const displayTime = player.penalty === PENALTY.PLUS2
      ? player.time + 2000
      : player.time;
    const suffix = player.penalty === PENALTY.PLUS2
      ? '<span class="plus-suffix">+</span>'
      : '';
    let html = formatTime(displayTime, store.timerPrecision) + suffix;

    // NOTE: 赢家高亮 + 🏆
    if (store.winner === playerId) {
      html += ' <span class="trophy-icon">🏆</span>';
    }
    return html;
  };

  // NOTE: 时间显示 CSS 类
  const timeClasses = [
    'time-display',
    player.penalty === PENALTY.PLUS2 ? 'penalty-plus2' : '',
    player.penalty === PENALTY.DNF ? 'penalty-dnf' : '',
    store.winner === playerId ? 'winner' : '',
    store.winner === -1 && player.hasFinished ? 'winner' : '',
  ].filter(Boolean).join(' ');

  // NOTE: Ao5 行内容
  const ao5 = computeAo5(player.solveHistory);
  const ao5Text = ao5 === null ? '' : (ao5 === Infinity ? 'ao5: DNF' : 'ao5: ' + formatTime(ao5, store.timerPrecision));

  // NOTE: 打乱文字内容
  const scrambleContent = store.scrambleLoading
    ? `<span class="loading">${I18N_TEXT.generating[store.locale]}</span>`
    : (store.scramble || '');

  return (
    <div
      className={areaClasses}
      ref={areaRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* 打乱文字 */}
      <div
        className={`scramble-text${player.isTiming ? ' hidden' : ''}`}
        dangerouslySetInnerHTML={{ __html: scrambleContent }}
      />

      {/* 计时数字 */}
      <div
        className={timeClasses}
        ref={timeRef}
        dangerouslySetInnerHTML={{ __html: renderTimeContent() }}
      />

      {/* Ao5 统计 */}
      <div
        className="ao5-display"
        dangerouslySetInnerHTML={{ __html: ao5Text }}
      />

      {/* 对手成绩（1v1 模式） */}
      {store.mode === '1v1' && (
        <div className="opponent-display" id={`opponent-${playerId}`} />
      )}

      {/* 罚时下拉 */}
      <PenaltyDropdown playerId={playerId} />

      {/* 打乱图 */}
      <div className={`scramble-img${player.isTiming ? ' hidden' : ''}`}>
        {store.scrambleImageUrl && store.showImage && (
          <img
            src={store.scrambleImageUrl}
            className="scramble-svg-img"
            alt="scramble"
          />
        )}
      </div>
    </div>
  );
}

// ===== MiddleBar 组件 =====
// 1:1 翻译自 battle/index.html middle-bar 结构

function MiddleBar({ onSettingsClick }: { onSettingsClick: () => void }) {
  const store = useBattleStore();
  const { players, mode } = store;

  return (
    <div className="middle-bar">
      {/* Player 2 (左侧, 旋转 180°) 比分 + 罚时 */}
      <div className="score-section">
        <span className="score-value">{players[1].points}</span>
      </div>

      {/* 中间操作按钮 */}
      <div className="middle-actions">
        <button className="middle-btn" title="Settings" onClick={onSettingsClick}>⚙️</button>
        <button className="middle-btn" title="Fullscreen" onClick={() => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen();
          }
        }}>⛶</button>
        {/* NOTE: 历史按钮仅 Solo 模式 */}
        {mode === 'solo' && (
          <button className="middle-btn" title="History" onClick={() => {
            store.switchTab('results');
          }}>📋</button>
        )}
        {/* 键盘提示 */}
        {mode === '1v1' && (
          <span className="key-hint">⌨ P1:Space P2:Enter</span>
        )}
        {mode === 'solo' && (
          <span className="key-hint">⌨ Space</span>
        )}
      </div>

      {/* Player 1 (右侧) 比分 + 罚时 */}
      <div className="score-section">
        <span className="score-value">{players[0].points}</span>
      </div>
    </div>
  );
}

// ===== SettingsPanel 组件 =====
// 1:1 翻译自 battle/index.html settings-panel 结构

function SettingsPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const store = useBattleStore();

  return (
    <div className={`settings-overlay${visible ? ' visible' : ''}`} onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="settings-panel">
        <div className="settings-header-bar">
          <span className="settings-title">⚙️ Settings</span>
          <button className="settings-x-btn" onClick={onClose}>✕</button>
        </div>

        {/* 模式选择 */}
        <div className="settings-group">
          <div className="settings-label" data-i18n="mode">MODE</div>
          <div className="mode-seg">
            <button
              className={`mode-seg-btn${store.mode === 'solo' ? ' active' : ''}`}
              onClick={() => store.setMode('solo')}
            >Solo</button>
            <button
              className={`mode-seg-btn${store.mode === '1v1' ? ' active' : ''}`}
              onClick={() => store.setMode('1v1')}
            >1v1</button>
          </div>
        </div>

        {/* 项目选择 */}
        <div className="settings-group">
          <div className="settings-label" data-i18n="puzzle">PUZZLE</div>
          <div className="puzzle-grid">
            {PUZZLES.map(puz => (
              <button
                key={puz.id}
                className={`puzzle-btn${puz.id === store.puzzleId ? ' active' : ''}`}
                onClick={() => { store.changePuzzle(puz.id); onClose(); }}
              >
                {puz.name[store.locale as 'en' | 'zh'] || puz.name.en}
              </button>
            ))}
          </div>
        </div>

        {/* 计时器精确度 */}
        <div className="settings-group">
          <div className="setting-item">
            <span data-i18n="precision">Precision</span>
            <select
              className="settings-select"
              value={store.timerPrecision}
              onChange={e => store.setTimerPrecision(parseInt(e.target.value))}
            >
              <option value="0">1s</option>
              <option value="1">0.1s</option>
              <option value="2">0.01s</option>
              <option value="3">0.001s</option>
            </select>
          </div>
        </div>

        {/* Inspection */}
        <div className="settings-group solo-setting">
          <div className="setting-item">
            <span data-i18n="inspection">Inspection</span>
            <select
              className="settings-select"
              value={store.inspectionTime}
              onChange={e => store.setInspectionTime(parseInt(e.target.value))}
            >
              <option value="0">OFF</option>
              <option value="8">8s</option>
              <option value="15">15s (WCA)</option>
              <option value="9999">∞</option>
            </select>
          </div>
        </div>

        {/* Voice */}
        <div className="settings-group solo-setting">
          <div className="setting-item">
            <span data-i18n="voice">Voice Alert</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={store.voice}
                onChange={e => store.setVoice(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {/* Show Image */}
        <div className="settings-group">
          <div className="setting-item">
            <span data-i18n="show_image">Show Image</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={store.showImage}
                onChange={e => store.setShowImage(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {/* Scramble Size */}
        <div className="settings-group">
          <div className="setting-item slider-row">
            <span data-i18n="scramble_size">Scramble Size</span>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={store.scrambleScale}
              onChange={e => {
                const val = parseFloat(e.target.value);
                store.setScrambleScale(val);
                document.documentElement.style.setProperty('--scramble-scale', String(val));
              }}
            />
          </div>
        </div>

        {/* Phases */}
        <div className="settings-group solo-setting">
          <div className="setting-item">
            <span data-i18n="phases">Phases</span>
            <select
              className="settings-select"
              value={store.phases}
              onChange={e => store.setPhases(parseInt(e.target.value))}
            >
              <option value="1">1 (Normal)</option>
              <option value="2">2 (BLD)</option>
              <option value="4">4 (CFOP)</option>
            </select>
          </div>
        </div>

        {/* Start Delay */}
        <div className="settings-group">
          <div className="setting-item slider-row">
            <span data-i18n="start_delay">Start Delay</span>
            <span className="delay-value">{(store.startDelay / 1000).toFixed(2)}s</span>
            <input
              type="range"
              min="0"
              max="1000"
              step="50"
              value={store.startDelay}
              onChange={e => store.setStartDelay(parseInt(e.target.value))}
            />
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="settings-group">
          <button className="settings-action-btn" onClick={() => {
            store.toggleShowTime();
            onClose();
          }}>
            {I18N_TEXT[store.showTime ? 'hide_time' : 'show_time'][store.locale]}
          </button>
          <button className="settings-action-btn" onClick={() => {
            store.deleteLast();
            onClose();
          }}>
            🗑️ Delete Last
          </button>
          <button className="settings-action-btn danger" onClick={() => {
            store.resetAll();
            onClose();
          }}>
            🔄 Reset All
          </button>
        </div>

        {/* 返回主页 */}
        <div className="settings-group">
          <a href="/app/" className="settings-action-btn" style={{ display: 'block', textDecoration: 'none' }}>
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}

// ===== 主组件 =====

export default function BattlePage() {
  useScrambleScript();
  useKeyboardControls();

  const store = useBattleStore();
  const { mode } = store;
  const [settingsOpen, setSettingsOpen] = useState(false);
  // NOTE: 里程碑 Toast 消息队列
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // NOTE: 监听 checkMilestone/checkFatigue 派发的自定义事件
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail as string;
      setToastMsg(msg);
    };
    window.addEventListener('battle-milestone', handler);
    return () => window.removeEventListener('battle-milestone', handler);
  }, []);

  // NOTE: 初始化 store — 加载历史 + 生成第一个打乱
  useEffect(() => {
    // NOTE: 等 scramble_module.js 加载完毕再初始化
    const checkAndInit = () => {
      if (typeof window.scrMgr !== 'undefined') {
        useBattleStore.getState().init();
      } else {
        setTimeout(checkAndInit, 100);
      }
    };
    checkAndInit();
  }, []);

  // NOTE: 应用 solo class 到 body（1:1 翻译自 applyMode）
  useEffect(() => {
    document.body.classList.toggle('solo', mode === 'solo');
    return () => {
      document.body.classList.remove('solo');
    };
  }, [mode]);

  // NOTE: 竖屏锁定
  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (screen.orientation as any).lock('portrait').catch(() => {});
    } catch (_) {}
  }, []);

  // NOTE: 设置面板关闭回调
  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    if (mode === 'solo') {
      store.switchTab('timer');
    }
  }, [mode, store]);

  // NOTE: 设置面板打开（1v1 用 state，Solo 用 tab）
  const handleSettingsClick = useCallback(() => {
    if (mode === 'solo') {
      store.switchTab('settings');
    } else {
      setSettingsOpen(true);
    }
  }, [mode, store]);

  return (
    <div className="battle-container">
      {/* 返回按钮 */}
      <a href="/app/" className="back-btn">←</a>

      {/* Player 2 (上方, rotated) — 1v1 模式 */}
      {mode === '1v1' && (
        <TimerArea playerId={1} rotated />
      )}

      {/* 中间栏 — 仅 1v1 模式（Solo 模式用底部导航栏代替） */}
      {mode === '1v1' && <MiddleBar onSettingsClick={handleSettingsClick} />}

      {/* Player 1 (下方) */}
      <TimerArea playerId={0} />

      {/* 底部导航栏 — Solo 模式，1:1 翻译自 battle/index.html 行 366~379 */}
      {mode === 'solo' && (
        <nav className="bottom-nav">
          <button
            className={`nav-tab${store.activeTab === 'timer' ? ' active' : ''}`}
            onClick={() => store.switchTab('timer')}
          >
            {/* NOTE: 1:1 翻译自原版 icon_timer.png — 不擅自替换为 SVG */}
            <img src="/app/icon_timer.png" width="22" height="22" alt="Timer" className="nav-tab-icon" />
            <span>Timer</span>
          </button>
          <button
            className={`nav-tab${store.activeTab === 'results' ? ' active' : ''}`}
            onClick={() => store.switchTab('results')}
          >
            {/* NOTE: 列表图标 — 1:1 翻译自原版 SVG */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            <span>Results</span>
          </button>
          <button
            className={`nav-tab${store.activeTab === 'settings' ? ' active' : ''}`}
            onClick={() => store.switchTab('settings')}
          >
            {/* NOTE: 齿轮图标 — 1:1 翻译自原版 SVG */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>Settings</span>
          </button>
        </nav>
      )}

      {/* 设置面板 — 1v1 overlay 模式 */}
      {mode === '1v1' && (
        <SettingsPanel visible={settingsOpen} onClose={closeSettings} />
      )}

      {/* 设置面板 — Solo tab 模式 */}
      {mode === 'solo' && store.activeTab === 'settings' && (
        <SettingsPanel visible={true} onClose={() => store.switchTab('timer')} />
      )}

      {/* 历史面板 — Solo results tab */}
      {mode === 'solo' && store.activeTab === 'results' && (
        <div className="history-overlay visible">
          <HistoryPanel />
        </div>
      )}

      {/* 里程碑 Toast */}
      {toastMsg && (
        <MilestoneToast message={toastMsg} onDone={() => setToastMsg(null)} />
      )}
    </div>
  );
}

