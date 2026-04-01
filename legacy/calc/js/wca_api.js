// NOTE: WCA API 数据获取模块 — calc 专用代理层
// 底层调用 shared/wca_search.js（WcaSearch 全局对象），保持 calc 的 export 接口不变
// calc 使用 ES modules，但 WcaSearch 是全局对象（通过 <script> 加载）

var API_BASE = 'https://www.worldcubeassociation.org/api/v0';

/**
 * NOTE: 获取用户在指定项目的最近 100 个有效单次成绩
 * 代理到 WcaSearch.fetchUserTimes — 保持返回值结构一致
 */
export async function fetchUserTimes(wcaId, eventId) {
    return WcaSearch.fetchUserTimes(wcaId, eventId);
}

/**
 * NOTE: 获取选手头像 URL
 * 代理到 WcaSearch.fetchAvatar
 */
export async function fetchPersonAvatar(wcaId) {
    return WcaSearch.fetchAvatar(wcaId);
}

/**
 * NOTE: 搜索 WCA 选手
 * 代理到 WcaSearch.searchPersons
 */
export async function searchPersons(query) {
    return WcaSearch.searchPersons(query);
}
