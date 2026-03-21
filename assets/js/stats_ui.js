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
        tabSuffix = getTabSuffix(tabReadScope);
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
    var tabScope = panel.querySelector('.source-panel.active') || panel;
    syncTabSuffix(tabScope, tabSuffix);
    // NOTE: 同步 metric ID 到 URL hash（如 metric=ao100）
    updateHashParam('metric', id);
}

// ── Tab 切换（局部作用域）─────────────────────────────────
function switchTab(e, id) {
    // NOTE: 优先限定到 source-panel（wr_newcomer 三层嵌套），避免清除其他 source-panel 的 tab
    var scope = e.target.closest('.source-panel') || e.target.closest('.metric-panel') || document;
    scope.querySelectorAll('.stat-tab').forEach(function (t) { t.classList.remove('active'); });
    scope.querySelectorAll('.stat-panel').forEach(function (p) { p.classList.remove('active'); });
    e.target.classList.add('active');
    document.getElementById(id).classList.add('active');
    // NOTE: 同步 tab suffix 到 URL hash（如 type=ranking）
    var suffix = id.split('-').pop();
    updateHashParam('type', suffix);
    // NOTE: 同步天数 0 toggle 可见性（仅 history tab 时显示）
    syncDaysFilterVisibility(suffix === 'history');
}

// ── Tab 切换（全局，遍历所有 metric-panel）────────────────
function switchGlobalTab(e, suffix) {
    document.querySelectorAll('.stat-tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.metric-panel').forEach(function (panel) {
        // NOTE: 同步 stat-panel
        panel.querySelectorAll('.stat-panel').forEach(function (p) { p.classList.remove('active'); });
        var prefix = panel.id.replace('metric-', '');
        var targetId = prefix + '-' + suffix;
        var targetPanel = document.getElementById(targetId);
        if (targetPanel) targetPanel.classList.add('active');
        // NOTE: 同步 tab 按钮——在每个 metric-panel 中高亮匹配 suffix 的按钮
        panel.querySelectorAll('.stat-tab').forEach(function (t) {
            var tm = (t.getAttribute('onclick') || '').match(/switchGlobalTab\(event,\s*'(.+?)'\)/);
            if (tm && tm[1] === suffix) t.classList.add('active');
        });
    });
    // NOTE: 同步 tab suffix 到 URL hash（如 type=history）
    updateHashParam('type', suffix);
    // NOTE: 同步天数 0 toggle 可见性（仅 history tab 时显示）
    syncDaysFilterVisibility(suffix === 'history');
}

// ── Source 切换（wr_newcomer 三级嵌套）─────────────────────
// NOTE: 切换 source 时同步 tab 状态到新面板
function switchSource(btn, id) {
    var scope = btn.closest('.metric-panel') || document;

    // NOTE: 记住当前 tab suffix（ranking/history），切换 source 后同步
    var tabSuffix = null;
    var oldSource = scope.querySelector('.source-panel.active');
    if (oldSource) {
        tabSuffix = getTabSuffix(oldSource);
    }

    // NOTE: 切换 source 面板
    scope.querySelectorAll('.source-btn').forEach(function (b) { b.classList.remove('active'); });
    scope.querySelectorAll('.source-panel').forEach(function (p) { p.classList.remove('active'); });
    btn.classList.add('active');
    var newPanel = document.getElementById('source-' + id);
    newPanel.classList.add('active');

    // NOTE: 同步 tab suffix 到新 source panel
    syncTabSuffix(newPanel, tabSuffix);
}

// ── 辅助函数: Tab 状态同步 ─────────────────────────────────

// NOTE: 从指定作用域中提取当前 active tab 的 suffix（如 'ranking', 'history'）
function getTabSuffix(scope) {
    var activeTab = scope.querySelector('.stat-tab.active');
    if (activeTab) {
        // 兼容 switchTab 和 switchGlobalTab 两种 onclick 格式
        var m = (activeTab.getAttribute('onclick') || '').match(/switch(?:Global)?Tab\(event,\s*'(.+?)'\)/);
        if (m) return m[1].split('-').pop();
    }
    return null;
}

// NOTE: 将 tabSuffix 同步应用到新的面板作用域
function syncTabSuffix(scope, tabSuffix) {
    if (!tabSuffix) return;

    scope.querySelectorAll('.stat-tab').forEach(function (t) { t.classList.remove('active'); });
    scope.querySelectorAll('.stat-panel').forEach(function (p) { p.classList.remove('active'); });

    scope.querySelectorAll('.stat-tab').forEach(function (t) {
        var tm = (t.getAttribute('onclick') || '').match(/switch(?:Global)?Tab\(event,\s*'(.+?)'\)/);
        if (tm && tm[1].split('-').pop() === tabSuffix) {
            t.classList.add('active');

            // NOTE: switchGlobalTab 的参数只是 suffix，需要先按完整 ID 查找，再按 metric prefix 拼接回退
            var tp = document.getElementById(tm[1]);
            if (!tp) {
                var metricPanel = scope.closest('.metric-panel');
                var pPrefix = metricPanel ? metricPanel.id.replace('metric-', '') : '';
                tp = document.getElementById(pPrefix + '-' + tm[1]);
            }
            if (tp) tp.classList.add('active');
        }
    });
}

