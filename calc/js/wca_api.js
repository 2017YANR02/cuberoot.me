// NOTE: WCA API 数据获取模块
// 从 WCA REST API 获取用户历史成绩，提取最近 ≤100 个有效单次用于 KDE 采样（有多少用多少，至少 5 条）
// API 端点：GET /persons/{wcaId}/results（公开，无需 OAuth）

var API_BASE = 'https://www.worldcubeassociation.org/api/v0';
// NOTE: sessionStorage 缓存 key 前缀 — 避免重复请求同一用户
var CACHE_KEY = 'wca_user_results_';

/**
 * NOTE: 获取用户在指定项目的最近 100 个有效单次成绩（centiseconds）
 * @param {string} wcaId - WCA ID（如 '2017GENG01'）
 * @param {string} eventId - 项目 ID（如 '333'）
 * @returns {Promise<{times: number[], ao100: number, name: string, country: string} | null>}
 *   times: 最近 ≤100 个有效单次（centiseconds），按时间倒序
 *   ao100: trimmed average（去头尾各 5%），centiseconds
 *   null: 无数据或获取失败
 */
export async function fetchUserTimes(wcaId, eventId) {
    var allResults = await getAllResults(wcaId);
    if (!allResults) return null;

    // NOTE: 过滤当前项目 + 按比赛时间倒序
    // API 按时间正序返回，反转取最新
    var eventResults = [];
    for (var i = allResults.length - 1; i >= 0; i--) {
        if (allResults[i].event_id === eventId) eventResults.push(allResults[i]);
    }

    // NOTE: 从每轮的 attempts 中提取有效单次（>0 = 非 DNF/DNS/空）
    var validSolves = [];
    for (var r = 0; r < eventResults.length && validSolves.length < 100; r++) {
        var attempts = eventResults[r].attempts;
        if (!attempts) continue;
        for (var a = 0; a < attempts.length && validSolves.length < 100; a++) {
            if (attempts[a] > 0) validSolves.push(attempts[a]);
        }
    }

    if (validSolves.length < 5) return null; // NOTE: 至少需要 5 个成绩才有意义

    // NOTE: Ao100 trimmed average — 去掉头尾各 5% 取均值
    var sorted = [...validSolves].sort((a, b) => a - b);
    var n = sorted.length;
    var trim = Math.ceil(n * 0.05);
    var mid = sorted.slice(trim, n - trim);
    var ao100 = Math.round(mid.reduce((s, v) => s + v, 0) / mid.length);

    // NOTE: averagePR — 该选手在此项目的官方最好 average（所有轮次中最小的有效 average）
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

/**
 * NOTE: 获取用户全部历史成绩（带 sessionStorage 缓存）
 * @returns {Promise<Array|null>} 成绩数组或 null
 */
async function getAllResults(wcaId) {
    // NOTE: 先查 sessionStorage 缓存（同一会话内不重复请求）
    var cacheKey = CACHE_KEY + wcaId;
    var cached = sessionStorage.getItem(cacheKey);
    if (cached) {
        try { return JSON.parse(cached); } catch (e) { /* 缓存损坏，重新请求 */ }
    }

    try {
        var resp = await fetch(API_BASE + '/persons/' + wcaId + '/results');
        if (!resp.ok) throw new Error('WCA API error: ' + resp.status);
        var data = await resp.json();
        // NOTE: 缓存到 sessionStorage — 关闭标签页自动清除
        try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) { /* 容量超限静默失败 */ }
        return data;
    } catch (e) {
        console.warn('WCA API fetch failed:', e);
        return null;
    }
}

/**
 * NOTE: 获取选手头像 URL（通过 /persons/{id} API）
 * @param {string} wcaId - WCA ID
 * @returns {Promise<string>} 头像 URL 或空字符串
 */
export async function fetchPersonAvatar(wcaId) {
    var cacheKey = 'wca_avatar_' + wcaId;
    var cached = sessionStorage.getItem(cacheKey);
    if (cached) return cached;

    try {
        var resp = await fetch(API_BASE + '/persons/' + wcaId);
        if (!resp.ok) return '';
        var data = await resp.json();
        var url = (data.person && data.person.avatar && data.person.avatar.thumb_url) || '';
        try { sessionStorage.setItem(cacheKey, url); } catch (e) { /* ignore */ }
        return url;
    } catch (e) {
        return '';
    }
}
