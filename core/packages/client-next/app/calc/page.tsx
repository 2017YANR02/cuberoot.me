'use client';

// NOTE: Calc 页面入口 — 组装所有子组件并初始化数据
// 路由: /calc/
// 布局顺序与原版 index.html 一致:
// 比赛名 → 图表 → 输入网格 → 控制按钮 → 进度滑杆 → 数字键盘 → 项目选择器 → 统计表

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Sigma, HelpCircle } from 'lucide-react';
import { useCalcStore, isMbfForEvent, solveCountForEvent } from './_components/stores/calc_store';
import { setCurrentEvent, setMoveCntMode, setMbfMode } from './_components/engine/calc_engine';
import { load as loadWrIds, loadDefaults, setPlayerOverride, clearPlayerOverride, getPlayerOverride, getAvgWR12 } from './_components/engine/wr_data';
import { sampleOneSolve } from './_components/engine/sim_engine';
import { render as chartRender } from './_components/components/chart_renderer';
import { WcaPersonPicker, fetchUserTimes, fetchAvatar } from '@cuberoot/shared';
import { Chart } from './_components/components/Chart';
import { InputGrid } from './_components/components/InputGrid';
import type { AvatarState } from './_components/components/InputGrid';
import { Numpad } from './_components/components/Numpad';
import { CalcTable } from './_components/components/CalcTable';
import { EventSelector } from './_components/components/EventSelector';
import { SimButtons } from './_components/components/SimButtons';
import { ProgressSliders } from './_components/components/ProgressSliders';
import AverageMode from './_components/average_mode/AverageMode';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './calc.css';

type CalcTab = 'compare' | 'average';



// ── Wake Lock — 原版 app.js#20-31 ──
let wakeLock: WakeLockSentinel | null = null;
async function requestWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) {
    // NOTE: 用户拒绝或系统不支持时静默失败
    console.log('Wake Lock request failed:', (e as Error).message);
  }
}

