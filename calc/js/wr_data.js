// NOTE: WR 数据加载模块 — fetch calc/data/wr.json 并提供查询 API
// JSON 由 CI 每周自动刷新（_stats_build/bin/gen_wr_json.rb）
// 包含：WR 值、Ao100 trimmed average、100 个原始成绩（KDE 采样用）
// 支持 playerOverride — 登录用户可用个人数据替代世界 #1/#2

var wrData = null; // { eventId: { single, average, ..., ao100_1, ao100_2, times_1: [...], times_2: [...] } }

// NOTE: 个人数据覆盖 — playerOverride[0/1] = { times: [...], ao100: N, name, country } | null
// 设置后，sampleKDE / getAo100 / getKdeMean 自动使用个人数据
var playerOverride = [null, null];

/** 覆盖指定 player 的 KDE 数据源为用户个人数据 */
export function setPlayerOverride(playerIdx, data) {
    playerOverride[playerIdx] = data;
    // NOTE: 清除该 player 的带宽缓存 — 新数据需要重新计算
    for (var key in bandwidthCache) {
        if (key.endsWith('_' + playerIdx)) delete bandwidthCache[key];
    }
}

/** 清除指定 player 的覆盖，恢复世界 #1/#2 数据 */
export function clearPlayerOverride(playerIdx) {
    playerOverride[playerIdx] = null;
    for (var key in bandwidthCache) {
        if (key.endsWith('_' + playerIdx)) delete bandwidthCache[key];
    }
}

/** 获取指定 player 的覆盖数据（用于 UI 显示用户名等） */
export function getPlayerOverride(playerIdx) {
    return playerOverride[playerIdx];
}

/**
 * NOTE: 加载 WR 数据
 * 只在第一次调用时 fetch，后续使用缓存
 */
export async function load() {
    if (wrData) return;
    try {
        var resp = await fetch('data/wr.json');
        wrData = await resp.json();
    } catch (e) {
        console.warn('WR data load failed:', e);
        wrData = wrData || {};
    }
}

/**
 * NOTE: 查询是否打破 WR
 * @param {string} eventId - 项目 ID（如 '333'）
 * @param {string} metric  - 指标类型：'single' | 'average' | 'bpa' | 'wpa'
 * @param {number} value   - centiseconds 值
 * @returns {boolean} value ≤ WR 则返回 true
 */
export function isWR(eventId, metric, value) {
    if (!wrData || !wrData[eventId]) return false;
    var wr = wrData[eventId][metric];
    if (wr === undefined || wr <= 0) return false;
    // NOTE: ≤ 而非 < — 平 WR 也算
    return value > 0 && value <= wr;
}

/**
 * NOTE: 获取 WR 值
 * @returns {number|null} centiseconds，无数据返回 null
 */
export function getWR(eventId, metric) {
    if (!wrData || !wrData[eventId]) return null;
    return wrData[eventId][metric] || null;
}

/**
 * NOTE: 获取 Average WR #1 和 #2
 * @returns {[number, number]|null} [average_1, average_2] centiseconds，无数据返回 null
 */
export function getAvgWR12(eventId) {
    if (!wrData || !wrData[eventId]) return null;
    var a1 = wrData[eventId]['average'];
    var a2 = wrData[eventId]['average_2'];
    if (!a1 || !a2) return null;
    return [a1, a2];
}

/**
 * NOTE: 获取 Ao100 世界第 1 和第 2 的值
 * @returns {[number, number]|null} [ao100_1, ao100_2] centiseconds，无数据返回 null
 */
export function getAo100(eventId) {
    // NOTE: 支持混合源 — 每个 player 独立判断 override
    var a1 = playerOverride[0] ? playerOverride[0].ao100
        : (wrData && wrData[eventId] ? wrData[eventId]['ao100_1'] : null);
    var a2 = playerOverride[1] ? playerOverride[1].ao100
        : (wrData && wrData[eventId] ? wrData[eventId]['ao100_2'] : null);
    if (!a1 || !a2) return null;
    return [a1, a2];
}

/**
 * NOTE: 获取 KDE 分布的期望值（ao100 times 数组的算术均值）
 * 这是 KDE 采样的真正 μ，反映选手当前日常水平
 * @returns {[number, number]|null} [mean_1, mean_2] centiseconds
 */
export function getKdeMean(eventId) {
    var result = [];
    for (var p = 0; p < 2; p++) {
        // NOTE: 支持混合源 — 每个 player 独立判断 override
        var times;
        if (playerOverride[p]) {
            times = playerOverride[p].times;
        } else if (wrData && wrData[eventId]) {
            times = wrData[eventId][p === 0 ? 'times_1' : 'times_2'];
        } else {
            return null;
        }
        if (!times || times.length < 10) return null;
        var sum = 0;
        for (var i = 0; i < times.length; i++) sum += times[i];
        result.push(sum / times.length);
    }
    return result;
}

// NOTE: Silverman 带宽缓存 — key = "eventId_playerIdx"
var bandwidthCache = {};

export function sampleKDE(eventId, playerIdx) {
    // NOTE: 优先使用 playerOverride，fallback 到 wrData
    var times;
    if (playerOverride[playerIdx]) {
        times = playerOverride[playerIdx].times;
    } else if (wrData && wrData[eventId]) {
        times = wrData[eventId][playerIdx === 0 ? 'times_1' : 'times_2'];
    }
    if (!times || times.length < 10) return null;

    // NOTE: 带宽缓存 — ao100 数据不变，Silverman 带宽只需算一次
    var cacheKey = eventId + '_' + playerIdx;
    var h = bandwidthCache[cacheKey];
    if (h === undefined) {
        var n = times.length;
        var sorted = [...times].sort((a, b) => a - b);
        var mean = sorted.reduce((s, v) => s + v, 0) / n;
        var variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
        var sigma = Math.sqrt(variance);
        var q1 = sorted[Math.floor(n * 0.25)];
        var q3 = sorted[Math.floor(n * 0.75)];
        var iqr = q3 - q1;
        h = 0.9 * Math.min(sigma, iqr / 1.34) * Math.pow(n, -0.2);
        bandwidthCache[cacheKey] = h;
    }

    // NOTE: 随机选一个真实成绩 + 高斯核扰动
    var baseTime = times[Math.floor(Math.random() * times.length)];
    // Box-Muller 生成标准正态随机数
    var u1 = Math.random(), u2 = Math.random();
    var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    var result = Math.round(baseTime + h * z);
    return Math.max(30, result); // NOTE: 下限 0.30s，避免极端采样产生不合理成绩
}
