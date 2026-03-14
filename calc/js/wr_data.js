// NOTE: WR 数据加载模块 — fetch calc/data/wr.json 并提供查询 API
// JSON 由 CI 每周自动刷新（_stats_build/bin/gen_wr_json.rb）

var wrData = null; // { eventId: { single, average, bpa, wpa } }（centiseconds）

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
        wrData = {};
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
