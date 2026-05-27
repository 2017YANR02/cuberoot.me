'use client';

// NOTE: Chart React 组件 — 包装命令式 SVG 渲染器 + 拖动交互
// 通过 useEffect 驱动 initChart/render，通过 useCalcStore 订阅状态变更

import { useEffect, useRef } from 'react';
import { useCalcStore } from '../stores/calc_store';
import {
  initChart, destroyChart,
  render as chartRender,
} from './chart_renderer';
import { initDrag, onAfterRender as dragAfterRender } from './chart_drag_handler';

export function Chart() {
  const containerRef = useRef<HTMLDivElement>(null);

  // NOTE: 挂载 SVG + 拖动交互
  useEffect(() => {
    if (!containerRef.current) return;

    initChart(containerRef.current);
    chartRender();

    // NOTE: 挂载拖动事件，cleanup 返回卸载函数
    const cleanupDrag = initDrag();

    return () => {
      cleanupDrag();
      destroyChart();
    };
  }, []);

  // NOTE: 订阅 store 变更 → 重新渲染图表
  // 只监听影响图表的关键字段，避免不相关变更触发重绘
  const times = useCalcStore(s => s.times);
  const seedOn = useCalcStore(s => s.seedOn);
  const event = useCalcStore(s => s.event);
  const playerEnabled = useCalcStore(s => s.playerEnabled);
  const names = useCalcStore(s => s.names);
  const targetAvgs = useCalcStore(s => s.targetAvgs);

  useEffect(() => {
    chartRender();
    dragAfterRender();
  }, [times, seedOn, event, playerEnabled, names, targetAvgs]);

  return (
    <div id="chart-container" ref={containerRef} />
  );
}

export default Chart;