export function CalcPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('成绩计算器', 'Score Calculator');
  const event = useCalcStore(s => s.event);
  const loadFromUrl = useCalcStore(s => s.loadFromUrl);
  const initDone = useRef(false);
  // NOTE: 防止 event useEffect 在首次挂载时清空 URL 恢复的数据
  const eventInitRef = useRef(false);

  // NOTE: tab 初值优先读 ?tab=average,默认 compare(H2H)
  const [tab, setTab] = useState<CalcTab>(() => {
    if (typeof window === 'undefined') return 'compare';
    return new URLSearchParams(window.location.search).get('tab') === 'average' ? 'average' : 'compare';
  });

  // NOTE: tab 切换同步到 URL（不进历史，刷新可恢复）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (tab === 'average') params.set('tab', 'average');
    else params.delete('tab');
    const qs = params.toString();
    const newUrl = `${window.location.pathname}${qs ? '?' + qs : ''}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
  }, [tab]);

  // NOTE: 头像按钮状态 — 原版 input_grid.js 的 setMeButtonState 逻辑转为 React state
  const [avatarState, setAvatarState] = useState<AvatarState[]>([
    { active: false },
    { active: false },
  ]);

  // NOTE: WCA 选手搜索 modal 的开关状态
  const [pickerOpen, setPickerOpen] = useState(false);
  // NOTE: 当前搜索目标 player 索引（0 或 1）
  const pickerTargetRef = useRef(0);

  // NOTE: 初始化 — 加载 URL 参数 + 预加载 WR 值（用于 isWR 高亮）
  // 默认进入"空白"状态:不自动填 Target、不 rand-fill、不激活头像。
  // 用户点 "🎲 World TOP 2" 按钮才走完整 loadDefaults + 填充流程。
  // CDN CSS（cubing-icons + flag-icons）已移至 index.html 静态加载,
  // 避免 React StrictMode 下 initDone 守卫导致 cleanup 后不再注入的 bug
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    loadFromUrl();
    const state = useCalcStore.getState();
    const eventId = state.event;
    setCurrentEvent(eventId);
    setMoveCntMode(eventId === '333fm');
    setMbfMode(eventId === '333mbf' || eventId === '333mbo');

    // NOTE: 仅预加载 wr_ids.json(同源静态文件,极快)以支持 isWR 标记;
    // 不调 loadDefaults,避免拉取选手 100 把 + 设置 override
    loadWrIds();

    // NOTE: Wake Lock 防息屏 — 原版 app.js#318-323
    requestWakeLock();
    const onVisChange = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [loadFromUrl]);

  // NOTE: 项目切换时重置数据 + 重新加载 WR 默认数据（原版 app.js#138-187）
  // 首次挂载跳过 — 此时 loadFromUrl 已恢复 URL 数据，不应被清空
  useEffect(() => {
    setCurrentEvent(event);
    setMoveCntMode(event === '333fm');
    setMbfMode(event === '333mbf' || event === '333mbo');

    if (!eventInitRef.current) {
      eventInitRef.current = true;
      return;
    }



    // NOTE: 清除个人数据覆盖 — 不同项目的 KDE 数据不通用
    for (let pi = 0; pi < 2; pi++) {
      clearPlayerOverride(pi);
      setAvatarState(prev => {
        const next = [...prev];
        next[pi] = { active: false, avatarUrl: '' };
        return next;
      });
    }

    // NOTE: 清空成绩并 resize — 原版 app.js#147-152
    // 切项目 = 回到空白状态,不再 auto rand-fill / 填 Target / 激活头像;
    // 用户需要 demo 数据再点 "🎲 World TOP 2" 按钮
    const s0 = useCalcStore.getState();
    const sc = solveCountForEvent(event);
    for (let p = 0; p < s0.times.length; p++) {
      for (let t = 0; t < s0.times[p].length; t++) s0.updateTime(p, t, 0);
    }
    s0.resizeTimes(sc);
    s0.clearTargetAvgs();
    // NOTE: 同步 URL 中的 event= 参数
    useCalcStore.getState().saveToUrl();
  }, [event]);

  // NOTE: 按需加载世界 TOP 2 — 当两侧都没有 override 时,首次"随机"会触发这个;
  // 拉 KDE 数据 + 填 Target(仅当为 0)+ 激活头像。返回 Promise 给 Numpad await。
  const ensureWrTop2Loaded = useCallback((): Promise<void> => {
    if (getPlayerOverride(0) || getPlayerOverride(1)) return Promise.resolve();
    const eventId = useCalcStore.getState().event;
    return loadWrIds().then(() => new Promise<void>((resolve) => {
      loadDefaults(eventId, (players) => {
        const s = useCalcStore.getState();
        // 填 Target = WR Average #1/#2 (仅当用户未手动设置)
        const wr12 = getAvgWR12(eventId);
        if (wr12) {
          for (let p = 0; p < 2; p++) {
            if (s.getTargetAvg(s.seedOn + p) === 0) {
              s.setTargetAvg(s.seedOn + p, wr12[p]);
            }
          }
        }
        // 激活头像 — 让用户知道 KDE 数据来源是世界 #1/#2
        if (players) {
          players.forEach((pl, i) => {
            if (!pl) return;
            fetchAvatar(pl.wca_id).then(url => {
              const ov = getPlayerOverride(i);
              if (ov && ov.name === pl.name) {
                setAvatarState(prev => {
                  const next = [...prev];
                  next[i] = { active: true, avatarUrl: url || '' };
                  return next;
                });
              }
            });
          });
        }
        s.saveToUrl();
        resolve();
      });
    }));
  }, []);

  // ── 秒表 — 原版 app.js#441-503 ──

  const animFrameRef = useRef<number | null>(null);

  const tickStopwatch = useCallback(() => {
    const s = useCalcStore.getState();
    if (s.timeLiveStart < 0) return;

    const elapsed = performance.now() - s.timeLiveStart;
    const cs = Math.round(elapsed / 10);
    const p = s.timeLive[0];
    const t = s.timeLive[1];

    // NOTE: 临时写入 state 以便图表渲染（不触发完整 onChange）— 原版 app.js#494
    s.times[s.seedOn + p][t] = cs;

    // NOTE: 重绘图表 — 原版 app.js#500
    chartRender({ skipViewBox: true });

    animFrameRef.current = requestAnimationFrame(tickStopwatch);
  }, []);

  const stopStopwatch = useCallback(() => {
    const s = useCalcStore.getState();
    const elapsed = performance.now() - s.timeLiveStart;
    const cs = Math.round(elapsed / 10);
    const p = s.timeLive[0];
    const t = s.timeLive[1];

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    s.setTimeLive(-1, -1);
    s.setTimeLiveStart(-1);
    s.updateTime(s.seedOn + p, t, cs);
  }, []);

  const startStopwatch = useCallback(() => {
    const s = useCalcStore.getState();
    if (isMbfForEvent(s.event)) return;
    const target = s.getFirstUnfilledTime(true);
    if (target[0] < 0) return;

    s.setTimeLive(target[0], target[1]);
    s.setTimeLiveStart(performance.now());
    tickStopwatch();
  }, [tickStopwatch]);

  const toggleStopwatch = useCallback(() => {
    const s = useCalcStore.getState();
    if (s.timeLiveStart >= 0) {
      stopStopwatch();
    } else {
      startStopwatch();
    }
  }, [startStopwatch, stopStopwatch]);

  // NOTE: 空格键触发秒表 — 原版 app.js#190
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        toggleStopwatch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleStopwatch]);



  // NOTE: rand-fill 辅助 — 只填空格子，原版 app.js#226-260
  const doRandFill = useCallback(() => {
    const s = useCalcStore.getState();
    const sc = s.solveCount();
    // NOTE: 检查已启用行是否全满
    let allFilled = true;
    for (let p = 0; p < 2; p++) {
      if (!s.playerEnabled[p]) continue;
      for (let t = 0; t < sc; t++) {
        if (!s.times[s.seedOn + p][t]) { allFilled = false; break; }
      }
      if (!allFilled) break;
    }
    for (let p = 0; p < 2; p++) {
      if (!s.playerEnabled[p]) continue;
      for (let t = 0; t < sc; t++) {
        if (!allFilled && s.times[s.seedOn + p][t]) continue;
        s.updateTime(s.seedOn + p, t, sampleOneSolve(p));
      }
    }
  }, []);

  // NOTE: 头像按钮点击 — 1:1 还原原版 app.js#368-418 的 player-override 逻辑
  const handlePlayerOverride = useCallback((p: number) => {
    const override = getPlayerOverride(p);

    if (override) {
      // NOTE: 已激活 → 切换回世界数据
      clearPlayerOverride(p);
      setAvatarState(prev => {
        const next = [...prev];
        next[p] = { active: false };
        return next;
      });
      // NOTE: 恢复 Target 为 WR Average — 原版 app.js#377-380
      const state = useCalcStore.getState();
      const isMbf = isMbfForEvent(state.event);
      if (!isMbf) {
        const wr12 = getAvgWR12(state.event);
        if (wr12) state.setTargetAvg(state.seedOn + p, wr12[p]);
      }
      doRandFill();
      return;
    }

    // NOTE: 未激活 → 打开搜索 modal
    pickerTargetRef.current = p;
    setPickerOpen(true);
  }, [doRandFill]);

  // NOTE: 搜索结果选中 — 加载选手数据并更新状态
  const handlePersonSelect = useCallback(async (person: { wcaId: string; name: string; avatarUrl?: string }) => {
    setPickerOpen(false);
    const p = pickerTargetRef.current;
    let avatarUrl = person.avatarUrl || '';

    // NOTE: loading 状态 — 按钮显示 ⏳
    setAvatarState(prev => {
      const next = [...prev];
      next[p] = { active: false, loading: '⏳' };
      return next;
    });

    const state = useCalcStore.getState();
    const data = await fetchUserTimes(person.wcaId, state.event);
    if (!data) {
      setAvatarState(prev => {
        const next = [...prev];
        next[p] = { active: false };
        return next;
      });
      alert(isZh
        ? `未找到 ${person.wcaId} 该项目的数据。`
        : 'No data found for ' + person.wcaId + ' in this event.');
      return;
    }

    // NOTE: FMC 数据对齐 — WCA API 返回原始步数，内部用 步数×100
    const isFmc = state.event === '333fm';
    const overrideData = {
      times: isFmc ? data.times.map(v => v * 100) : data.times,
      ao100: isFmc ? data.ao100 * 100 : data.ao100,
      name: data.name,
      country: data.country || '',
      averagePR: data.averagePR,
    };

    setPlayerOverride(p, overrideData);

    // NOTE: 自动将 Target 设为选手官方 average PR — 原版 app.js#408-410
    const isMbf = isMbfForEvent(state.event);
    if (data.averagePR && !isMbf) {
      state.setTargetAvg(state.seedOn + p, data.averagePR);
    }

    // NOTE: 获取选手头像（搜索结果可能无头像）— 原版 app.js#412-414
    if (!avatarUrl) {
      avatarUrl = await fetchAvatar(person.wcaId);
    }

    setAvatarState(prev => {
      const next = [...prev];
      next[p] = { active: true, avatarUrl };
      return next;
    });

    doRandFill();
  }, [doRandFill]);

  // NOTE: 搜索 modal 关闭（点击遮罩/Esc）
  const handlePickerClose = useCallback(() => {
    setPickerOpen(false);
  }, []);

  return (
    <div className="hth-app calc-page">
      {tab === 'average' ? (
        <>
          {/* 简易版顶部一行: 项目选择器 + 切回对比版 toggle */}
          <div className="calc-event-row">
            <EventSelector />
            <button
              type="button"
              className="calc-mode-toggle calc-mode-toggle-active"
              onClick={() => setTab('compare')}
              title={isZh ? '切到对比版' : 'Switch to Compare'}
            >
              <Sigma size={14} />
              <span>{isZh ? '简易版' : 'Simple'}</span>
            </button>
          </div>
          <AverageMode event={event} />
        </>
      ) : (
        <>
          {/* SVG 图表 */}
          <Chart />

          {/* 输入网格 */}
          <InputGrid
            avatarState={avatarState}
            onPlayerOverride={handlePlayerOverride}
          />

          {/* WCA 选手搜索 modal — 原版 app.js#327-364 */}
          <WcaPersonPicker
            mode="modal"
            open={pickerOpen}
            onSelect={handlePersonSelect}
            onClose={handlePickerClose}
          />

          {/* 控制按钮 */}
          <SimButtons />

          {/* 进步幅度滑杆 */}
          <ProgressSliders />

          {/* 数字键盘 */}
          <Numpad onEnsureWrTop2Loaded={ensureWrTop2Loaded} />

          {/* 项目选择器 + 简易版 toggle 同一行 */}
          <div className="calc-event-row">
            <EventSelector />
            <button
              type="button"
              className="calc-mode-toggle"
              onClick={() => setTab('average')}
              title={isZh ? '切到简易版' : 'Switch to Simple'}
            >
              <Sigma size={14} />
              <span>{isZh ? '简易版' : 'Simple'}</span>
            </button>
            <Link
              href="/calc-about"
              className="calc-title-help"
              title={isZh ? '这页是干啥的?' : 'What is this page?'}
              aria-label={isZh ? '查看说明' : 'About this page'}
            >
              <HelpCircle size={16} strokeWidth={1.75} />
            </Link>
          </div>

          {/* 指标表格 */}
          <CalcTable />
        </>
      )}
    </div>
  );
}

export default CalcPage;
