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

  /**
   * NOTE: 处理 GroupedStatistic 页面（h3 在页面顶层）
   */
  function handleGroupedPage(container, sections) {
    const eventIds = sections.map(s => s.eventId);
    // 去重但保持顺序
    const uniqueIds = [...new Set(eventIds)];
    if (uniqueIds.length < 2) return; // 只有一个项目无需选择器

    const selector = createSelector(uniqueIds, (id) => showEvent(sections, id));

    // NOTE: 插入到第一个 h3 之前
    const firstH3 = sections[0].h3;
    firstH3.parentNode.insertBefore(selector, firstH3);

    // 默认只显示第一个项目
    showEvent(sections, uniqueIds[0]);
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
    });

    // NOTE: 插入到 scope 内的 .stat-tabs 按钮栏之后
    const tabBar = scope.querySelector('.stat-tabs');
    if (tabBar) {
      tabBar.parentNode.insertBefore(selector, tabBar.nextSibling);
    } else {
      // fallback: 插入到第一个面板之前
      panels[0].parentNode.insertBefore(selector, panels[0]);
    }

    // 默认只显示第一个项目
    panelSections.forEach(sections => showEvent(sections, allIds[0]));
  }

  /**
   * NOTE: 入口 — DOMContentLoaded 时执行
   */
  function init() {
    // 检测是否在 /stats/ 路径下
    if (!window.location.pathname.includes('/stats/')) return;

    // NOTE: 优先检测 metric-panel 结构（Metric / AoXR 聚合页面）
    // 每个 metric-panel 内有独立的 .stat-panel，需各自创建选择器
    const metricPanels = document.querySelectorAll('.metric-panel');
    if (metricPanels.length > 0) {
      metricPanels.forEach(mp => handleTabbedPage(mp));
      return;
    }

    const panels = document.querySelectorAll('.stat-panel');
    if (panels.length > 0) {
      // 普通 TabUi 页面
      handleTabbedPage(document);
    } else {
      // GroupedStatistic 页面 — 在 .container 或 body 下查找 h3
      const container = document.querySelector('.container') || document.body;
      const sections = collectSections(container);
      if (sections.length >= 2) {
        handleGroupedPage(container, sections);
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
