// NOTE: Calc 页面入口 — 组装所有子组件并初始化数据
// 路由: /app/calc/
// 布局顺序与原版 index.html 一致:
// 比赛名 → 图表 → 输入网格 → 控制按钮 → 进度滑杆 → 数字键盘 → 项目选择器 → 统计表

import { useEffect, useRef, useState, useCallback } from 'react';
import { useCalcStore, isMbfForEvent } from './stores/calc_store';
import { setCurrentEvent, setMoveCntMode, setMbfMode } from './engine/calc_engine';
import { load as loadWrIds, loadDefaults, setPlayerOverride, clearPlayerOverride, getPlayerOverride, getAvgWR12 } from './engine/wr_data';
import { sampleOneSolve } from './engine/sim_engine';
import { WcaPersonPicker, fetchUserTimes, fetchAvatar } from '@cuberoot/shared';
import { Chart } from './components/Chart';
import { InputGrid } from './components/InputGrid';
import type { AvatarState } from './components/InputGrid';
import { Numpad } from './components/Numpad';
import { CalcTable } from './components/CalcTable';
import { EventSelector } from './components/EventSelector';
import { SimButtons } from './components/SimButtons';
import { ProgressSliders } from './components/ProgressSliders';
import './calc.css';

export function CalcPage() {
  const event = useCalcStore(s => s.event);
  const compName = useCalcStore(s => s.compName);
  const setCompName = useCalcStore(s => s.setCompName);
  const loadFromUrl = useCalcStore(s => s.loadFromUrl);
  const saveToUrl = useCalcStore(s => s.saveToUrl);
  const initDone = useRef(false);

  // NOTE: 头像按钮状态 — 原版 input_grid.js 的 setMeButtonState 逻辑转为 React state
  const [avatarState, setAvatarState] = useState<AvatarState[]>([
    { active: false },
    { active: false },
  ]);

  // NOTE: WCA 选手搜索 modal 的开关状态
  const [pickerOpen, setPickerOpen] = useState(false);
  // NOTE: 当前搜索目标 player 索引（0 或 1）
  const pickerTargetRef = useRef(0);

  // NOTE: 初始化 — 加载 URL 参数 + WR 数据 + cubing-icons 字体 + 初始 rand-fill
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    // NOTE: 动态注入 cubing-icons CDN CSS（WCA 项目图标字体）
    const iconLink = document.createElement('link');
    iconLink.rel = 'stylesheet';
    iconLink.href = 'https://cdn.cubing.net/v0/css/@cubing/icons/css';
    document.head.appendChild(iconLink);

    // NOTE: 国旗图标（选手搜索下拉用）
    const flagLink = document.createElement('link');
    flagLink.rel = 'stylesheet';
    flagLink.href = 'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.3.2/css/flag-icons.min.css';
    document.head.appendChild(flagLink);

    loadFromUrl();
    const state = useCalcStore.getState();
    const eventId = state.event;
    setCurrentEvent(eventId);
    setMoveCntMode(eventId === '333fm');
    setMbfMode(eventId === '333mbf' || eventId === '333mbo');

    loadWrIds().then(() => {
      loadDefaults(eventId, () => {
        // NOTE: URL 无数据时自动随机填充（原版 app.js#272-286）
        if (!window.location.search.includes('t0=')) {
          const s = useCalcStore.getState();
          const sc = s.solveCount();
          for (let p = 0; p < 2; p++) {
            for (let t = 0; t < sc; t++) {
              if (!s.times[s.seedOn + p][t]) {
                s.updateTime(s.seedOn + p, t, sampleOneSolve(p));
              }
            }
          }
        }
      });
    });

    return () => {
      document.head.removeChild(iconLink);
      document.head.removeChild(flagLink);
    };
  }, [loadFromUrl]);

  // NOTE: 项目切换时重新加载 WR 默认数据 + 同步模式标志
  useEffect(() => {
    setCurrentEvent(event);
    setMoveCntMode(event === '333fm');
    setMbfMode(event === '333mbf' || event === '333mbo');
    loadDefaults(event);
  }, [event]);

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
      alert('No data found for ' + person.wcaId + ' in this event.');
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
      {/* 比赛名称 */}
      <input
        className="comp-name"
        type="text"
        value={compName}
        onChange={(e) => setCompName(e.target.value)}
        onBlur={() => saveToUrl()}
        placeholder="Result Calculator"
      />

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
      <Numpad />

      {/* 项目选择器 — 原版位于 numpad 和统计表之间 */}
      <EventSelector />

      {/* 指标表格 */}
      <CalcTable />
    </div>
  );
}

export default CalcPage;
