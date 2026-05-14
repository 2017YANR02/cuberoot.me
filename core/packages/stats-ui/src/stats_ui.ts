// NOTE: Stats 页面交互逻辑（前后端分离）

// ── Metric 切换 ───────────────────────────────────────────
// NOTE: 显示选中的 .metric-panel，高亮按钮
// 同时保持 source 索引和 tab 选择不变（跨面板同步）
function switchMetric(e: Event, id: string): void {
    const oldPanel = document.querySelector('.metric-panel.active');
    // NOTE: 记住当前 source 按钮索引
    let srcIdx = 0;
    if (oldPanel) {
        oldPanel.querySelectorAll('.source-btn').forEach(function (b, i) {
            if (b.classList.contains('active')) srcIdx = i;
        });
    }
    // NOTE: 记住当前 tab suffix（ranking/history），切换 metric 后同步到新面板
    // 限定到活跃 source-panel（wr_newcomer 三层嵌套场景）
    let tabSuffix: string | null = null;
    if (oldPanel) {
        const tabReadScope = oldPanel.querySelector('.source-panel.active') || oldPanel;
        tabSuffix = getTabSuffix(tabReadScope as HTMLElement);
    }
    // NOTE: 切换面板
    document.querySelectorAll('.metric-panel').forEach(function (p) { p.classList.remove('active'); });
    document.querySelectorAll('.metric-btn').forEach(function (b) { b.classList.remove('active'); });
    const panel = document.getElementById('metric-' + id);
    if (!panel) return;
    panel.classList.add('active');
    (e.target as HTMLElement).classList.add('active');
    // NOTE: 同步 source 索引到新 panel
    const newBtns = panel.querySelectorAll('.source-btn');
    if (newBtns[srcIdx]) (newBtns[srcIdx] as HTMLElement).click();
    // NOTE: 同步 tab suffix 到新 panel，保持 tab 选择不变
    // wr_newcomer 有三层嵌套（metric→source→tab），需限定到活跃 source-panel
    const tabScope = panel.querySelector('.source-panel.active') || panel;
    syncTabSuffix(tabScope as HTMLElement, tabSuffix);
    // NOTE: 同步 metric ID 到 URL hash（如 metric=ao100）
    updateHashParam('metric', id);
}

// ── Tab 切换（局部作用域）─────────────────────────────────
function switchTab(e: Event, id: string): void {
    // NOTE: 优先限定到 source-panel（wr_newcomer 三层嵌套），避免清除其他 source-panel 的 tab
    const target = e.target as HTMLElement;
    const scope = target.closest('.source-panel') || target.closest('.metric-panel') || document;
    scope.querySelectorAll('.stat-tab').forEach(function (t) { t.classList.remove('active'); });
    scope.querySelectorAll('.stat-panel').forEach(function (p) { p.classList.remove('active'); });
    target.classList.add('active');
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
    // NOTE: 同步 tab suffix 到 URL hash（如 type=ranking）
    const suffix = id.split('-').pop() || '';
    updateHashParam('type', suffix);
    // NOTE: 同步天数 0 toggle 可见性（仅 history tab 时显示）
    syncDaysFilterVisibility(suffix === 'history');
}

