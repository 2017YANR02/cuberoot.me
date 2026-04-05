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
import VsHistoryPanel from './VsHistoryPanel';
import { MilestoneToast } from './AdvancedFeatures';

import './battle.css';

// NOTE: 根据打乱字符串长度自动计算字号缩放因子
// ≤100 字符（2x2~3x3）= 1.0，更长则 sqrt 曲线平滑缩小，最小 0.7
function getScrambleAutoScale(scramble: string): number {
  if (!scramble) return 1;
  const len = scramble.length;
  if (len <= 100) return 1;
  return Math.max(0.7, Math.sqrt(100 / len));
}

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
    script.src = import.meta.env.BASE_URL + 'scramble_module.js';
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
          const timeStr = curr.showTime ? formatTime(elapsed, curr.timerPrecision) : '⏱️';
          if (timeRef.current) {
            timeRef.current.innerHTML = timeStr;
          }
          // NOTE: 对手已停表时，在对手区域实时显示此玩家还在跑的时间
          // 1:1 翻译自 battle.js startTimerAnimation()（行 928~930）
          if (curr.mode === '1v1') {
            const oppId = 1 - playerId;
            if (curr.players[oppId].hasFinished) {
              const oppEl = document.getElementById(`opponent-${oppId}`);
              if (oppEl) {
                oppEl.innerHTML = '⚔️ ' + timeStr;
              }
            }
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

// NOTE: 对手成绩显示 hook — 在本方区域显示对手的最终成绩
// 1:1 翻译自 battle.js renderOpponent() 调用逻辑（行 616~618, 996~1001）
function useOpponentDisplay(playerId: number) {
  useEffect(() => {
    const unsubscribe = useBattleStore.subscribe((state) => {
      if (state.mode !== '1v1') return;

      const el = document.getElementById(`opponent-${playerId}`);
      if (!el) return;

      const oppId = 1 - playerId;
      const opp = state.players[oppId];

      if (opp.hasFinished && !opp.isTiming) {
        // NOTE: 对手已完成 → 显示对手的最终成绩（含罚时）
        const effTime = opp.penalty === PENALTY.DNF ? Infinity
          : (opp.penalty === PENALTY.PLUS2 ? opp.time + 2000 : opp.time);
        const label = effTime === Infinity ? 'DNF' : formatTime(effTime, state.timerPrecision);
        el.innerHTML = '⚔️ ' + label;
      } else if (!opp.hasFinished && !opp.isTiming) {
        // NOTE: 回合重置 → 清空对手成绩
        el.innerHTML = '';
      }
    });
    return () => unsubscribe();
  }, [playerId]);
}

// ===== PenaltyDropdown 组件 =====
// 1:1 翻译自 battle/index.html penalty-dropdown 结构

function PenaltyDropdown({ playerId }: { playerId: number }) {
  const player = useBattleStore(s => s.players[playerId]);
  const handlePenalty = useBattleStore(s => s.handlePenalty);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isOpen = useRef(false);

  const enabled = player.hasFinished && !player.isTiming && player.time > 0;

  // NOTE: 原生事件阻止冒泡 — 必须用原生而非 React 合成事件
  // 因为父级 TimerArea 现在使用原生 addEventListener，React stopPropagation 无法阻止原生监听器
  useEffect(() => {
    const el = dropdownRef.current;
    if (!el) return;

    const stop = (e: PointerEvent) => {
      e.stopPropagation();
    };

    el.addEventListener('pointerdown', stop);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);

    return () => {
      el.removeEventListener('pointerdown', stop);
      el.removeEventListener('pointerup', stop);
      el.removeEventListener('pointercancel', stop);
    };
  }, []);

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
    <div className="penalty-dropdown" ref={dropdownRef}>
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
  // NOTE: 对手成绩显示（1v1 模式）
  useOpponentDisplay(playerId);

  // NOTE: 原生 pointer 事件处理 — 使用 addEventListener 而非 React 合成事件
  // React 的 onPointerDown 在移动端 Safari/Chrome 上不可靠，原生事件与 legacy 版一致且稳定
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      const curr = useBattleStore.getState();
      const p = curr.players[playerId];
      if (p.pointerId !== null) return;

      el.setPointerCapture(e.pointerId);

      const newPlayers = [...curr.players] as [typeof curr.players[0], typeof curr.players[1]];
      newPlayers[playerId] = { ...p, pointerId: e.pointerId };
      useBattleStore.setState({ players: newPlayers });

      curr.playerDown(playerId);
    };

    const onUp = (e: PointerEvent) => {
      const curr = useBattleStore.getState();
      const p = curr.players[playerId];
      if (p.pointerId !== e.pointerId) return;

      const newPlayers = [...curr.players] as [typeof curr.players[0], typeof curr.players[1]];
      newPlayers[playerId] = { ...p, pointerId: null };
      useBattleStore.setState({ players: newPlayers });

      curr.playerUp(playerId);
    };

    const onCancel = (e: PointerEvent) => {
      const curr = useBattleStore.getState();
      const p = curr.players[playerId];
      if (p.pointerId !== e.pointerId) return;

      const newPlayers = [...curr.players] as [typeof curr.players[0], typeof curr.players[1]];
      newPlayers[playerId] = { ...p, pointerId: null };
      useBattleStore.setState({ players: newPlayers });

      curr.playerUp(playerId);
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
    };
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

  // NOTE: side 布局时打乱在共享区域显示，不在每个 TimerArea 重复
  const hideScramble = store.mode === '1v1' && store.layout === 'side';

  return (
    <div
      className={areaClasses}
      ref={areaRef}
    >
      {/* 打乱文字 — side 布局时隐藏（由共享区域显示） */}
      {!hideScramble && (
        <div
          className={`scramble-text${player.isTiming ? ' hidden' : ''}`}
          style={{ '--scramble-auto': getScrambleAutoScale(store.scramble || '') } as React.CSSProperties}
          dangerouslySetInnerHTML={{ __html: scrambleContent }}
        />
      )}

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

      {/* 对手成绩（仅 versus 布局，side 布局不需要——两人并排能直接看到对方） */}
      {store.mode === '1v1' && store.layout === 'versus' && (
        <div className="opponent-display" id={`opponent-${playerId}`} />
      )}

      {/* 打乱图 — side 布局时隐藏 */}
      {!hideScramble && (
        <div className={`scramble-img${player.isTiming ? ' hidden' : ''}`}>
          {store.scrambleImageUrl && store.showImage && (
            <img
              src={store.scrambleImageUrl}
              className="scramble-svg-img"
              alt="scramble"
            />
          )}
        </div>
      )}
    </div>
  );
}

