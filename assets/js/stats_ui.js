// NOTE: Stats 页面交互逻辑（前后端分离）
// 从 Ruby Heredoc 中提取，消除双重转义问题
// 原始位置：metric_selector.rb / tab_ui.rb / wr_newcomer.rb

// ── Metric 切换 ───────────────────────────────────────────
// NOTE: 显示选中的 .metric-panel，高亮按钮
// 同时保持 source 索引和 tab 选择不变（跨面板同步）
function switchMetric(e, id) {
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
    e.target.classList.add('active');
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
// NOTE: 切换 source 时同步 tab 状态到新面板
function switchSource(btn, id) {
    var scope = btn.closest('.metric-panel') || document;

    // NOTE: 记住当前 tab suffix（ranking/history），切换 source 后同步
    var tabSuffix = null;
    var oldSource = scope.querySelector('.source-panel.active');
    if (oldSource) {
        var activeTab = oldSource.querySelector('.stat-tab.active');
        if (activeTab) {
            var m = (activeTab.getAttribute('onclick') || '').match(/switchTab\(event,\s*'(.+?)'\)/);
            if (m) tabSuffix = m[1].split('-').pop();
        }
    }

    // NOTE: 切换 source 面板
    scope.querySelectorAll('.source-btn').forEach(function (b) { b.classList.remove('active'); });
    scope.querySelectorAll('.source-panel').forEach(function (p) { p.classList.remove('active'); });
    btn.classList.add('active');
    var newPanel = document.getElementById('source-' + id);
    newPanel.classList.add('active');

    // NOTE: 同步 tab suffix 到新 source panel
    if (tabSuffix) {
        newPanel.querySelectorAll('.stat-tab').forEach(function (t) { t.classList.remove('active'); });
        newPanel.querySelectorAll('.stat-panel').forEach(function (p) { p.classList.remove('active'); });
        newPanel.querySelectorAll('.stat-tab').forEach(function (t) {
            var tm = (t.getAttribute('onclick') || '').match(/switchTab\(event,\s*'(.+?)'\)/);
            if (tm && tm[1].split('-').pop() === tabSuffix) {
                t.classList.add('active');
                var tp = document.getElementById(tm[1]);
                if (tp) tp.classList.add('active');
            }
        });
    }
}

// ── 下拉菜单（wr_metric 页面）─────────────────────────────
function toggleMetricDropdown() {
    document.querySelector('.metric-dropdown').classList.toggle('open');
}

function selectFromDropdown(id) {
    // NOTE: 调用共享的面板切换逻辑
    switchMetric(event, id);
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

// ── JS 驱动 UI 初始化 ──────────────────────────────────────
// NOTE: 扫描带 data-label-en 的面板，自动生成按钮
// 约束：只对有 data-label-en 属性的面板生效，现有页面无此属性则静默跳过
function initStatsUI() {
    // --- 第一步：处理语义容器内的 metric-panel ---
    // NOTE: metric-tab-wrap 和 metric-toolbar 是已知的语义容器
    var containers = document.querySelectorAll('.metric-tab-wrap, .metric-toolbar');
    var handled = new Set(); // NOTE: 记录已处理的 metric-panel，避免重复

    containers.forEach(function (container) {
        var panels = container.querySelectorAll(':scope > .metric-panel[data-label-en]');
        if (panels.length === 0) return;
        panels.forEach(function (p) { handled.add(p); });
        processMetricGroup(container, panels);
    });

    // --- 第二步：处理顶层散落的 metric-panel（如 Mode E 的 average_of）---
    // NOTE: 不在任何语义容器内的 metric-panel，按连续相邻分组
    var loosePanels = [];
    document.querySelectorAll('.metric-panel[data-label-en]').forEach(function (p) {
        if (!handled.has(p)) loosePanels.push(p);
    });

    if (loosePanels.length >= 2) {
        // NOTE: 按连续相邻的 metric-panel 分组（中间可能被 h3 等标签隔开）
        var currentGroup = [loosePanels[0]];
        for (var i = 1; i < loosePanels.length; i++) {
            // NOTE: 检查是否与前一个是相邻兄弟（中间只有文本/注释节点）
            var prev = currentGroup[currentGroup.length - 1];
            var next = prev.nextElementSibling;
            if (next === loosePanels[i]) {
                currentGroup.push(loosePanels[i]);
            } else {
                if (currentGroup.length >= 2) {
                    processMetricGroup(currentGroup[0].parentElement, currentGroup);
                }
                currentGroup = [loosePanels[i]];
            }
        }
        if (currentGroup.length >= 2) {
            processMetricGroup(currentGroup[0].parentElement, currentGroup);
        }
    }

    // --- 第三步：处理顶层独立 stat-panel（Mode A，不在任何 metric/source-panel 内）---
    var topStatPanels = [];
    document.querySelectorAll('.stat-panel[data-label-en]').forEach(function (sp) {
        if (!sp.closest('.metric-panel') && !sp.closest('.source-panel')) {
            topStatPanels.push(sp);
        }
    });
    // NOTE: 按连续相邻分组
    if (topStatPanels.length >= 2) {
        var tg = [topStatPanels[0]];
        for (var j = 1; j < topStatPanels.length; j++) {
            if (tg[tg.length - 1].nextElementSibling === topStatPanels[j]) {
                tg.push(topStatPanels[j]);
            } else {
                if (tg.length >= 2) createTabButtons(tg[0].parentElement, tg, false);
                tg = [topStatPanels[j]];
            }
        }
        if (tg.length >= 2) createTabButtons(tg[0].parentElement, tg, false);
    }
}

// NOTE: 处理一组同父容器的 metric-panel：生成 metric 按钮、source 按钮、tab 按钮
function processMetricGroup(container, panels) {
    // --- Metric 按钮 ---
    if (panels.length >= 2 && !container.querySelector('.metric-btn')) {
        var isDropdown = container.getAttribute('data-ui') === 'dropdown';

        if (isDropdown) {
            // TODO: Phase 2 实现下拉菜单动态生成
        } else {
            var selectorDiv = document.createElement('div');
            selectorDiv.className = 'metric-selector';
            var groupDiv = document.createElement('div');
            groupDiv.className = 'metric-selector-group';

            for (var i = 0; i < panels.length; i++) {
                var panel = panels[i];
                var id = panel.id.replace('metric-', '');
                var btn = document.createElement('button');
                btn.className = 'segmented-btn metric-btn' + (i === 0 ? ' active' : '');
                btn.setAttribute('onclick', "switchMetric(event,'" + id + "')");
                btn.textContent = panel.getAttribute('data-label-en');
                if (panel.hasAttribute('data-label-zh')) {
                    btn.setAttribute('data-i18n-en', panel.getAttribute('data-label-en'));
                    btn.setAttribute('data-i18n-zh', panel.getAttribute('data-label-zh'));
                }
                groupDiv.appendChild(btn);
            }
            selectorDiv.appendChild(groupDiv);
            container.insertBefore(selectorDiv, panels[0]);
        }
    }

    // --- Source 按钮 + Tab 按钮（每个 metric-panel 内）---
    for (var k = 0; k < panels.length; k++) {
        var mp = panels[k];

        // Source 按钮
        var sourcePanels = mp.querySelectorAll(':scope > .source-panel[data-label-en]');
        if (sourcePanels.length >= 2 && !mp.querySelector('.source-btn')) {
            var sd = document.createElement('div');
            sd.className = 'source-selector';
            var sg = document.createElement('div');
            sg.className = 'source-selector-group';

            for (var s = 0; s < sourcePanels.length; s++) {
                var sp = sourcePanels[s];
                var sid = sp.id.replace('source-', '');
                var sbtn = document.createElement('button');
                sbtn.className = 'segmented-btn source-btn' + (s === 0 ? ' active' : '');
                sbtn.setAttribute('onclick', "switchSource(this,'" + sid + "')");
                sbtn.textContent = sp.getAttribute('data-label-en');
                if (sp.hasAttribute('data-label-zh')) {
                    sbtn.setAttribute('data-i18n-en', sp.getAttribute('data-label-en'));
                    sbtn.setAttribute('data-i18n-zh', sp.getAttribute('data-label-zh'));
                }
                sg.appendChild(sbtn);
            }
            sd.appendChild(sg);
            mp.insertBefore(sd, sourcePanels[0]);
        }

        // Tab 按钮——直属于 metric-panel 的 stat-panel
        generateTabsInScope(mp);

        // Tab 按钮——在 source-panel 内
        var sps = mp.querySelectorAll('.source-panel[data-label-en]');
        for (var t = 0; t < sps.length; t++) {
            generateTabsInScope(sps[t]);
        }
    }
}

// NOTE: 在 scope 内查找直属 stat-panel 并生成 tab 按钮
function generateTabsInScope(scope) {
    var statPanels = [];
    scope.querySelectorAll('.stat-panel[data-label-en]').forEach(function (sp) {
        // NOTE: 确保是此 scope 的直属（不跨 source-panel 边界）
        var closestScope = sp.closest('.source-panel[data-label-en]') || sp.closest('.metric-panel[data-label-en]');
        if (closestScope === scope) statPanels.push(sp);
    });

    if (statPanels.length >= 2 && !scope.querySelector('.stat-tab')) {
        var isGlobal = !!scope.closest('[data-tab-mode="global"]');
        createTabButtons(scope, statPanels, isGlobal);
    }
}

// NOTE: 创建 tab 按钮并插入到 scope 内第一个 stat-panel 之前
function createTabButtons(scope, statPanels, isGlobal) {
    var tabsDiv = document.createElement('div');
    tabsDiv.className = 'stat-tabs';

    statPanels.forEach(function (panel, i) {
        var btn = document.createElement('button');
        btn.className = 'segmented-btn stat-tab' + (i === 0 ? ' active' : '');
        btn.textContent = panel.getAttribute('data-label-en');
        if (panel.hasAttribute('data-label-zh')) {
            btn.setAttribute('data-i18n-en', panel.getAttribute('data-label-en'));
            btn.setAttribute('data-i18n-zh', panel.getAttribute('data-label-zh'));
        }

        if (isGlobal) {
            // NOTE: 全局模式，传 suffix（ranking/history）
            var suffix = panel.id.split('-').pop();
            btn.setAttribute('onclick', "switchGlobalTab(event,'" + suffix + "')");
        } else {
            // NOTE: 局部模式，传完整 panel ID
            btn.setAttribute('onclick', "switchTab(event,'" + panel.id + "')");
        }

        tabsDiv.appendChild(btn);
    });

    statPanels[0].parentElement.insertBefore(tabsDiv, statPanels[0]);
}

// NOTE: DOMContentLoaded 时自动初始化
// event_selector.js 在此之后执行（defer 顺序保证），会处理 hash 恢复
document.addEventListener('DOMContentLoaded', initStatsUI);

