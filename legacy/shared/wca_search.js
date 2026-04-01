// NOTE: 共享 WCA 搜索 API 模块
// 供 calc / recon / viz 三方统一使用
// 暴露为 window.WcaSearch（非 ES module，兼容所有消费者）

(function () {
  'use strict';

  var API_BASE = 'https://www.worldcubeassociation.org/api/v0';
  // NOTE: sessionStorage 缓存 key 前缀 — 同一会话不重复请求
  var CACHE_PREFIX = 'wca_shared_';

  // ─── 内部工具 ───

  function cacheGet(key) {
    try {
      var raw = sessionStorage.getItem(CACHE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function cacheSet(key, data) {
    try { sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data)); }
    catch (e) { /* 容量超限静默失败 */ }
  }

  // ─── 公开 API ───

  /**
   * NOTE: 搜索 WCA 选手（调用官方搜索 API）
   * @param {string} query - 搜索关键词（名字或 WCA ID）
   * @returns {Promise<Array<{wcaId: string, name: string, iso2: string, avatarUrl: string}>>}
   */
  async function searchPersons(query) {
    try {
      var resp = await fetch(API_BASE + '/search/users?q=' + encodeURIComponent(query) + '&persons_table=true');
      if (!resp.ok) return [];
      var data = await resp.json();
      if (!data.result) return [];
      return data.result.map(function (p) {
        return {
          wcaId: p.wca_id || '',
          name: p.name || '',
          iso2: (p.country_iso2 || '').toLowerCase(),
          avatarUrl: (p.avatar && !p.avatar.is_default) ? p.avatar.thumb_url : ''
        };
      });
    } catch (e) {
      console.warn('WCA person search failed:', e);
      return [];
    }
  }

  /**
   * NOTE: 获取选手全部历史成绩（带缓存）
   * 返回 API 原始数组，包含 attempts[], event_id, competition_id, round_type_id 等
   * @param {string} wcaId
   * @returns {Promise<Array|null>}
   */
  async function fetchResults(wcaId) {
    var cached = cacheGet('results_' + wcaId);
    if (cached) return cached;

    try {
      var resp = await fetch(API_BASE + '/persons/' + wcaId + '/results');
      if (!resp.ok) throw new Error('WCA API error: ' + resp.status);
      var data = await resp.json();
      cacheSet('results_' + wcaId, data);
      return data;
    } catch (e) {
      console.warn('WCA results fetch failed:', e);
      return null;
    }
  }

  /**
   * NOTE: 获取选手参加的比赛列表（含 start_date，用于时间排序）
   * @param {string} wcaId
   * @returns {Promise<Array<{id: string, name: string, start_date: string}>|null>}
   */
  async function fetchCompetitions(wcaId) {
    var cached = cacheGet('comps_' + wcaId);
    if (cached) return cached;

    try {
      var resp = await fetch(API_BASE + '/persons/' + wcaId + '/competitions');
      if (!resp.ok) throw new Error('WCA API error: ' + resp.status);
      var data = await resp.json();
      cacheSet('comps_' + wcaId, data);
      return data;
    } catch (e) {
      console.warn('WCA competitions fetch failed:', e);
      return null;
    }
  }

  /**
   * NOTE: 获取选手头像 URL（通过 /persons/{id} API）
   * @param {string} wcaId
   * @returns {Promise<string>} 头像 URL 或空字符串
   */
  async function fetchAvatar(wcaId) {
    var cached = cacheGet('avatar_' + wcaId);
    if (cached !== null) return cached;

    try {
      var resp = await fetch(API_BASE + '/persons/' + wcaId);
      if (!resp.ok) return '';
      var data = await resp.json();
      var url = (data.person && data.person.avatar && data.person.avatar.thumb_url) || '';
      cacheSet('avatar_' + wcaId, url);
      return url;
    } catch (e) {
      return '';
    }
  }

  /**
   * NOTE: 获取指定项目的最近 N 个有效单次 + Ao100（兼容 calc 原有接口）
   * @param {string} wcaId
   * @param {string} eventId - 项目 ID（如 '333'）
   * @param {number} [maxSolves=100] - 最多取多少个
   * @returns {Promise<{times: number[], ao100: number, averagePR: number|null, name: string, country: string}|null>}
   */
  async function fetchUserTimes(wcaId, eventId, maxSolves) {
    if (!maxSolves) maxSolves = 100;
    var allResults = await fetchResults(wcaId);
    if (!allResults) return null;

    // NOTE: 过滤当前项目 + 按时间倒序（API 按时间正序返回）
    var eventResults = [];
    for (var i = allResults.length - 1; i >= 0; i--) {
      if (allResults[i].event_id === eventId) eventResults.push(allResults[i]);
    }

    // NOTE: 从每轮的 attempts 中提取有效单次（>0 = 非 DNF/DNS/空）
    var validSolves = [];
    for (var r = 0; r < eventResults.length && validSolves.length < maxSolves; r++) {
      var attempts = eventResults[r].attempts;
      if (!attempts) continue;
      for (var a = 0; a < attempts.length && validSolves.length < maxSolves; a++) {
        if (attempts[a] > 0) validSolves.push(attempts[a]);
      }
    }

    if (validSolves.length < 5) return null;

    // NOTE: Ao100 trimmed average
    var sorted = validSolves.slice().sort(function (a, b) { return a - b; });
    var n = sorted.length;
    var trim = Math.ceil(n * 0.05);
    var mid = sorted.slice(trim, n - trim);
    var ao100 = Math.round(mid.reduce(function (s, v) { return s + v; }, 0) / mid.length);

    // NOTE: 官方最好 average
    var avgPR = null;
    for (var j = 0; j < eventResults.length; j++) {
      var avg = eventResults[j].average;
      if (avg > 0 && (avgPR === null || avg < avgPR)) avgPR = avg;
    }

    return {
      times: validSolves,
      ao100: ao100,
      averagePR: avgPR,
      name: eventResults[0].name || wcaId,
      country: eventResults[0].country_iso2 || ''
    };
  }

  // NOTE: 暴露为全局对象
  window.WcaSearch = {
    searchPersons: searchPersons,
    fetchResults: fetchResults,
    fetchCompetitions: fetchCompetitions,
    fetchAvatar: fetchAvatar,
    fetchUserTimes: fetchUserTimes
  };
})();
