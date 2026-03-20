/**
 * NOTE: 共享 WCA 选手搜索 Picker 组件
 * 供 calc / recon / viz 三方统一使用
 * 依赖：shared/wca_search.js（WcaSearch 全局对象）
 *
 * 两种模式：
 *   modal  — 全屏遮罩 + 居中卡片（calc 使用，点头像触发）
 *   inline — 锚定到宿主输入框的下拉面板（viz / recon 使用）
 */
(function () {
  'use strict';

  /**
   * @param {HTMLElement} containerEl - 容器元素
   * @param {Object} options
   * @param {string}   [options.placeholder] - 输入框 placeholder
   * @param {Function} options.onSelect - 选中回调 ({wcaId, name, iso2, avatarUrl})
   * @param {string}   [options.mode] - 'modal'（默认）或 'inline'
   * @returns {{ open, close, destroy, setDisplay }}
   */
  function create(containerEl, options) {
    var opts = options || {};
    var mode = opts.mode || 'modal';
    var placeholder = opts.placeholder || 'Search by name or WCA ID...';
    var debounceTimer = null;
    var isOpen = false;

    // ─── 搜索引擎（共享核心）───
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'wca-pp-input';
    input.placeholder = placeholder;
    input.autocomplete = 'off';

    var results = document.createElement('div');
    results.className = 'wca-pp-results';

    // NOTE: 根据模式构建不同容器 DOM
    var wrapper, overlay;

    if (mode === 'modal') {
      // ── modal 模式：fixed overlay + 居中卡片 ──
      overlay = document.createElement('div');
      overlay.className = 'wca-pp-overlay';
      overlay.style.display = 'none';

      var modal = document.createElement('div');
      modal.className = 'wca-pp-modal';
      modal.appendChild(input);
      modal.appendChild(results);
      overlay.appendChild(modal);
      containerEl.appendChild(overlay);
      wrapper = overlay;

      // 点遮罩关闭
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) close();
      });
      overlay.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
      });
    } else {
      // ── inline 模式：相对定位容器 + 下拉面板 ──
      var host = document.createElement('div');
      host.className = 'wca-pp-host';

      var dropdown = document.createElement('div');
      dropdown.className = 'wca-pp-dropdown';
      dropdown.style.display = 'none';
      dropdown.appendChild(results);

      host.appendChild(input);
      host.appendChild(dropdown);
      containerEl.appendChild(host);
      wrapper = host;

      // focus 时展开
      input.addEventListener('focus', function () {
        dropdown.style.display = 'block';
        isOpen = true;
      });

      // blur 时收起（延迟，让 click 事件先触发）
      input.addEventListener('blur', function () {
        setTimeout(function () {
          dropdown.style.display = 'none';
          isOpen = false;
        }, 200);
      });
    }

    // ─── 搜索逻辑（两种模式共享）───
    input.addEventListener('input', function () {
      var q = this.value.trim();
      clearTimeout(debounceTimer);
      // NOTE: 中文 1 字符起搜，拉丁 2 字符
      var minLen = /[^\x00-\x7F]/.test(q) ? 1 : 2;
      if (q.length < minLen) { results.innerHTML = ''; return; }

      results.innerHTML = '<div class="wca-pp-loading"><span class="wca-pp-spinner"></span>Searching...</div>';

      debounceTimer = setTimeout(async function () {
        var list = await WcaSearch.searchPersons(q);
        if (!list || list.length === 0) {
          results.innerHTML = '<div class="wca-pp-empty">No results</div>';
          return;
        }
        renderResults(list);
      }, 300);
    });

    // ─── 渲染结果（三方统一样式）───
    function renderResults(list) {
      var html = '';
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var flag = p.iso2 ? '<span class="fi fi-' + p.iso2 + '"></span>' : '';
        html += '<div class="wca-pp-item" data-idx="' + i + '">' +
          flag +
          '<span class="wca-pp-wcaid">' + p.wcaId + '</span>' +
          '<span class="wca-pp-name">' + escapeHtml(p.name) + '</span></div>';
      }
      results.innerHTML = html;
      results._data = list;
    }

    // ─── 点击选中 ───
    results.addEventListener('click', function (e) {
      var item = e.target.closest('.wca-pp-item');
      if (!item || !results._data) return;
      var idx = parseInt(item.dataset.idx);
      var person = results._data[idx];
      if (opts.onSelect) opts.onSelect(person);
      if (mode === 'modal') close();
      if (mode === 'inline') {
        // 选中后显示选手名片，清空 dropdown
        showSelectedDisplay(person);
      }
    });

    // ─── inline 模式：选中后的富显示（国旗 + 名字） ───
    var selectedDisplay = null;

    function showSelectedDisplay(person) {
      input.style.display = 'none';
      if (!selectedDisplay) {
        selectedDisplay = document.createElement('div');
        selectedDisplay.className = 'wca-pp-selected';
        // NOTE: 点击名片重新搜索
        selectedDisplay.addEventListener('click', function () {
          selectedDisplay.style.display = 'none';
          input.style.display = '';
          input.value = '';
          input.focus();
        });
        input.parentNode.insertBefore(selectedDisplay, input.nextSibling);
      }
      var flag = person.iso2 ? '<span class="fi fi-' + person.iso2 + '"></span> ' : '';
      selectedDisplay.innerHTML = flag +
        '<span class="wca-pp-wcaid">' + person.wcaId + '</span> ' +
        '<span>' + escapeHtml(person.name) + '</span>' +
        '<span class="wca-pp-change">✕</span>';
      selectedDisplay.style.display = 'flex';
      results.innerHTML = '';
    }

    /**
     * NOTE: 外部设置当前显示的选手（load 后回填用）
     */
    function setDisplay(person) {
      if (mode === 'inline' && person) {
        showSelectedDisplay(person);
      }
    }

    // ─── 公开方法 ───
    function open() {
      if (mode === 'modal' && overlay) {
        input.value = '';
        results.innerHTML = '';
        overlay.style.display = 'flex';
        setTimeout(function () { input.focus(); }, 100);
      }
      if (mode === 'inline') {
        input.focus();
      }
      isOpen = true;
    }

    function close() {
      if (mode === 'modal' && overlay) {
        overlay.style.display = 'none';
      }
      input.value = '';
      results.innerHTML = '';
      isOpen = false;
    }

    function destroy() {
      clearTimeout(debounceTimer);
      if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    }

    return { open: open, close: close, destroy: destroy, setDisplay: setDisplay };
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
              .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.WcaPersonPicker = { create: create };
})();
