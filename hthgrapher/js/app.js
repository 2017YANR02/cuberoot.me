// NOTE: 应用入口 — 导入所有模块，初始化和编排

import { state, onChange } from './state.js';
import * as inputGrid from './input_grid.js';

// NOTE: Phase 3+ 会在此导入 chart, calcTable, urlSync

document.addEventListener('DOMContentLoaded', () => {
    // 初始化输入网格
    var gridContainer = document.getElementById('input-grid-container');
    inputGrid.init(gridContainer);

    // NOTE: Phase 5 会在此调用 urlSync.load() 恢复 URL 状态

    // 注册观察者 — 数据变更时更新所有 UI
    onChange(() => {
        inputGrid.refresh();
        // NOTE: Phase 3+ 会在此添加 chart.render(), calcTable.render(), urlSync.save()
    });

    // 首次刷新
    inputGrid.refresh();

    console.log('HTH Grapher v2 initialized');
});
