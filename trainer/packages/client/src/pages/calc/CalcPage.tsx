// NOTE: Calc 页面入口 — 组装所有子组件并初始化数据
// 路由: /app/calc/

import { useEffect } from 'react';
import { useCalcStore } from './stores/calc_store';
import { setCurrentEvent } from './engine/calc_engine';
import { load as loadWrIds, loadDefaults } from './engine/wr_data';
import { Chart } from './components/Chart';
import { InputGrid } from './components/InputGrid';
import { Numpad } from './components/Numpad';
import { CalcTable } from './components/CalcTable';
import { EventSelector } from './components/EventSelector';
import { SimButtons } from './components/SimButtons';
import './calc.css';

export function CalcPage() {
  const event = useCalcStore(s => s.event);
  const compName = useCalcStore(s => s.compName);
  const setCompName = useCalcStore(s => s.setCompName);
  const loadFromUrl = useCalcStore(s => s.loadFromUrl);
  const saveToUrl = useCalcStore(s => s.saveToUrl);

  // NOTE: 初始化 — 加载 URL 参数 + WR 数据 + cubing-icons 字体
  useEffect(() => {
    // NOTE: 动态注入 cubing-icons CDN CSS（WCA 项目图标字体）
    const iconLink = document.createElement('link');
    iconLink.rel = 'stylesheet';
    iconLink.href = 'https://cdn.cubing.net/v0/css/@cubing/icons/css';
    document.head.appendChild(iconLink);

    loadFromUrl();
    setCurrentEvent(useCalcStore.getState().event);
    loadWrIds().then(() => {
      loadDefaults(useCalcStore.getState().event);
    });

    return () => {
      document.head.removeChild(iconLink);
    };
  }, [loadFromUrl]);

  // NOTE: 项目切换时重新加载 WR 默认数据
  useEffect(() => {
    setCurrentEvent(event);
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
        placeholder="比赛名称..."
      />

      {/* 项目选择器 */}
      <EventSelector />

      {/* SVG 图表 */}
      <Chart />

      {/* 输入网格 */}
      <InputGrid />

      {/* 控制按钮 */}
      <SimButtons />

      {/* 数字键盘 */}
      <Numpad />

      {/* 指标表格 */}
      <CalcTable />
    </div>
  );
}

export default CalcPage;