// ===== MiddleBar 组件 =====
// 1:1 翻译自 battle/index.html middle-bar 结构

function MiddleBar({ onSettingsClick, onHistoryClick }: { onSettingsClick: () => void; onHistoryClick?: () => void }) {
  const store = useBattleStore();
  const { players } = store;
  const p0pts = players[0].points;
  const p1pts = players[1].points;
  const p1Leading = p1pts > p0pts;
  const p0Leading = p0pts > p1pts;

  return (
    <div className="middle-bar">
      {/* Player 2 (左侧, 旋转 180°) 比分 + 罚时 */}
      <div className="score-section">
        <span className="score-value">
          {p1Leading && <span className="score-trophy">🏆</span>}
          {players[1].points}
        </span>
        <PenaltyDropdown playerId={1} />
      </div>

      {/* 中间操作按钮 — 1:1 翻译自 battle/index.html 行 78~89 */}
      <div className="middle-actions">
        {/* NOTE: 桌面端键盘提示 */}
        <span className="key-hint">Enter ↑ · ↓ Space</span>
        {/* NOTE: CubeRoot logo，点击回首页 */}
        <a href="/" className="middle-logo" aria-label="Home">
          <img src={import.meta.env.BASE_URL + 'CubeRoot-dark.png'} alt="CubeRoot" height="24" />
        </a>
        <button className="middle-btn" title="History" onClick={onHistoryClick}>📋</button>
        <button className="middle-btn" title="Settings" onClick={onSettingsClick}>⚙️</button>
      </div>

      {/* Player 1 (右侧) 比分 + 罚时 */}
      <div className="score-section">
        <span className="score-value">
          {players[0].points}
          {p0Leading && <span className="score-trophy">🏆</span>}
        </span>
        <PenaltyDropdown playerId={0} />
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
          <a href="/" className="settings-action-btn" style={{ display: 'block', textDecoration: 'none' }}>
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}

// ===== SharedScramble 组件（Side 布局专用） =====
// NOTE: 在并排模式下，打乱文字在顶部共享显示，打乱图单独放在下方

function SharedScramble() {
  const store = useBattleStore();
  const anyTiming = store.players[0].isTiming || store.players[1].isTiming;

  const scrambleContent = store.scrambleLoading
    ? `<span class="loading">${I18N_TEXT.generating[store.locale]}</span>`
    : (store.scramble || '');

  return (
    <div className={`shared-scramble${anyTiming ? ' hidden' : ''}`}>
      <div
        className="scramble-text"
        style={{ '--scramble-auto': getScrambleAutoScale(store.scramble || '') } as React.CSSProperties}
        dangerouslySetInnerHTML={{ __html: scrambleContent }}
      />
    </div>
  );
}

// NOTE: 打乱图单独组件 — 放在中间栏与计时区域之间
function SharedScrambleImage() {
  const store = useBattleStore();
  const anyTiming = store.players[0].isTiming || store.players[1].isTiming;

  if (!store.scrambleImageUrl || !store.showImage) return null;

  return (
    <div className={`shared-scramble-img${anyTiming ? ' hidden' : ''}`}>
      <img src={store.scrambleImageUrl} className="scramble-svg-img" alt="scramble" />
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
  // NOTE: 1v1 历史面板
  const [vsHistoryOpen, setVsHistoryOpen] = useState(false);
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

  // NOTE: 页面加载时同步 scrambleScale CSS 变量（localStorage 已保存值，但 CSS 变量需要手动初始化）
  useEffect(() => {
    document.documentElement.style.setProperty('--scramble-scale', String(store.scrambleScale));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // NOTE: 自动检测横竖屏 — 横屏自动切 side 布局，竖屏自动切 versus
  useEffect(() => {
    if (mode !== '1v1') return;

    const mql = window.matchMedia('(orientation: landscape)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const s = useBattleStore.getState();
      if (s.mode !== '1v1') return;
      // NOTE: 用户横屏 → side；竖屏 → versus
      s.setLayout(e.matches ? 'side' : 'versus');
    };
    // 初始化时也检查一次
    handleChange(mql);

    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [mode]);

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
    <div className={`battle-container${mode === '1v1' && store.layout === 'side' ? ' side-layout' : ''}`}>


      {/* === Side 布局：共享打乱 + 左右分屏 === */}
      {mode === '1v1' && store.layout === 'side' && (
        <>
          {/* 中间栏 */}
          <MiddleBar onSettingsClick={handleSettingsClick} onHistoryClick={() => setVsHistoryOpen(true)} />
          {/* 打乱文字 */}
          <SharedScramble />
          {/* 左右计时区域（打乱图浮在中心） */}
          <div className="side-players">
            <TimerArea playerId={0} />
            <div className="side-divider" />
            <TimerArea playerId={1} />
            <SharedScrambleImage />
          </div>
        </>
      )}

      {/* === Versus 布局：上下分屏 === */}
      {mode === '1v1' && store.layout === 'versus' && (
        <>
          <TimerArea playerId={1} rotated />
          <MiddleBar onSettingsClick={handleSettingsClick} onHistoryClick={() => setVsHistoryOpen(true)} />
          <TimerArea playerId={0} />
        </>
      )}

      {/* === Solo 模式 === */}
      {mode === 'solo' && (
        <TimerArea playerId={0} />
      )}

      {/* 底部导航栏 — Solo 模式，1:1 翻译自 battle/index.html 行 366~379 */}
      {mode === 'solo' && (
        <nav className="bottom-nav">
          <button
            className={`nav-tab${store.activeTab === 'timer' ? ' active' : ''}`}
            onClick={() => store.switchTab('timer')}
          >
            {/* NOTE: 1:1 翻译自原版 icon_timer.png — 不擅自替换为 SVG */}
            <img src={import.meta.env.BASE_URL + 'icon_timer.png'} width="22" height="22" alt="Timer" className="nav-tab-icon" />
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

      {mode === '1v1' && (
        <SettingsPanel visible={settingsOpen} onClose={closeSettings} />
      )}

      {/* 1v1 对战历史面板 */}
      {mode === '1v1' && vsHistoryOpen && (
        <VsHistoryPanel onClose={() => setVsHistoryOpen(false)} />
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

