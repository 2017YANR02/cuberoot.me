// NOTE: WCA 项目选择器 — 在按项目分组的 stats 页面顶部生成图标选择栏
// 依赖 CDN: https://cdn.cubing.net/v0/css/@cubing/icons/css
(function () {
  'use strict';

  // NOTE: 英文项目名 → WCA event ID 映射，用于生成 cubing-icon class
  const EVENT_MAP = {
    "Rubik's Cube": "333",
    "2x2x2 Cube": "222",
    "4x4x4 Cube": "444",
    "5x5x5 Cube": "555",
    "6x6x6 Cube": "666",
    "7x7x7 Cube": "777",
    "3x3x3 Blindfolded": "333bf",
    "3x3x3 Fewest Moves": "333fm",
    "3x3x3 One-Handed": "333oh",
    "Megaminx": "minx",
    "Pyraminx": "pyram",
    "Rubik's Clock": "clock",
    "Skewb": "skewb",
    "Square-1": "sq1",
    "4x4x4 Blindfolded": "444bf",
    "5x5x5 Blindfolded": "555bf",
    "3x3x3 Multi-Blind": "333mbf",
    "3x3x3 With Feet": "333ft",
    "Rubik's Magic": "magic",
    "Master Magic": "mmagic",
    "Rubik's Cube: Multiple blind old style": "333mbo"
  };

  // NOTE: 中文项目名映射，用于选中时的 tooltip
  const EVENT_ZH = {
    "333": "三阶魔方", "222": "二阶魔方", "444": "四阶魔方",
    "555": "五阶魔方", "666": "六阶魔方", "777": "七阶魔方",
    "333bf": "三阶盲拧", "333fm": "三阶最少步", "333oh": "三阶单手",
    "minx": "五魔方", "pyram": "金字塔", "clock": "魔表",
    "skewb": "斜转魔方", "sq1": "SQ1", "444bf": "四阶盲拧",
    "555bf": "五阶盲拧", "333mbf": "三阶多盲", "333ft": "三阶脚拧",
    "magic": "八板", "mmagic": "十二板", "333mbo": "旧多盲"
  };

  /**
   * NOTE: 收集一个容器内的 h3 "section"（h3 + 后续兄弟直到下一个 h3）
   * 返回 [{ eventId, eventEn, h3, elements: [h3, sibling1, ...] }, ...]
   */
  function collectSections(container) {
    const sections = [];
    // 获取容器的直接子节点或同级节点
    const nodes = container.children;
    let current = null;

    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (el.tagName === 'H3' && el.hasAttribute('data-i18n-en')) {
        const enName = el.getAttribute('data-i18n-en');
        const eventId = EVENT_MAP[enName];
        if (eventId) {
          current = { eventId, eventEn: enName, h3: el, elements: [el] };
          sections.push(current);
        } else {
          current = null;
        }
      } else if (current) {
        current.elements.push(el);
      }
    }
    return sections;
  }

  /**
   * NOTE: 创建图标选择器 DOM
   * @param {Array} eventIds - 页面中出现的 eventId 列表（保持顺序）
   * @param {Function} onSelect - 点击回调 (eventId) => void
   * @returns {HTMLElement}
   */
  function createSelector(eventIds, onSelect) {
    const bar = document.createElement('div');
    bar.className = 'event-selector';

    eventIds.forEach((id, idx) => {
      const btn = document.createElement('button');
      btn.className = 'event-btn';
      btn.setAttribute('data-event', id);
      // NOTE: 双语 tooltip
      const lang = document.documentElement.getAttribute('data-lang') || 'en';
      btn.title = lang === 'zh' ? (EVENT_ZH[id] || id) : (
        Object.keys(EVENT_MAP).find(k => EVENT_MAP[k] === id) || id
      );

      // cubing-icon span
      const icon = document.createElement('span');
      icon.className = `cubing-icon event-${id}`;
      btn.appendChild(icon);

      if (idx === 0) btn.classList.add('active');

      btn.addEventListener('click', () => {
        bar.querySelectorAll('.event-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onSelect(id);
      });

      bar.appendChild(btn);
    });

    return bar;
  }

  /**
   * NOTE: 显示/隐藏 section 的核心函数
   */
  function showEvent(sections, eventId) {
    sections.forEach(sec => {
      const visible = sec.eventId === eventId;
      sec.elements.forEach(el => {
        el.style.display = visible ? '' : 'none';
      });
    });
  }

  // ── Hash 状态持久化 ──

  // NOTE: 解析 URL hash 为键值对
  // '#event=444&metric=bao5&tab=history' → {event:'444', metric:'bao5', tab:'history'}
  function parseHash() {
    const h = window.location.hash.slice(1); // 去掉 #
    if (!h) return {};
    const params = {};
    h.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
    });
    return params;
  }

  // NOTE: 合并新参数到当前 hash，用 pushState 写入（支持浏览器后退）
  // replace=true 时用 replaceState（不产生新历史记录，用于初始恢复）
  // 参数顺序固定为 event → metric → tab，与 UI 视觉顺序一致
  function updateHash(newParams, replace) {
    const current = parseHash();
    Object.assign(current, newParams);
    const ORDER = ['event', 'metric', 'tab'];
    const hash = '#' + ORDER
      .filter(k => current[k])
      .map(k => `${k}=${encodeURIComponent(current[k])}`)
      .join('&');
    if (replace) {
      history.replaceState(null, '', hash);
    } else {
      history.pushState(null, '', hash);
    }
  }

  // NOTE: 保存所有选择器的引用，供 popstate 恢复时使用
  let _allSelectors = [];

  // NOTE: 选中选择器中的指定项目按钮
  function selectEventInBar(selector, eventId) {
    const btn = selector.querySelector(`.event-btn[data-event="${eventId}"]`);
    if (btn) {
      selector.querySelectorAll('.event-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      return true;
    }
    return false;
  }

  /**
   * NOTE: 处理 GroupedStatistic 页面（h3 在页面顶层）
   */
  function handleGroupedPage(container, sections) {
    const eventIds = sections.map(s => s.eventId);
    // 去重但保持顺序
    const uniqueIds = [...new Set(eventIds)];
    if (uniqueIds.length < 2) return; // 只有一个项目无需选择器

    const selector = createSelector(uniqueIds, (id) => {
      showEvent(sections, id);
      updateHash({ event: id });
    });

    // NOTE: 插入到第一个 h3 之前
    const firstH3 = sections[0].h3;
    firstH3.parentNode.insertBefore(selector, firstH3);

    // NOTE: 从 hash 恢复项目选择，无 hash 则默认第一个
    const h = parseHash();
    const initEvent = (h.event && uniqueIds.includes(h.event)) ? h.event : uniqueIds[0];
    showEvent(sections, initEvent);
    selectEventInBar(selector, initEvent);
    if (h.event && uniqueIds.includes(h.event)) {
      updateHash({ event: initEvent }, true);
    }

    // 保存引用供 popstate 使用
    _allSelectors.push({
      selector, uniqueIds, sections,
      show: (id) => { showEvent(sections, id); selectEventInBar(selector, id); }
    });
  }

  /**
   * NOTE: 处理 TabUi 页面（h3 在 .stat-panel 容器内）
   * 两个面板共享一个选择器，切换时联动
   * @param {HTMLElement} scope - 限定搜索范围（.metric-panel 或 document）
   */
  function handleTabbedPage(scope) {
    const panels = Array.from(scope.querySelectorAll('.stat-panel'));
    if (panels.length === 0) return;

    // 收集所有面板的 sections
    const panelSections = panels.map(p => collectSections(p));

    // 合并所有面板中出现的 eventId（取并集，保持顺序）
    const allIds = [];
    panelSections.forEach(sections => {
      sections.forEach(s => {
        if (!allIds.includes(s.eventId)) allIds.push(s.eventId);
      });
    });

    if (allIds.length < 2) return;

    const selector = createSelector(allIds, (id) => {
      panelSections.forEach(sections => showEvent(sections, id));
      updateHash({ event: id });
    });

    // NOTE: 插入到 .stat-tabs 之前（项目选择器在最上方）
    const tabBar = scope.querySelector('.stat-tabs');
    if (tabBar) {
      tabBar.parentNode.insertBefore(selector, tabBar);
    } else {
      // fallback: 插入到第一个面板之前
      panels[0].parentNode.insertBefore(selector, panels[0]);
    }

    // NOTE: 从 hash 恢复项目选择
    const h = parseHash();
    const initEvent = (h.event && allIds.includes(h.event)) ? h.event : allIds[0];
    panelSections.forEach(sections => showEvent(sections, initEvent));
    selectEventInBar(selector, initEvent);
    if (h.event && allIds.includes(h.event)) {
      updateHash({ event: initEvent }, true);
    }

    // 保存引用供 popstate 使用
    _allSelectors.push({
      selector, uniqueIds: allIds,
      show: (id) => {
        panelSections.forEach(sections => showEvent(sections, id));
        selectEventInBar(selector, id);
      }
    });
  }

  // NOTE: 给 tab/metric 按钮叠加 click 监听，写入 hash
  function attachHashTracking() {
    // Tab 按钮：提取 tab id 后缀（'wao5-history' → 'history'，'ranking' → 'ranking'）
    // NOTE: 后缀永远只有 ranking 或 history，避免与 metric 参数冗余
    document.querySelectorAll('.stat-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const onclick = btn.getAttribute('onclick') || '';
        const m = onclick.match(/switchTab\(event,\s*'(.+?)'\)/);
        if (m) {
          const parts = m[1].split('-');
          const suffix = parts[parts.length - 1];
          updateHash({ tab: suffix });
        }
      });
    });

    // Metric 按钮：通过 onclick 属性中的 switchMetric('bao5') 提取 metric id
    document.querySelectorAll('.metric-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const onclick = btn.getAttribute('onclick') || '';
        const m = onclick.match(/switchMetric\('(.+?)'\)/);
        if (m) updateHash({ metric: m[1] });
      });
    });
  }

  // NOTE: 从 URL hash 恢复 tab/metric 状态
  // 需在 init() 之后调用，因为 init() 创建项目选择器 DOM
  function restoreFromHash() {
    const h = parseHash();

    // 恢复 metric 选择（必须在 tab 之前，因为 metric panel 决定了 tab 的 scope）
    if (h.metric && typeof switchMetric === 'function') {
      const btn = document.querySelector(`.metric-btn[onclick*="switchMetric('${h.metric}')"]`);
      if (btn) btn.click();
    }

    // 恢复 tab 选择——hash 中存的是后缀（ranking/history），需匹配 tab ID 末尾
    if (h.tab && typeof switchTab === 'function') {
      const scope = document.querySelector('.metric-panel.active') || document;
      scope.querySelectorAll('.stat-tab').forEach(btn => {
        const onclick = btn.getAttribute('onclick') || '';
        const m = onclick.match(/switchTab\(event,\s*'(.+?)'\)/);
        if (m && m[1].split('-').pop() === h.tab) btn.click();
      });
    }
  }

  // NOTE: 浏览器前进/后退时恢复状态
  function setupPopstate() {
    window.addEventListener('popstate', () => {
      const h = parseHash();

      // 恢复项目选择
      if (h.event) {
        _allSelectors.forEach(s => {
          if (s.uniqueIds.includes(h.event)) s.show(h.event);
        });
      }

      // 恢复 metric
      if (h.metric && typeof switchMetric === 'function') {
        const btn = document.querySelector(`.metric-btn[onclick*="switchMetric('${h.metric}')"]`);
        if (btn) btn.click();
      }

      // 恢复 tab（hash 存后缀，匹配 tab ID 末尾）
      if (h.tab && typeof switchTab === 'function') {
        const scope = document.querySelector('.metric-panel.active') || document;
        scope.querySelectorAll('.stat-tab').forEach(btn => {
          const onclick = btn.getAttribute('onclick') || '';
          const m = onclick.match(/switchTab\(event,\s*'(.+?)'\)/);
          if (m && m[1].split('-').pop() === h.tab) btn.click();
        });
      }
    });
  }

  /**
   * NOTE: 处理 Metric 聚合页面（如 wr_metric、wr_aoxr）
   * 收集所有 metric panel 的 sections，创建一个共享的项目选择器
   * 插入到 .metric-selector 之前（视觉上在最顶部）
   */
  function handleMetricPage(metricPanels) {
    // 收集所有 metric panel 内所有 stat-panel 的 sections
    const allPanelSections = [];
    metricPanels.forEach(mp => {
      const panels = Array.from(mp.querySelectorAll('.stat-panel'));
      panels.forEach(p => {
        const sections = collectSections(p);
        if (sections.length > 0) allPanelSections.push(sections);
      });
    });

    // 合并所有 eventId（取并集，保持顺序）
    const allIds = [];
    allPanelSections.forEach(sections => {
      sections.forEach(s => {
        if (!allIds.includes(s.eventId)) allIds.push(s.eventId);
      });
    });

    if (allIds.length < 2) return;

    const selector = createSelector(allIds, (id) => {
      allPanelSections.forEach(sections => showEvent(sections, id));
      updateHash({ event: id });
    });

    // NOTE: 插入到 .metric-selector 之前（项目选择器在最顶部）
    const metricSelector = document.querySelector('.metric-selector');
    if (metricSelector) {
      metricSelector.parentNode.insertBefore(selector, metricSelector);
    } else {
      // fallback: 插入到第一个 metric-panel 之前
      metricPanels[0].parentNode.insertBefore(selector, metricPanels[0]);
    }

    // NOTE: 从 hash 恢复项目选择
    const h = parseHash();
    const initEvent = (h.event && allIds.includes(h.event)) ? h.event : allIds[0];
    allPanelSections.forEach(sections => showEvent(sections, initEvent));
    selectEventInBar(selector, initEvent);
    if (h.event && allIds.includes(h.event)) {
      updateHash({ event: initEvent }, true);
    }

    // 保存引用供 popstate 使用
    _allSelectors.push({
      selector, uniqueIds: allIds,
      show: (id) => {
        allPanelSections.forEach(sections => showEvent(sections, id));
        selectEventInBar(selector, id);
      }
    });
  }

  /**
   * NOTE: 入口 — DOMContentLoaded 时执行
   */
  function init() {
    // 检测是否在 /stats/ 路径下
    if (!window.location.pathname.includes('/stats/')) return;

    // NOTE: 优先检测 metric-panel 结构（Metric / AoXR 聚合页面）
    // 收集所有 metric panel 的 sections，创建一个共享选择器插到 .metric-selector 之前
    const metricPanels = document.querySelectorAll('.metric-panel');
    if (metricPanels.length > 0) {
      handleMetricPage(metricPanels);
      attachHashTracking();
      restoreFromHash();
      setupPopstate();
      return;
    }

    const panels = document.querySelectorAll('.stat-panel');
    if (panels.length > 0) {
      // 普通 TabUi 页面
      handleTabbedPage(document);
      attachHashTracking();
      restoreFromHash();
      setupPopstate();
    } else {
      // GroupedStatistic 页面 — 在 .container 或 body 下查找 h3
      const container = document.querySelector('.container') || document.body;
      const sections = collectSections(container);
      if (sections.length >= 2) {
        handleGroupedPage(container, sections);
        setupPopstate();
      }
    }
  }

  // NOTE: 注入选择器样式
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .event-selector {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 12px;
        margin: 12px 0;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .event-btn {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid transparent;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.05);
        cursor: pointer;
        transition: all 0.2s ease;
        padding: 0;
      }
      .event-btn .cubing-icon {
        font-size: 22px;
        color: #aaa;
        transition: color 0.2s ease;
      }
      .event-btn:hover {
        background: rgba(255, 255, 255, 0.10);
        border-color: rgba(255, 255, 255, 0.12);
      }
      .event-btn:hover .cubing-icon {
        color: #ddd;
      }
      .event-btn.active {
        background: #2e7d32;
        border-color: #4caf50;
      }
      .event-btn.active .cubing-icon {
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { injectStyles(); init(); });
  } else {
    injectStyles();
    init();
  }
})();

