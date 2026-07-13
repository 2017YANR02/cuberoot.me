// /v1/cubing-live 的 ?only= 分片:把整场比赛的 CompData 裁成只含某个项目(或某一轮)。
//
// 为什么:比赛页首屏只渲染当前项目的成绩表,但完整响应把全部项目 × 全部轮次 × 每个选手的历史 PR
// 都塞在一起 —— WC2023 gzip 后仍有 380KB,跨洋要好几秒。裁到单项目只剩几 KB。
//
// 为什么按「项目」而不是按「轮」裁:①双轮合并榜要两轮都在;②同项目切轮次不用再发请求;
// ③客户端从 URL 的 ?event= 直接就能拼出 key,不必先拿到 events 才能把 ?round=2 映射成
// round_type_id(2 轮赛事第 2 轮的 id 是 'f' 而非 '2')。
//
// 缓存里存的永远是全量,裁剪只发生在响应阶段。

/** 结构化约束:只用到裁剪需要的字段,具体 CompData 由调用方带进来(泛型原样返回)。 */
export interface TrimmableComp {
  events: { i: string; rs: { i: string }[] }[];
  users: Record<string, { wcaid?: string }>;
  resultsByRound: Record<string, { n: number }[]>;
  personalRecords?: Record<string, unknown>;
  partial?: boolean;
}

/** 只保留给定轮次:users / personalRecords 同步收窄到这些轮出现过的选手。
 *  events / membersByFilter 等元数据整份保留(客户端要靠它渲染项目栏和轮次切换)。 */
// 泛型只为把调用方的具体 CompData 原样还回去;内部一律按基础形状操作(泛型索引不可写),
// 收尾一次性 cast —— 运行时就是 { ...data, 三个收窄字段 }。
export function trimToRounds<T extends TrimmableComp>(data: T, keys: string[]): T {
  const src: TrimmableComp = data;
  const resultsByRound: TrimmableComp['resultsByRound'] = {};
  const userNums = new Set<string>();
  for (const key of keys) {
    const rows = src.resultsByRound[key];
    if (!rows) continue; // 调用方(resolveOnlyKeys)只给有成绩的轮,这里只做兜底
    resultsByRound[key] = rows;
    for (const r of rows) userNums.add(String(r.n));
  }
  const users: TrimmableComp['users'] = {};
  for (const [k, v] of Object.entries(src.users)) {
    if (userNums.has(k)) users[k] = v;
  }
  let personalRecords: TrimmableComp['personalRecords'];
  if (src.personalRecords) {
    personalRecords = {};
    for (const u of Object.values(users)) {
      const pr = u.wcaid ? src.personalRecords[u.wcaid] : undefined;
      if (u.wcaid && pr !== undefined) personalRecords[u.wcaid] = pr;
    }
  }
  return { ...data, users, resultsByRound, personalRecords, partial: true } as unknown as T;
}

/** 某项目下所有「有成绩」的轮次 key。项目不存在 → 空数组(调用方据此回退成全量)。 */
export function eventRoundKeys(data: TrimmableComp, eventId: string): string[] {
  const ev = data.events.find(e => e.i === eventId);
  if (!ev) return [];
  return ev.rs
    .map(rd => `${eventId}:${rd.i}`)
    .filter(k => (data.resultsByRound[k] ?? []).length > 0);
}

/** ?only= 的取值 → 要保留的轮次 key;null = 认不出 / 没成绩,调用方发全量。
 *  形态:`<event>`(整个项目)/ `<event>:<round>`(单轮)/ `auto`(默认项目,由 pickDefault 给)。 */
export function resolveOnlyKeys(
  data: TrimmableComp,
  only: string,
  pickDefaultEvent: () => string | null,
): string[] | null {
  const evId = only === 'auto' ? pickDefaultEvent() : /^[A-Za-z0-9]+$/.test(only) ? only : null;
  if (evId) {
    const keys = eventRoundKeys(data, evId);
    return keys.length > 0 ? keys : null;
  }
  const m = /^([A-Za-z0-9]+):([A-Za-z0-9]+)$/.exec(only);
  if (!m) return null;
  const key = `${m[1]}:${m[2]}`;
  return (data.resultsByRound[key] ?? []).length > 0 ? [key] : null;
}
