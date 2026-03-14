// NOTE: 应用入口 — 导入所有模块，初始化和编排
// 后续阶段会在此添加更多模块初始化

import { state, onChange } from './state.js';

// NOTE: Phase 2+ 会在此导入 chart, inputGrid, calcTable, urlSync

document.addEventListener('DOMContentLoaded', () => {
    // NOTE: Phase 5 会在此调用 urlSync.load() 恢复 URL 状态

    // 注册观察者 — 数据变更时更新所有 UI
    onChange(() => {
        // NOTE: Phase 3+ 会在此添加 chart.render(), calcTable.render(), urlSync.save()
    });

    console.log('HTH Grapher v2 initialized');
});