// ── 下拉菜单（wr_metric 页面）─────────────────────────────
function toggleMetricDropdown() {
    document.querySelector('.metric-dropdown').classList.toggle('open');
}

function selectFromDropdown(id) {
    // NOTE: data-id 存的是完整 panel id（如 "metric-mo5"），
    // 而 switchMetric 内部会自己拼 "metric-" 前缀，所以需要先去掉
    var shortId = id.replace(/^metric-/, '');
    switchMetric(event, shortId);
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
    // NOTE: metric-tab-wrap 是已知的语义容器
    var containers = document.querySelectorAll('.metric-tab-wrap');
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
    // NOTE: 如果容器中有下拉菜单（Mode C），metric 切换由下拉控制，不生成药丸按钮
    var hasDropdown = !!container.querySelector('.metric-dropdown');
    if (panels.length >= 2 && !hasDropdown && !container.querySelector('.metric-btn')) {
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
        // NOTE: 检测全局 tab 模式——直接在 scope 上，或在容器中的 metric-toolbar 上
        var isGlobal = !!scope.closest('[data-tab-mode="global"]');
        if (!isGlobal && scope.parentElement) {
            isGlobal = !!scope.parentElement.querySelector('.metric-toolbar[data-tab-mode="global"]');
        }
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

// NOTE: solve-details 懒加载——点击展开时才创建 DOM 节点
// data-solves 属性存储逗号分隔的格式化成绩，避免初始加载大量 span 元素
document.addEventListener('toggle', function(e) {
    var d = e.target;
    if (!d.classList || !d.classList.contains('solve-details')) return;
    if (!d.open || d.querySelector('.solve-list')) return;

    var csv = d.getAttribute('data-solves');
    if (!csv) return;

    var div = document.createElement('div');
    div.className = 'solve-list';
    csv.split(',').forEach(function(s) {
        var span = document.createElement('span');
        span.textContent = s;
        div.appendChild(span);
    });
    d.appendChild(div);
}, true);

// NOTE: DOMContentLoaded 时自动初始化
// event_selector.js 在此之后执行（defer 顺序保证），会处理 hash 恢复
document.addEventListener('DOMContentLoaded', function() {
    initStatsUI();
    restoreTabFromHash();
    // NOTE: 页面有 tab 但 URL 缺少 type 时，强制补上默认值
    if (!getHashParam('type') && document.querySelector('.stat-tab')) {
        updateHashParam('type', 'ranking');
    }
    // NOTE: average_of 专用——天数 0 行隐藏 toggle
    initHideDays0();
    // NOTE: 防 FOUC 完成——移除 head 中设置的隐藏 class
    document.documentElement.classList.remove('stats-hash-loading');
});

// ── average_of 专用：隐藏天数为 0 的行 ─────────────────────
// NOTE: 仅在 /stats/average_of 页面生效
// 默认隐藏天数 0 行，用户可通过 checkbox 切换，状态通过 URL hash 持久化
function initHideDays0() {
    // NOTE: 仅 average_of 页面生效
    if (!/\/stats\/average_of\b/.test(location.pathname)) return;

    // NOTE: 找到所有 history 面板（ID 以 -history 结尾）
    var historyPanels = document.querySelectorAll('.stat-panel[id$="-history"]');
    if (!historyPanels.length) return;

    // NOTE: 扫描每个 history 面板，标记天数 0 的行
    historyPanels.forEach(function(panel) {
        panel.querySelectorAll('table').forEach(function(table) {
            // 找到 Days 列索引
            var daysIdx = -1;
            table.querySelectorAll('thead tr th, tr:first-child th').forEach(function(th, i) {
                // NOTE: 匹配英文 "Days" 或中文 "天数"（i18n 后表头可能已翻译）
                var txt = th.textContent.trim();
                if (txt === 'Days' || txt === '天数') daysIdx = i;
            });
            if (daysIdx === -1) return;

            // NOTE: 标记天数为 0 的行
            table.querySelectorAll('tr').forEach(function(tr) {
                var tds = tr.querySelectorAll('td');
                if (tds.length > daysIdx && tds[daysIdx].textContent.trim() === '0') {
                    tr.classList.add('zero-days');
                }
            });
        });
    });

    // NOTE: 创建 checkbox 控件，插入到第一个 history 面板前
    // 因为 metric-panel 用 display:contents，toggle 视觉上在所有 history 表的上方
    var firstPanel = historyPanels[0];
    var wrap = document.createElement('label');
    wrap.className = 'days-filter';
    wrap.setAttribute('data-i18n-en', 'Hide 0-day rows');
    wrap.setAttribute('data-i18n-zh', '隐藏天数为 0 的行');

    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'hide-zero-days';

    var span = document.createElement('span');
    // NOTE: 根据当前语言设置标签文本
    var isZh = (getHashParam('lang') === 'zh') ||
               (new URLSearchParams(location.search).get('lang') === 'zh');
    span.textContent = isZh ? '隐藏天数为 0 的行' : 'Hide 0-day rows';

    wrap.appendChild(cb);
    wrap.appendChild(span);

    // NOTE: 将 toggle 插入到所有 history 面板中（每个 metric-panel 的 history 区域）
    // 但实际只需一个 DOM 元素，放在 metric-tab-wrap 内、stat-tabs 之后
    var tabsContainer = document.querySelector('.stat-tabs');
    if (tabsContainer && tabsContainer.parentNode) {
        tabsContainer.parentNode.insertBefore(wrap, tabsContainer.nextSibling);
    } else {
        firstPanel.parentNode.insertBefore(wrap, firstPanel);
    }

    // NOTE: 读取 URL hash 中的 hide0 参数，默认隐藏（hide0 不为 "0" 时都隐藏）
    var hide0Param = getHashParam('hide0');
    // NOTE: 默认隐藏 — 只有显式设置 hide0=0 才显示
    var shouldHide = (hide0Param !== '0');
    cb.checked = shouldHide;

    // NOTE: 通过在 document.body 上切换 class 来控制 CSS 隐藏
    if (shouldHide) document.body.classList.add('hide-zero-days');

    // NOTE: 初始可见性——检查当前是否在 history tab
    var currentType = getHashParam('type');
    syncDaysFilterVisibility(currentType === 'history');

    cb.addEventListener('change', function() {
        if (cb.checked) {
            document.body.classList.add('hide-zero-days');
            // NOTE: 默认就是隐藏，删除 hash 参数（保持 URL 简洁）
            removeHashParam('hide0');
        } else {
            document.body.classList.remove('hide-zero-days');
            updateHashParam('hide0', '0');
        }
    });
}

// NOTE: 同步天数过滤 toggle 的可见性——仅 history tab 可见时显示
function syncDaysFilterVisibility(isHistory) {
    var filter = document.querySelector('.days-filter');
    if (filter) {
        filter.style.display = isHistory ? 'inline-flex' : 'none';
    }
}

// NOTE: 从 URL hash 中删除指定参数
function removeHashParam(key) {
    var hash = window.location.hash.replace(/^#/, '');
    var params = {};
    hash.split('&').forEach(function(part) {
        var kv = part.split('=');
        if (kv[0] && kv[0] !== key) params[kv[0]] = kv[1] || '';
    });
    var newHash = Object.keys(params).map(function(k) { return k + '=' + params[k]; }).join('&');
    history.replaceState(null, '', newHash ? '#' + newHash : location.pathname + location.search);
}

// ── URL hash 参数工具函数 ─────────────────────────────────

// NOTE: 更新 URL hash 中的指定参数（不触发页面刷新）
// 格式：#event=333&type=history
function updateHashParam(key, value) {
    var hash = window.location.hash.replace(/^#/, '');
    var params = {};
    hash.split('&').forEach(function(part) {
        var kv = part.split('=');
        if (kv[0]) params[kv[0]] = kv[1] || '';
    });
    params[key] = value;
    var newHash = Object.keys(params).map(function(k) { return k + '=' + params[k]; }).join('&');
    history.replaceState(null, '', '#' + newHash);
}

// NOTE: 从 URL hash 读取指定参数
function getHashParam(key) {
    var hash = window.location.hash.replace(/^#/, '');
    var match = hash.match(new RegExp('(?:^|&)' + key + '=([^&]*)'));
    return match ? match[1] : null;
}

// NOTE: 页面加载时从 URL hash 恢复 tab 状态
function restoreTabFromHash() {
    // --- 恢复 metric（Mo3/Ao5/...） ---
    var metric = getHashParam('metric');
    if (metric) {
        var metricBtn = document.querySelector('.metric-btn[onclick*="\'' + metric + '\'"');
        if (metricBtn) metricBtn.click();
    }
    // --- 恢复 type（ranking/history） ---
    var type = getHashParam('type');
    if (!type) return;
    // NOTE: 模拟点击对应的 tab 按钮
    var clicked = false;
    document.querySelectorAll('.stat-tab').forEach(function(t) {
        if (clicked) return;
        var onclick = t.getAttribute('onclick') || '';
        // 匹配 switchGlobalTab(event,'history') 或 switchTab(event,'xxx-history')
        var m = onclick.match(/switch(?:Global)?Tab\(event,\s*'(.+?)'\)/);
        if (m && m[1].split('-').pop() === type) {
            t.click();
            clicked = true;
        }
    });
}

