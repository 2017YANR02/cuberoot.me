// NOTE: 共享 WCA 比赛数据模块
// 供 recon / viz 等多方统一使用
// 职责：加载比赛 JSON（日期、国家、中文名、WCA ID）、搜索、国旗 HTML 构建
// 暴露为 window.WcaCompData（非 ES module，兼容所有消费者）

(function () {
  'use strict';

  // NOTE: 内部缓存——只 fetch 一次，多次 load 直接返回
  var _loaded = false;
  var _loadPromise = null;
  var _dateMap = {};     // compName → "YYYY-MM-DD"
  var _countryMap = {};  // compName → "xx" (iso2 小写)
  var _namesZh = {};     // compName → 中文名
  var _wcaIdMap = {};    // compName / fullName → WCA CompID
  var _allComps = [];    // [{name, date, iso2, nameZh, nameAlt}] 按日期倒序

  /**
   * NOTE: 一次性加载全部比赛数据（4 个 JSON 并行 fetch）
   * 多次调用只 fetch 一次，后续返回缓存
   * @returns {Promise<void>}
   */
  function load() {
    if (_loadPromise) return _loadPromise;

    _loadPromise = Promise.all([
      fetch('/stats/comp_dates.json').then(function (r) { return r.json(); }),
      fetch('/stats/comp_name_countries.json').then(function (r) { return r.json(); }),
      fetch('/recon/comp_names_zh.json').then(function (r) { return r.json(); }).catch(function () { return {}; }),
      fetch('/stats/comp_name_to_wca_id.json').then(function (r) { return r.json(); }).catch(function () { return {}; })
    ]).then(function (results) {
      _dateMap = results[0];
      _countryMap = results[1];
      _namesZh = results[2];
      _wcaIdMap = results[3];

      // NOTE: 构建 cell_name → name 别名映射（搜索用）
      var wcaIdToCellName = {};
      var wcaIdToFullName = {};
      Object.keys(_wcaIdMap).forEach(function (k) {
        var wcaId = _wcaIdMap[k];
        if (_dateMap[k]) {
          wcaIdToCellName[wcaId] = k;
        } else {
          wcaIdToFullName[wcaId] = k;
        }
      });
      var compAliases = {};
      Object.keys(wcaIdToCellName).forEach(function (wcaId) {
        if (wcaIdToFullName[wcaId]) {
          compAliases[wcaIdToCellName[wcaId]] = wcaIdToFullName[wcaId];
        }
      });

      // NOTE: 全量比赛列表（按日期倒序 + 同日按名称字母序）
      _allComps = Object.keys(_dateMap)
        .filter(function (name) { return name.indexOf('?') < 0; })
        .map(function (name) {
          return {
            name: name,
            date: _dateMap[name],
            iso2: (_countryMap[name] || '').toLowerCase(),
            nameZh: _namesZh[name] || '',
            nameAlt: compAliases[name] || ''
          };
        })
        .sort(function (a, b) {
          var dc = b.date.localeCompare(a.date);
          return dc !== 0 ? dc : a.name.localeCompare(b.name);
        });

      _loaded = true;
    });

    return _loadPromise;
  }

  /** 获取比赛的 ISO2 国家码（小写） */
  function getCountry(compName) {
    return (_countryMap[compName] || '').toLowerCase();
  }

  /** 获取比赛日期 */
  function getDate(compName) {
    return _dateMap[compName] || '';
  }

  /** 获取比赛中文名 */
  function getNameZh(compName) {
    return _namesZh[compName] || '';
  }

  /** 获取比赛的 WCA 官方 ID */
  function getWcaId(compName) {
    return _wcaIdMap[compName] || '';
  }

  /** 获取比赛→国家码映射表（供不想按单个查询的消费者使用） */
  function getCountryMap() {
    return _countryMap;
  }

  /** 获取比赛中文名映射表 */
  function getNamesZh() {
    return _namesZh;
  }

  /** 获取比赛→WCA ID 映射表 */
  function getWcaIdMap() {
    return _wcaIdMap;
  }

  /** 获取全量比赛数组（已排序） */
  function getAll() {
    return _allComps;
  }

  /**
   * NOTE: 获取近期比赛（默认 30 天内 + 不超过今天）
   * @param {number} [days=30]
   */
  function getRecent(days) {
    if (!days) days = 30;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    var cutoffStr = cutoff.toISOString().split('T')[0];
    var today = new Date().toISOString().split('T')[0];
    return _allComps.filter(function (c) {
      return c.date >= cutoffStr && c.date <= today;
    });
  }

  /**
   * NOTE: 关键字搜索（名称 / 日期 / 中文名 / 全称别名）
   * @param {Array} comps - 比赛数组（可以是 getAll / getRecent 的结果）
   * @param {string} query - 搜索关键字
   */
  function search(comps, query) {
    var q = query.toLowerCase();
    if (!q) return comps;
    return comps.filter(function (c) {
      return c.name.toLowerCase().indexOf(q) >= 0 ||
        c.date.indexOf(q) >= 0 ||
        (c.nameZh && c.nameZh.indexOf(query) >= 0) ||
        (c.nameAlt && c.nameAlt.toLowerCase().indexOf(q) >= 0);
    });
  }

  /** 根据名称精确查找比赛 */
  function find(compName) {
    for (var i = 0; i < _allComps.length; i++) {
      if (_allComps[i].name === compName) return _allComps[i];
    }
    return null;
  }

  /**
   * NOTE: 构建比赛 HTML 片段（国旗 + 日期 + 名称）
   * @param {string} name - 比赛名
   * @param {string} date - 日期
   * @param {string} iso2 - ISO2 国家码（小写）
   * @param {Object} [opts] - 可选配置
   * @param {boolean} [opts.useZh] - 是否使用中文名
   * @returns {string} HTML
   */
  function buildHtml(name, date, iso2, opts) {
    opts = opts || {};
    var flag = iso2 ? '<span class="fi fi-' + iso2 + '"></span> ' : '';
    var zhName = _namesZh[name];
    var useZh = opts.useZh !== undefined ? opts.useZh : false;
    var displayName = (useZh && zhName) ? zhName : name;
    // NOTE: 有中文名时加 data-i18n 属性，切换语言后 i18n 自动更新文本
    var nameSpan = zhName
      ? '<span data-i18n-en="' + escapeHtml(name) + '" data-i18n-zh="' + escapeHtml(zhName) + '">' + escapeHtml(displayName) + '</span>'
      : '<span>' + escapeHtml(displayName) + '</span>';
    return '<small>' + date + '</small>' + flag + nameSpan;
  }

  /**
   * NOTE: 纯国旗 HTML（最简用法，不需要日期和名称时使用）
   * @param {string} iso2 - ISO2 国家码（小写）
   * @returns {string} HTML
   */
  function flagHtml(iso2) {
    return iso2 ? '<span class="fi fi-' + iso2.toLowerCase() + '"></span>' : '';
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
              .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** 是否已加载完成 */
  function isLoaded() { return _loaded; }

  window.WcaCompData = {
    load: load,
    isLoaded: isLoaded,
    getCountry: getCountry,
    getDate: getDate,
    getNameZh: getNameZh,
    getWcaId: getWcaId,
    getCountryMap: getCountryMap,
    getNamesZh: getNamesZh,
    getWcaIdMap: getWcaIdMap,
    getAll: getAll,
    getRecent: getRecent,
    search: search,
    find: find,
    buildHtml: buildHtml,
    flagHtml: flagHtml
  };
})();
