// NOTE: WR 数据加载模块 — fetch calc/data/wr.json 并提供查询 API
// JSON 由 CI 每周自动刷新（_stats_build/bin/gen_wr_json.rb）

var wrData = null; // { eventId: { single, average, bpa, wpa, ao100_1, ao100_2 } }（centiseconds）
var ao100Times = null; // { eventId: { times_1: [...], times_2: [...] } }（centiseconds）

/**
 * NOTE: 加载 WR 数据
 * 只在第一次调用时 fetch，后续使用缓存
 */
export async function load() {
    if (wrData) return;
    try {
        var [wrResp, timesResp] = await Promise.all([
            fetch('data/wr.json'),
            fetch('data/ao100_times.json')
        ]);
        wrData = await wrResp.json();
        ao100Times = await timesResp.json();
    } catch (e) {
        console.warn('WR data load failed:', e);
        wrData = wrData || {};
        ao100Times = ao100Times || {};
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
    if (!wrData || !wrData[eventId]) return null;
    var a1 = wrData[eventId]['ao100_1'];
    var a2 = wrData[eventId]['ao100_2'];
    if (!a1 || !a2) return null;
    return [a1, a2];
}

/**
 * NOTE: 获取 KDE 分布的期望值（ao100 times 数组的算术均值）
 * 这是 KDE 采样的真正 μ，反映选手当前日常水平
 * @returns {[number, number]|null} [mean_1, mean_2] centiseconds
 */
export function getKdeMean(eventId) {
    if (!ao100Times || !ao100Times[eventId]) return null;
    var result = [];
    for (var k of ['times_1', 'times_2']) {
        var times = ao100Times[eventId][k];
        if (!times || times.length < 10) return null;
        var sum = 0;
        for (var i = 0; i < times.length; i++) sum += times[i];
        result.push(sum / times.length);
    }
    return result;
}

/**
 * NOTE: KDE 采样 — 基于真实成绩的平滑 Bootstrap
 * 从指定选手的 100 个真实成绩中随机选一个，加高斯核扰动，实现连续采样
 * 带宽 h 用 Silverman 规则自动计算：h = 0.9 * min(σ, IQR/1.34) * n^(-0.2)
 * @param {string} eventId
 * @param {number} playerIdx - 0 = 世界 #1，1 = 世界 #2
 * @returns {number} centiseconds（下限 1），无数据返回 null
 */
export function sampleKDE(eventId, playerIdx) {
    if (!ao100Times || !ao100Times[eventId]) return null;
    var key = playerIdx === 0 ? 'times_1' : 'times_2';
    var times = ao100Times[eventId][key];
    if (!times || times.length < 10) return null;

    // NOTE: 计算 Silverman 带宽
    var n = times.length;
    var sorted = [...times].sort((a, b) => a - b);
    var mean = sorted.reduce((s, v) => s + v, 0) / n;
    var variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    var sigma = Math.sqrt(variance);
    var q1 = sorted[Math.floor(n * 0.25)];
    var q3 = sorted[Math.floor(n * 0.75)];
    var iqr = q3 - q1;
    var h = 0.9 * Math.min(sigma, iqr / 1.34) * Math.pow(n, -0.2);

    // NOTE: 随机选一个真实成绩 + 高斯核扰动
    var baseTime = times[Math.floor(Math.random() * n)];
    // Box-Muller 生成标准正态随机数
    var u1 = Math.random(), u2 = Math.random();
    var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    var result = Math.round(baseTime + h * z);
    return Math.max(1, result); // NOTE: 下限 0.01s
}
