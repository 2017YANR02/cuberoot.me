// NOTE: Stats 页面交互逻辑（前后端分离）
// 从 Ruby Heredoc 中提取，消除双重转义问题
// 原始位置：metric_selector.rb / tab_ui.rb / wr_newcomer.rb

// ── Metric 切换 ───────────────────────────────────────────
// NOTE: 显示选中的 .metric-panel，高亮按钮
// 同时保持 source 索引和 tab 选择不变（跨面板同步）
function switchMetric(id) {
    var oldPanel = document.querySelector('.metric-panel.active');
    // NOTE: 记住当前 source 按钮索引
    var srcIdx = 0;
    if (oldPanel) {
        oldPanel.querySelectorAll('.source-btn').forEach(function (b, i) {
            if (b.classList.contains('active')) srcIdx = i;
        });
    }
    // NOTE: 记住当前 tab suffix（ranking/history），切换 metric 后同步到新面板
    // 限定到活跃 source-panel（wr_newcomer 三层嵌套场景）
    var tabSuffix = null;
    if (oldPanel) {
        var tabReadScope = oldPanel.querySelector('.source-panel.active') || oldPanel;
        var activeTab = tabReadScope.querySelector('.stat-tab.active');
        if (activeTab) {
            var m = (activeTab.getAttribute('onclick') || '').match(/switchTab\(event,\s*'(.+?)'\)/);
            if (m) tabSuffix = m[1].split('-').pop();
        }
    }
    // NOTE: 切换面板
    document.querySelectorAll('.metric-panel').forEach(function (p) { p.classList.remove('active'); });
    document.querySelectorAll('.metric-btn').forEach(function (b) { b.classList.remove('active'); });
    var panel = document.getElementById('metric-' + id);
    panel.classList.add('active');
    event.target.classList.add('active');
    // NOTE: 同步 source 索引到新 panel
    var newBtns = panel.querySelectorAll('.source-btn');
    if (newBtns[srcIdx]) newBtns[srcIdx].click();
    // NOTE: 同步 tab suffix 到新 panel，保持 tab 选择不变
    // wr_newcomer 有三层嵌套（metric→source→tab），需限定到活跃 source-panel
    if (tabSuffix) {
        var tabScope = panel.querySelector('.source-panel.active') || panel;
        tabScope.querySelectorAll('.stat-tab').forEach(function (t) { t.classList.remove('active'); });
        tabScope.querySelectorAll('.stat-panel').forEach(function (p) { p.classList.remove('active'); });
        tabScope.querySelectorAll('.stat-tab').forEach(function (t) {
            var tm = (t.getAttribute('onclick') || '').match(/switchTab\(event,\s*'(.+?)'\)/);
            if (tm && tm[1].split('-').pop() === tabSuffix) {
                t.classList.add('active');
                var tp = document.getElementById(tm[1]);
                if (tp) tp.classList.add('active');
            }
        });
    }
}

// ── Tab 切换（局部作用域）─────────────────────────────────
function switchTab(e, id) {
    // NOTE: 优先限定到 source-panel（wr_newcomer 三层嵌套），避免清除其他 source-panel 的 tab
    var scope = e.target.closest('.source-panel') || e.target.closest('.metric-panel') || document;
    scope.querySelectorAll('.stat-tab').forEach(function (t) { t.classList.remove('active'); });
    scope.querySelectorAll('.stat-panel').forEach(function (p) { p.classList.remove('active'); });
    e.target.classList.add('active');
    document.getElementById(id).classList.add('active');
}

// ── Tab 切换（全局，遍历所有 metric-panel）────────────────
function switchGlobalTab(e, suffix) {
    document.querySelectorAll('.stat-tab').forEach(function (t) { t.classList.remove('active'); });
    e.target.classList.add('active');
    document.querySelectorAll('.metric-panel').forEach(function (panel) {
        panel.querySelectorAll('.stat-panel').forEach(function (p) { p.classList.remove('active'); });
        // NOTE: panel.id 形如 "metric-single"，截取后面的 "single"
        var prefix = panel.id.replace('metric-', '');
        var targetId = prefix + '-' + suffix;
        var targetPanel = document.getElementById(targetId);
        if (targetPanel) targetPanel.classList.add('active');
    });
}

// ── Source 切换（wr_newcomer 三级嵌套）─────────────────────
function switchSource(btn, id) {
    var scope = btn.closest('.metric-panel') || document;
    scope.querySelectorAll('.source-btn').forEach(function (b) { b.classList.remove('active'); });
    scope.querySelectorAll('.source-panel').forEach(function (p) { p.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('source-' + id).classList.add('active');
}

// ── 下拉菜单（wr_metric 页面）─────────────────────────────
function toggleMetricDropdown() {
    document.querySelector('.metric-dropdown').classList.toggle('open');
}

function selectFromDropdown(id) {
    // NOTE: 调用共享的面板切换逻辑
    switchMetric(id);
    // NOTE: 更新触发器文本
    var item = document.querySelector('.metric-dropdown-item[data-id="' + id + '"]');
    if (item) {
        var trigger = document.querySelector('[data-role="trigger-text"]');
        trigger.textContent = item.textContent;
        trigger.setAttribute('data-i18n-en', item.getAttribute('data-i18n-en'));
    }
    // NOTE: 高亮当前项
    document.querySelectorAll('.metric-dropdown-item').forEach(function (i) { i.classList.remove('active'); });
    if (item) item.classList.add('active');
    // NOTE: 关闭面板
    document.querySelector('.metric-dropdown').classList.remove('open');
}

// NOTE: 点击下拉面板外部关闭
document.addEventListener('click', function (e) {
    var dd = document.querySelector('.metric-dropdown');
    if (dd && !dd.contains(e.target)) dd.classList.remove('open');
});
