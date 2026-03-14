// NOTE: 应用入口 — 导入所有模块，初始化和编排

import { state, onChange, addSeedPair, notify } from './state.js';
import * as inputGrid from './input_grid.js';
import * as chart from './chart.js';
import * as calcTable from './calc_table.js';
import * as urlSync from './url_sync.js';

document.addEventListener('DOMContentLoaded', () => {
    // 初始化各模块
    chart.init(document.getElementById('chart-container'));
    inputGrid.init(document.getElementById('input-grid-container'));
    calcTable.init();

    // 恢复 URL 状态（必须在 init 之后、首次 render 之前）
    urlSync.load();

    // 注册观察者 — 数据变更时更新所有 UI
    onChange(() => {
        chart.render();
        inputGrid.refresh();
        calcTable.render();
        urlSync.save();
        updateSeedControls();
    });

    // ── Seeds 控制 ──
    document.getElementById('seed-prev').addEventListener('click', () => {
        if (state.seedOn >= 2) {
            state.seedOn -= 2;
            notify();
        }
    });
    document.getElementById('seed-next').addEventListener('click', () => {
        state.seedOn += 2;
        if (state.seedOn >= state.names.length) {
            addSeedPair();
        } else {
            notify();
        }
    });

    // ── ViewMode 切换 ──
    var viewBtn = document.getElementById('view-toggle');
    var viewLabels = ['Both', 'A', 'B'];
    viewBtn.addEventListener('click', () => {
        state.viewMode = (state.viewMode + 1) % 3;
        viewBtn.textContent = viewLabels[state.viewMode];
        chart.render(); // 仅图表需要更新
    });

    // 首次渲染
    chart.render();
    inputGrid.refresh();
    calcTable.render();
    updateSeedControls();

    console.log('HTH Grapher v2 initialized');
});

function updateSeedControls() {
    document.getElementById('seed-prev').disabled = (state.seedOn < 2);
    document.getElementById('seed-label').textContent =
        'Seeds ' + (state.seedOn + 1) + '-' + (state.seedOn + 2);
}