// ── Tab 切换（全局，遍历所有 metric-panel）────────────────
function switchGlobalTab(e: Event, suffix: string): void {
    document.querySelectorAll('.stat-tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.metric-panel').forEach(function (panel) {
        // NOTE: 同步 stat-panel
        panel.querySelectorAll('.stat-panel').forEach(function (p) { p.classList.remove('active'); });
        const prefix = panel.id.replace('metric-', '');
        const targetId = prefix + '-' + suffix;
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) targetPanel.classList.add('active');
        // NOTE: 同步 tab 按钮——在每个 metric-panel 中高亮匹配 suffix 的按钮
        panel.querySelectorAll('.stat-tab').forEach(function (t) {
            const tm = (t.getAttribute('onclick') || '').match(/switchGlobalTab\(event,\s*'(.+?)'\)/);
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
function switchSource(btn: HTMLElement, id: string): void {
    const scope = btn.closest('.metric-panel') || document;

    // NOTE: 记住当前 tab suffix（ranking/history），切换 source 后同步
    let tabSuffix: string | null = null;
    const oldSource = scope.querySelector('.source-panel.active');
    if (oldSource) {
        tabSuffix = getTabSuffix(oldSource as HTMLElement);
    }

    // NOTE: 切换 source 面板
    scope.querySelectorAll('.source-btn').forEach(function (b) { b.classList.remove('active'); });
    scope.querySelectorAll('.source-panel').forEach(function (p) { p.classList.remove('active'); });
    btn.classList.add('active');
    const newPanel = document.getElementById('source-' + id);
    if (!newPanel) return;
    newPanel.classList.add('active');

    // NOTE: 同步 tab suffix 到新 source panel
    syncTabSuffix(newPanel, tabSuffix);
}

// ── 辅助函数: Tab 状态同步 ─────────────────────────────────

// NOTE: 从指定作用域中提取当前 active tab 的 suffix（如 'ranking', 'history'）
function getTabSuffix(scope: HTMLElement | Document): string | null {
    const activeTab = scope.querySelector('.stat-tab.active');
    if (activeTab) {
        // 兼容 switchTab 和 switchGlobalTab 两种 onclick 格式
        const m = (activeTab.getAttribute('onclick') || '').match(/switch(?:Global)?Tab\(event,\s*'(.+?)'\)/);
        if (m) return m[1].split('-').pop() || null;
    }
    return null;
}

// NOTE: 将 tabSuffix 同步应用到新的面板作用域
function syncTabSuffix(scope: HTMLElement, tabSuffix: string | null): void {
    if (!tabSuffix) return;

    scope.querySelectorAll('.stat-tab').forEach(function (t) { t.classList.remove('active'); });
    scope.querySelectorAll('.stat-panel').forEach(function (p) { p.classList.remove('active'); });

    scope.querySelectorAll('.stat-tab').forEach(function (t) {
        const tm = (t.getAttribute('onclick') || '').match(/switch(?:Global)?Tab\(event,\s*'(.+?)'\)/);
        if (tm && tm[1].split('-').pop() === tabSuffix) {
            t.classList.add('active');

            // NOTE: switchGlobalTab 的参数只是 suffix，需要先按完整 ID 查找，再按 metric prefix 拼接回退
            let tp = document.getElementById(tm[1]);
            if (!tp) {
                const metricPanel = (scope as HTMLElement).closest('.metric-panel');
                const pPrefix = metricPanel ? metricPanel.id.replace('metric-', '') : '';
                tp = document.getElementById(pPrefix + '-' + tm[1]);
            }
            if (tp) tp.classList.add('active');
        }
    });
}

// ── 下拉菜单（wr_metric 页面）─────────────────────────────
function toggleMetricDropdown(): void {
    const dd = document.querySelector('.metric-dropdown');
    if (dd) dd.classList.toggle('open');
}

function selectFromDropdown(id: string): void {
    // NOTE: data-id 存的是完整 panel id（如 "metric-mo5"），
    // 而 switchMetric 内部会自己拼 "metric-" 前缀，所以需要先去掉
    const shortId = id.replace(/^metric-/, '');
    switchMetric(event as Event, shortId);
    // NOTE: 更新触发器文本
    const item = document.querySelector('.metric-dropdown-item[data-id="' + id + '"]');
    if (item) {
        const trigger = document.querySelector('[data-role="trigger-text"]');
        if (trigger) {
            trigger.textContent = item.textContent;
            trigger.setAttribute('data-i18n-en', item.getAttribute('data-i18n-en') || '');
        }
    }
    // NOTE: 高亮当前项
    document.querySelectorAll('.metric-dropdown-item').forEach(function (i) { i.classList.remove('active'); });
    if (item) item.classList.add('active');
    // NOTE: 关闭面板
    const dd = document.querySelector('.metric-dropdown');
    if (dd) dd.classList.remove('open');
}

// NOTE: 点击下拉面板外部关闭
document.addEventListener('click', function (e) {
    const dd = document.querySelector('.metric-dropdown');
    if (dd && !dd.contains(e.target as Node)) dd.classList.remove('open');
});

// ── JS 驱动 UI 初始化 ──────────────────────────────────────
// NOTE: 扫描带 data-label-en 的面板，自动生成按钮
// 约束：只对有 data-label-en 属性的面板生效，现有页面无此属性则静默跳过
function initStatsUI(): void {
    // --- 第一步：处理语义容器内的 metric-panel ---
    // NOTE: metric-tab-wrap 是已知的语义容器
    const containers = document.querySelectorAll('.metric-tab-wrap');
    const handled = new Set<Element>(); // NOTE: 记录已处理的 metric-panel，避免重复

    containers.forEach(function (container) {
        const panels = container.querySelectorAll(':scope > .metric-panel[data-label-en]');
        if (panels.length === 0) return;
        panels.forEach(function (p) { handled.add(p); });
        processMetricGroup(container as HTMLElement, Array.from(panels) as HTMLElement[]);
    });

    // --- 第二步：处理顶层散落的 metric-panel（如 Mode E 的 average_of）---
    // NOTE: 不在任何语义容器内的 metric-panel，按连续相邻分组
    const loosePanels: HTMLElement[] = [];
    document.querySelectorAll('.metric-panel[data-label-en]').forEach(function (p) {
        if (!handled.has(p)) loosePanels.push(p as HTMLElement);
    });

    if (loosePanels.length >= 2) {
        // NOTE: 按连续相邻的 metric-panel 分组（中间可能被 h3 等标签隔开）
        let currentGroup: HTMLElement[] = [loosePanels[0]];
        for (let i = 1; i < loosePanels.length; i++) {
            // NOTE: 检查是否与前一个是相邻兄弟（中间只有文本/注释节点）
            const prev = currentGroup[currentGroup.length - 1];
            const next = prev.nextElementSibling;
            if (next === loosePanels[i]) {
                currentGroup.push(loosePanels[i]);
            } else {
                if (currentGroup.length >= 2) {
                    processMetricGroup(currentGroup[0].parentElement!, currentGroup);
                }
                currentGroup = [loosePanels[i]];
            }
        }
        if (currentGroup.length >= 2) {
            processMetricGroup(currentGroup[0].parentElement!, currentGroup);
        }
    }

    // --- 第三步：处理顶层独立 stat-panel（Mode A，不在任何 metric/source-panel 内）---
    const topStatPanels: HTMLElement[] = [];
    document.querySelectorAll('.stat-panel[data-label-en]').forEach(function (sp) {
        if (!sp.closest('.metric-panel') && !sp.closest('.source-panel')) {
            topStatPanels.push(sp as HTMLElement);
        }
    });
    // NOTE: 按连续相邻分组
    if (topStatPanels.length >= 2) {
        let tg: HTMLElement[] = [topStatPanels[0]];
        for (let j = 1; j < topStatPanels.length; j++) {
            if (tg[tg.length - 1].nextElementSibling === topStatPanels[j]) {
                tg.push(topStatPanels[j]);
            } else {
                if (tg.length >= 2) createTabButtons(tg[0].parentElement!, tg, false);
                tg = [topStatPanels[j]];
            }
        }
        if (tg.length >= 2) createTabButtons(tg[0].parentElement!, tg, false);
    }
}

// NOTE: 处理一组同父容器的 metric-panel：生成 metric 按钮、source 按钮、tab 按钮
function processMetricGroup(container: HTMLElement, panels: HTMLElement[]): void {
    // --- Metric 按钮 ---
    // NOTE: 如果容器中有下拉菜单（Mode C），metric 切换由下拉控制，不生成药丸按钮
    const hasDropdown = !!container.querySelector('.metric-dropdown');
    if (panels.length >= 2 && !hasDropdown && !container.querySelector('.metric-btn')) {
        const selectorDiv = document.createElement('div');
        selectorDiv.className = 'metric-selector';
        const groupDiv = document.createElement('div');
        groupDiv.className = 'metric-selector-group';

        for (let i = 0; i < panels.length; i++) {
            const panel = panels[i];
            const id = panel.id.replace('metric-', '');
            const btn = document.createElement('button');
            btn.className = 'segmented-btn metric-btn' + (i === 0 ? ' active' : '');
            btn.setAttribute('onclick', "switchMetric(event,'" + id + "')");
            btn.textContent = panel.getAttribute('data-label-en');
            if (panel.hasAttribute('data-label-zh')) {
                btn.setAttribute('data-i18n-en', panel.getAttribute('data-label-en') || '');
                btn.setAttribute('data-i18n-zh', panel.getAttribute('data-label-zh') || '');
            }
            groupDiv.appendChild(btn);
        }
        selectorDiv.appendChild(groupDiv);
        container.insertBefore(selectorDiv, panels[0]);
    }

    // --- Source 按钮 + Tab 按钮（每个 metric-panel 内）---
    for (let k = 0; k < panels.length; k++) {
        const mp = panels[k];

        // Source 按钮
        const sourcePanels = mp.querySelectorAll(':scope > .source-panel[data-label-en]');
        if (sourcePanels.length >= 2 && !mp.querySelector('.source-btn')) {
            const sd = document.createElement('div');
            sd.className = 'source-selector';
            const sg = document.createElement('div');
            sg.className = 'source-selector-group';

            for (let s = 0; s < sourcePanels.length; s++) {
                const sp = sourcePanels[s];
                const sid = sp.id.replace('source-', '');
                const sbtn = document.createElement('button');
                sbtn.className = 'segmented-btn source-btn' + (s === 0 ? ' active' : '');
                sbtn.setAttribute('onclick', "switchSource(this,'" + sid + "')");
                sbtn.textContent = sp.getAttribute('data-label-en');
                if (sp.hasAttribute('data-label-zh')) {
                    sbtn.setAttribute('data-i18n-en', sp.getAttribute('data-label-en') || '');
                    sbtn.setAttribute('data-i18n-zh', sp.getAttribute('data-label-zh') || '');
                }
                sg.appendChild(sbtn);
            }
            sd.appendChild(sg);
            mp.insertBefore(sd, sourcePanels[0]);
        }

        // Tab 按钮——直属于 metric-panel 的 stat-panel
        generateTabsInScope(mp);

        // Tab 按钮——在 source-panel 内
        const sps = mp.querySelectorAll('.source-panel[data-label-en]');
        for (let t = 0; t < sps.length; t++) {
            generateTabsInScope(sps[t] as HTMLElement);
        }
    }
}

// NOTE: 在 scope 内查找直属 stat-panel 并生成 tab 按钮
function generateTabsInScope(scope: HTMLElement): void {
    const statPanels: HTMLElement[] = [];
    scope.querySelectorAll('.stat-panel[data-label-en]').forEach(function (sp) {
        // NOTE: 确保是此 scope 的直属（不跨 source-panel 边界）
        const closestScope = sp.closest('.source-panel[data-label-en]') || sp.closest('.metric-panel[data-label-en]');
        if (closestScope === scope) statPanels.push(sp as HTMLElement);
    });

    if (statPanels.length >= 2 && !scope.querySelector('.stat-tab')) {
        // NOTE: 检测全局 tab 模式——直接在 scope 上，或在容器中的 metric-toolbar 上
        let isGlobal = !!scope.closest('[data-tab-mode="global"]');
        if (!isGlobal && scope.parentElement) {
            isGlobal = !!scope.parentElement.querySelector('.metric-toolbar[data-tab-mode="global"]');
        }
        createTabButtons(scope, statPanels, isGlobal);
    }
}

// NOTE: 创建 tab 按钮并插入到 scope 内第一个 stat-panel 之前
function createTabButtons(scope: HTMLElement, statPanels: HTMLElement[], isGlobal: boolean): void {
    const tabsDiv = document.createElement('div');
    tabsDiv.className = 'stat-tabs';

    statPanels.forEach(function (panel, i) {
        const btn = document.createElement('button');
        btn.className = 'segmented-btn stat-tab' + (i === 0 ? ' active' : '');
        btn.textContent = panel.getAttribute('data-label-en');
        if (panel.hasAttribute('data-label-zh')) {
            btn.setAttribute('data-i18n-en', panel.getAttribute('data-label-en') || '');
            btn.setAttribute('data-i18n-zh', panel.getAttribute('data-label-zh') || '');
        }

        if (isGlobal) {
            // NOTE: 全局模式，传 suffix（ranking/history）
            const suffix = panel.id.split('-').pop() || '';
            btn.setAttribute('onclick', "switchGlobalTab(event,'" + suffix + "')");
        } else {
            // NOTE: 局部模式，传完整 panel ID
            btn.setAttribute('onclick', "switchTab(event,'" + panel.id + "')");
        }

        tabsDiv.appendChild(btn);
    });

    statPanels[0].parentElement!.insertBefore(tabsDiv, statPanels[0]);
}

// NOTE: solve-details 懒加载——点击展开时才创建 DOM 节点
// data-solves 属性存储逗号分隔的格式化成绩，避免初始加载大量 span 元素
document.addEventListener('toggle', function(e) {
    const d = e.target as HTMLElement;
    if (!d.classList || !d.classList.contains('solve-details')) return;
    if (!(d as HTMLDetailsElement).open || d.querySelector('.solve-list')) return;

    const csv = d.getAttribute('data-solves');
    if (!csv) return;

    const div = document.createElement('div');
    div.className = 'solve-list';
    csv.split(',').forEach(function(s) {
        const span = document.createElement('span');
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
// 默认隐藏天数 0 行，用户可通过 iOS 药丸 toggle 切换，状态通过 URL hash 持久化
function initHideDays0(): void {
    // NOTE: 仅 average_of 页面生效
    if (!/\/stats\/average_of\b/.test(location.pathname)) return;

    // NOTE: 找到所有 history 面板（ID 以 -history 结尾）
    const historyPanels = document.querySelectorAll('.stat-panel[id$="-history"]');
    if (!historyPanels.length) return;

    // NOTE: 扫描每个 history 面板，标记需要过滤的行
    historyPanels.forEach(function(panel) {
        panel.querySelectorAll('table').forEach(function(table) {
            let daysIdx = -1;
            let startDateIdx = -1; // 开始日期列
            table.querySelectorAll('thead tr th, tr:first-child th').forEach(function(th, i) {
                const txt = th.textContent!.trim();
                // NOTE: 匹配英文或中文表头（i18n 后可能已翻译）
                if (txt === 'Days' || txt === '天数') daysIdx = i;
                if (txt === 'Start Comp' || txt === '开始比赛') startDateIdx = i;
            });

            const rows = Array.from(table.querySelectorAll('tr')).filter(function(tr) {
                return tr.querySelectorAll('td').length > 0;
            });

            // NOTE: 规则 1 — 天数为 0 的行
            if (daysIdx !== -1) {
                rows.forEach(function(tr) {
                    const tds = tr.querySelectorAll('td');
                    if (tds.length > daysIdx && tds[daysIdx].textContent!.trim() === '0') {
                        tr.classList.add('zero-days');
                    }
                });
            }

            // NOTE: 规则 2 — 相邻行开始比赛相同时，标记下方行（更旧的记录）
            // 表格按日期降序排列，上方是更新的记录，保留上方、过滤下方
            if (startDateIdx !== -1) {
                for (let i = 0; i < rows.length - 1; i++) {
                    const curTds = rows[i].querySelectorAll('td');
                    const nextTds = rows[i + 1].querySelectorAll('td');
                    if (curTds.length > startDateIdx && nextTds.length > startDateIdx) {
                        const curDate = curTds[startDateIdx].textContent!.trim();
                        const nextDate = nextTds[startDateIdx].textContent!.trim();
                        if (curDate && curDate === nextDate) {
                            rows[i + 1].classList.add('zero-days');
                        }
                    }
                }
            }
        });
    });

    // NOTE: 语言检测
    const isZh = (new URLSearchParams(location.search).get('lang') === 'zh');
    const labelText = isZh ? '日期去重' : 'Dedup';

    // NOTE: 读取 URL hash，默认去重（隐藏重复行）
    // toggle ON（绿色）= 去重启用（默认），OFF（灰色）= 显示所有行
    const hide0Param = getHashParam('hide0');
    const shouldDedup = (hide0Param !== '0');
    if (shouldDedup) document.body.classList.add('hide-zero-days');

    // NOTE: 在每个 metric-panel 的 stat-tabs 后插入 toggle
    // 这样切换 metric 时，当前 metric-panel 的 toggle 总是可见（display:contents 暴露到 flex）
    document.querySelectorAll('.metric-panel').forEach(function(mp) {
        const tabs = mp.querySelector('.stat-tabs');
        if (!tabs) return;

        const wrap = document.createElement('label');
        wrap.className = 'days-filter';

        // NOTE: iOS 药丸 toggle 结构：隐藏 checkbox + pill span + text span
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = shouldDedup;

        const pill = document.createElement('span');
        pill.className = 'toggle-pill';

        const txt = document.createElement('span');
        txt.textContent = labelText;

        wrap.appendChild(txt);
        wrap.appendChild(cb);
        wrap.appendChild(pill);

        // NOTE: 插入到 stat-tabs 之后
        tabs.parentNode!.insertBefore(wrap, tabs.nextSibling);

        // NOTE: change 事件——checked=去重启用, unchecked=显示全部
        cb.addEventListener('change', function() {
            document.querySelectorAll('.days-filter input[type="checkbox"]').forEach(function(c) {
                (c as HTMLInputElement).checked = cb.checked;
            });
            if (cb.checked) {
                // NOTE: toggle ON = 去重启用（默认）
                document.body.classList.add('hide-zero-days');
                removeHashParam('hide0');
            } else {
                // NOTE: toggle OFF = 显示所有行
                document.body.classList.remove('hide-zero-days');
                updateHashParam('hide0', '0');
            }
        });
    });

    // NOTE: 初始可见性——检查当前是否在 history tab
    const currentType = getHashParam('type');
    syncDaysFilterVisibility(currentType === 'history');
}

// NOTE: 同步天数过滤 toggle 的可见性——遍历所有 .days-filter
function syncDaysFilterVisibility(isHistory: boolean): void {
    document.querySelectorAll('.days-filter').forEach(function(f) {
        (f as HTMLElement).style.display = isHistory ? 'inline-flex' : 'none';
    });
}

// NOTE: 从 URL hash 中删除指定参数
function removeHashParam(key: string): void {
    const hash = window.location.hash.replace(/^#/, '');
    const params: Record<string, string> = {};
    hash.split('&').forEach(function(part) {
        const kv = part.split('=');
        if (kv[0] && kv[0] !== key) params[kv[0]] = kv[1] || '';
    });
    const newHash = Object.keys(params).map(function(k) { return k + '=' + params[k]; }).join('&');
    history.replaceState(null, '', newHash ? '#' + newHash : location.pathname + location.search);
}

// ── URL hash 参数工具函数 ─────────────────────────────────

// NOTE: 更新 URL hash 中的指定参数（不触发页面刷新）
// 格式：#event=333&type=history
function updateHashParam(key: string, value: string): void {
    const hash = window.location.hash.replace(/^#/, '');
    const params: Record<string, string> = {};
    hash.split('&').forEach(function(part) {
        const kv = part.split('=');
        if (kv[0]) params[kv[0]] = kv[1] || '';
    });
    params[key] = value;
    const newHash = Object.keys(params).map(function(k) { return k + '=' + params[k]; }).join('&');
    history.replaceState(null, '', '#' + newHash);
}

// NOTE: 从 URL hash 读取指定参数
function getHashParam(key: string): string | null {
    const hash = window.location.hash.replace(/^#/, '');
    const match = hash.match(new RegExp('(?:^|&)' + key + '=([^&]*)'));
    return match ? match[1] : null;
}

// NOTE: 页面加载时从 URL hash 恢复 tab 状态
function restoreTabFromHash(): void {
    // --- 恢复 metric（Mo3/Ao5/...） ---
    const metric = getHashParam('metric');
    if (metric) {
        const metricBtn = document.querySelector('.metric-btn[onclick*="\'' + metric + '\'"]') as HTMLElement | null;
        if (metricBtn) metricBtn.click();
    }
    // --- 恢复 type（ranking/history） ---
    const type = getHashParam('type');
    if (!type) return;
    // NOTE: 模拟点击对应的 tab 按钮
    let clicked = false;
    document.querySelectorAll('.stat-tab').forEach(function(t) {
        if (clicked) return;
        const onclick = t.getAttribute('onclick') || '';
        // 匹配 switchGlobalTab(event,'history') 或 switchTab(event,'xxx-history')
        const m = onclick.match(/switch(?:Global)?Tab\(event,\s*'(.+?)'\)/);
        if (m && m[1].split('-').pop() === type) {
            (t as HTMLElement).click();
            clicked = true;
        }
    });
}
