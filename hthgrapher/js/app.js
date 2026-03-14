// NOTE: 应用入口 — 导入所有模块，初始化和编排

import { state, onChange } from './state.js';
import * as inputGrid from './input_grid.js';
import * as chart from './chart.js';

// NOTE: Phase 5 会在此导入 calcTable, urlSync

document.addEventListener('DOMContentLoaded', () => {
    // 初始化各模块
    chart.init(document.getElementById('chart-container'));
    inputGrid.init(document.getElementById('input-grid-container'));

    // NOTE: Phase 5 会在此调用 urlSync.load() 恢复 URL 状态

    // 注册观察者 — 数据变更时更新所有 UI
    onChange(() => {
        chart.render();
        inputGrid.refresh();
        // NOTE: Phase 5 会在此添加 calcTable.render(), urlSync.save()
    });

    // 首次渲染
    chart.render();
    inputGrid.refresh();

    console.log('HTH Grapher v2 initialized');
});
