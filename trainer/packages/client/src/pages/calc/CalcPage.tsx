// NOTE: Calc 页面入口 — 组装所有子组件并初始化数据
// 路由: /app/calc/
// 布局顺序与原版 index.html 一致:
// 比赛名 → 图表 → 输入网格 → 控制按钮 → 进度滑杆 → 数字键盘 → 项目选择器 → 统计表

import { useEffect, useRef } from 'react';
import { useCalcStore } from './stores/calc_store';
import { setCurrentEvent, setMoveCntMode, setMbfMode } from './engine/calc_engine';
import { load as loadWrIds, loadDefaults } from './engine/wr_data';
import { sampleOneSolve } from './engine/sim_engine';
import { Chart } from './components/Chart';
import { InputGrid } from './components/InputGrid';
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
      <InputGrid />

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
