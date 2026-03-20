// NOTE: 共享 WCA 选手搜索下拉组件
// 供 calc / recon / viz 三方统一使用
// 依赖：shared/wca_search.js（WcaSearch 全局对象）

(function () {
  'use strict';

  /**
   * NOTE: 创建选手搜索 Picker 实例
   * @param {HTMLElement} containerEl - 容器元素（组件会追加到其内部）
   * @param {Object} options
   * @param {string}   [options.placeholder] - 输入框 placeholder
   * @param {Function} options.onSelect - 选中选手时回调 ({wcaId, name, iso2, avatarUrl})
   * @param {string}   [options.mode] - 'inline'（嵌入式）或 'modal'（弹窗式，默认）
   * @returns {{ open: Function, close: Function, destroy: Function }}
   */
  function create(containerEl, options) {
    var opts = options || {};
    var mode = opts.mode || 'modal';
    var placeholder = opts.placeholder || 'Search by name or WCA ID...';

    // ─── 构建 DOM ───
    var overlay = document.createElement('div');
    overlay.className = 'wca-pp-overlay';
    overlay.style.display = mode === 'inline' ? 'block' : 'none';

    var modal = document.createElement('div');
    modal.className = 'wca-pp-modal';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'wca-pp-input';
    input.placeholder = placeholder;
    input.autocomplete = 'off';

    var results = document.createElement('div');
    results.className = 'wca-pp-results';

    modal.appendChild(input);
    modal.appendChild(results);
    overlay.appendChild(modal);
    containerEl.appendChild(overlay);

    var debounce = null;

    // ─── 搜索逻辑 ───
    input.addEventListener('input', function () {
      var q = this.value.trim();
      clearTimeout(debounce);
      // NOTE: 中文 1 字符起搜，拉丁 2 字符
      var minLen = /[^\x00-\x7F]/.test(q) ? 1 : 2;
      if (q.length < minLen) { results.innerHTML = ''; return; }

      // NOTE: 显示 loading
      results.innerHTML = '<div class="wca-pp-loading"><span class="wca-pp-spinner"></span>Searching...</div>';

      debounce = setTimeout(async function () {
        if (overlay.style.display === 'none' && mode === 'modal') return;
        var list = await WcaSearch.searchPersons(q);
        // NOTE: 搜索期间用户可能已关闭
        if (overlay.style.display === 'none' && mode === 'modal') return;

        if (!list || list.length === 0) {
          results.innerHTML = '<div class="wca-pp-empty">No results</div>';
          return;
        }
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
        // NOTE: 保存引用供点击时取数据
        results._data = list;
      }, 300);
    });

    // NOTE: 点击搜索结果项 → 选中
    results.addEventListener('click', function (e) {
      var item = e.target.closest('.wca-pp-item');
      if (!item || !results._data) return;
      var idx = parseInt(item.dataset.idx);
      var person = results._data[idx];
      if (opts.onSelect) opts.onSelect(person);
      if (mode === 'modal') close();
    });

    // NOTE: modal 模式：点击遮罩关闭
    if (mode === 'modal') {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) close();
      });
      overlay.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
      });
    }

    // ─── 公开方法 ───
    function open(anchorEl) {
      input.value = '';
      results.innerHTML = '';
      // NOTE: modal 模式下定位到锚点元素旁
      if (mode === 'modal' && anchorEl) {
        var rect = anchorEl.getBoundingClientRect();
        modal.style.top = rect.bottom + 4 + 'px';
        modal.style.left = rect.left + 'px';
      }
      overlay.style.display = 'block';
      setTimeout(function () { input.focus(); }, 100);
    }

    function close() {
      overlay.style.display = 'none';
      input.value = '';
      results.innerHTML = '';
    }

    function destroy() {
      clearTimeout(debounce);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    return { open: open, close: close, destroy: destroy };
  }

  // ─── 工具 ───
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
              .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.WcaPersonPicker = { create: create };
})();
