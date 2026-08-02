/**
 * 当前 WCA 纪录快照(WR / CR / NR)— 用于 cubing.com / WCA Live 源比赛页 fallback.
 *
 * 场景:比赛进行中或刚结束、WCA 还没公示这几天里,cubing.com / WCA Live 的
 * single_record_tag 是空,但成绩可能已破纪录.这时拿 wca_results_flat
 * (已公示数据)的当前 MIN 比一下,若 result <= 现 WR/CR/NR 就把 tag 填上.
 *
 * 性能:wca_results_flat ~11M 行,GROUP BY + MIN 即使走索引也要全扫.因此:
 *   1. 内存缓存 24h.
 *   2. peekCurrentRecords() 非阻塞 — 没缓存时立即返 null(后台 fire-and-forget 加载).
 *   3. server 启动时 warm 一次,正常运行期始终有缓存.
 *   4. CR 不查 PG,内存里用 country→continent 把 NR 数据 reduce 出来,省一条慢 SQL.
 *
 * 双端协作:enrichComp() 同时给现有 results 补 tag、解析每个 user 的
 * countryId/continentId、返回 filtered snapshot.client 拿 snapshot 给
 * WS 实时推送的新成绩做同样推断,不需要再请求 server.
 */
import { query } from '../db/connection.js';

export interface CurrentRecords {
  wr: Map<string, number>;                   // "event|isAvg(0|1)"          → min value
  cr: Map<string, number>;                   // "event|isAvg|continent_id"  → min value
  nr: Map<string, number>;                   // "event|isAvg|country_id"    → min value
  // 各 min 是哪天达成的(ISO yyyy-mm-dd,同值多条取最早).key 同上三张表.
  // 用途:判定上游 tag 是否已过期 —— 只有「基线早于本场比赛」才能反证(见 refutesTag).
  wrAt: Map<string, string>;
  crAt: Map<string, string>;
  nrAt: Map<string, string>;
  iso2ToCountryId: Map<string, string>;      // iso2 lowercase → wca country id
  nameToCountryId: Map<string, string>;      // country name lowercase → wca country id
  countryIdToContinent: Map<string, string>; // wca country id → continent_id
  countryIdToIso2: Map<string, string>;      // wca country id → iso2 lowercase
}

/** 发给 client 的 records 快照(仅本场比赛涉及的国家/洲).client 用同样的 key 规则做 lookup. */
export interface CompRecordsSnapshot {
  wr: Record<string, number>;  // 全集(项目少,~34 条)
  cr: Record<string, number>;  // 仅本场涉及的洲
  nr: Record<string, number>;  // 仅本场涉及的国家
  /** 同日已达成的最好成绩(含本场).client 给 WS 新成绩判定「日掩」用,key 规则同上. */
  day?: DayBestSnapshot;
}

/** 「日掩」(keatoned):成绩本身够到了某级地区纪录,但同一日历日已有更快的,
 *  按 WCA Reg 9i2「同日只认最好」不予认定.词源见 2015-11-21 Keaton Ellis 的 5.09
 *  被同场同日 Lucas Etter 的 4.90 抹掉. */
export interface KeatonedInfo {
  level: string;          // 被掩掉的级别:WR / CR / NR
  byValue: number;        // 当日压过它的成绩
  byComp: string;         // 那场比赛的 wca id
  byCompName: string;
  byPerson: string;
  byPersonIso2: string;
}

/** 某一日历日、某个 scope 下已知的最好成绩(跨比赛). */
export interface DayBestEntry {
  value: number;
  comp: string;
  compName: string;
  person: string;
  personIso2: string;
}

/** 同日最好成绩池.key 规则与 CurrentRecords 一致:
 *  wr `event|isAvg`、cr `event|isAvg|continent`、nr `event|isAvg|country`. */
export interface DayBest {
  wr: Map<string, DayBestEntry>;
  cr: Map<string, DayBestEntry>;
  nr: Map<string, DayBestEntry>;
}

/** DayBest 的 JSON 形态(发给 client). */
export interface DayBestSnapshot {
  wr: Record<string, DayBestEntry>;
  cr: Record<string, DayBestEntry>;
  nr: Record<string, DayBestEntry>;
}

let cached: CurrentRecords | null = null;
let cachedAt = 0;
let inflight: Promise<CurrentRecords | null> | null = null;
const TTL_MS = 24 * 60 * 60_000;

/** epoch(1970-01-01)起的天数 → ISO yyyy-mm-dd.SQL 里 DATE 相减得整数,回来自己还原. */
function epochDayToIso(days: unknown): string | null {
  const n = Number(days);
  if (!Number.isFinite(n)) return null;
  return new Date(n * 86400_000).toISOString().slice(0, 10);
}

async function load(): Promise<CurrentRecords | null> {
  const t0 = Date.now();
  try {
    const countryRows = await query<{ id: string; iso2: string | null; name: string; continent_id: string }>(
      `SELECT id, iso2, name, continent_id FROM wca_countries`,
    );
    const iso2ToCountryId = new Map<string, string>();
    const nameToCountryId = new Map<string, string>();
    const countryIdToContinent = new Map<string, string>();
    const countryIdToIso2 = new Map<string, string>();
    for (const c of countryRows) {
      if (c.iso2) {
        iso2ToCountryId.set(c.iso2.toLowerCase(), c.id);
        countryIdToIso2.set(c.id, c.iso2.toLowerCase());
      }
      nameToCountryId.set(c.name.toLowerCase(), c.id);
      countryIdToContinent.set(c.id, c.continent_id);
    }

    // MIN(ARRAY[value, comp_date - epoch]) 按数组字典序 → 先最小 value,同值再取最早日期;
    // 一次扫表同时拿到「纪录值」与「达成日」,免得为日期再全扫一遍 11M 行.
    const [wrRows, nrRows] = await Promise.all([
      query<{ event_id: string; is_avg: boolean; vd: number[] }>(
        `SELECT event_id, is_avg, MIN(ARRAY[value, (comp_date - DATE '1970-01-01')]) AS vd
         FROM wca_results_flat
         WHERE value > 0
         GROUP BY event_id, is_avg`,
      ),
      query<{ event_id: string; is_avg: boolean; person_country_id: string; vd: number[] }>(
        `SELECT event_id, is_avg, person_country_id, MIN(ARRAY[value, (comp_date - DATE '1970-01-01')]) AS vd
         FROM wca_results_flat
         WHERE value > 0
         GROUP BY event_id, is_avg, person_country_id`,
      ),
    ]);

    const wr = new Map<string, number>();
    const wrAt = new Map<string, string>();
    for (const r of wrRows) {
      const k = `${r.event_id}|${r.is_avg ? '1' : '0'}`;
      wr.set(k, Number(r.vd[0]));
      const d = epochDayToIso(r.vd[1]);
      if (d) wrAt.set(k, d);
    }

    const nr = new Map<string, number>();
    const nrAt = new Map<string, string>();
    const cr = new Map<string, number>();
    const crAt = new Map<string, string>();
    for (const r of nrRows) {
      const k = `${r.event_id}|${r.is_avg ? '1' : '0'}`;
      const v = Number(r.vd[0]);
      const d = epochDayToIso(r.vd[1]);
      nr.set(`${k}|${r.person_country_id}`, v);
      if (d) nrAt.set(`${k}|${r.person_country_id}`, d);
      const cont = countryIdToContinent.get(r.person_country_id);
      if (cont) {
        const ck = `${k}|${cont}`;
        const prev = cr.get(ck);
        if (prev === undefined || v < prev) {
          cr.set(ck, v);
          if (d) crAt.set(ck, d); else crAt.delete(ck);
        }
      }
    }

    const ms = Date.now() - t0;
    console.log(`[current_records] loaded WR=${wr.size} NR=${nr.size} CR=${cr.size} in ${ms}ms`);
    return { wr, cr, nr, wrAt, crAt, nrAt, iso2ToCountryId, nameToCountryId, countryIdToContinent, countryIdToIso2 };
  } catch (e) {
    console.warn('[current_records] load failed:', (e as Error).message);
    return null;
  }
}

/** await 版:有缓存返缓存,否则等加载(冷启 ~1-5s).仅启动 warm / 显式刷新场景用. */
export async function getCurrentRecords(): Promise<CurrentRecords | null> {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const fresh = await load();
    if (fresh) { cached = fresh; cachedAt = Date.now(); }
    inflight = null;
    return fresh;
  })();
  return inflight;
}

/** 非阻塞版:有缓存返缓存;否则立刻返 null 并后台 fire-and-forget 加载. */
export function peekCurrentRecords(): CurrentRecords | null {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;
  if (!inflight) {
    inflight = (async () => {
      const fresh = await load();
      if (fresh) { cached = fresh; cachedAt = Date.now(); }
      inflight = null;
      return fresh;
    })();
  }
  return null;
}

/** region(cubing.com / WCA Live 字段)→ wca_countries.id. */
function resolveCountryId(region: string, recs: CurrentRecords): string | null {
  if (!region) return null;
  const r = region.trim();
  if (!r) return null;
  if (r.length === 2) return recs.iso2ToCountryId.get(r.toLowerCase()) ?? null;
  if (recs.countryIdToContinent.has(r)) return r;
  return recs.nameToCountryId.get(r.toLowerCase()) ?? null;
}

/** 选手 region / enrichComp 解析出的 countryId → iso2(小写).无缓存 / 无法解析返 ''.
 *  format_cli 拿 person_iso2 把通用 CR 渲染成 AsR/ER/... 的洲际记录,所以必须给准. */
export function resolvePersonIso2(region: string, countryId?: string): string {
  const recs = peekCurrentRecords();
  if (recs && countryId) {
    const iso2 = recs.countryIdToIso2.get(countryId);
    if (iso2) return iso2;
  }
  const r = (region || '').trim();
  if (r.length === 2) return r.toLowerCase();
  if (recs && r) {
    const cid = recs.nameToCountryId.get(r.toLowerCase());
    const iso2 = cid ? recs.countryIdToIso2.get(cid) : undefined;
    if (iso2) return iso2;
  }
  return '';
}

interface MinimalUser {
  region: string;
  name?: string;
  countryId?: string;
  continentId?: string;
}

interface MinimalResult {
  e: string;
  n: number;
  b: number;
  a: number;
  sr: string;
  ar: string | number;
  sk?: KeatonedInfo | null;   // 单次「日掩」:本可达成 sk.level,被同日更快的抹掉
  ak?: KeatonedInfo | null;   // 平均「日掩」
}

interface MinimalRound { i: string; }
interface MinimalEvent { i: string; rs: MinimalRound[]; }

/** WCA round_type_id 的大致时序(轮次 metadata 缺失时兜底). */
const DEFAULT_ROUND_RANK: Record<string, number> = {
  '0': 0,
  d: 1, '1': 1,
  e: 2, '2': 2,
  g: 3, '3': 3,
  b: 4, c: 4, f: 4, h: 4,
};
function roundRank(roundId: string, order: string[] | undefined): number {
  if (order) {
    const idx = order.indexOf(roundId);
    if (idx >= 0) return idx;
  }
  return DEFAULT_ROUND_RANK[roundId] ?? 99;
}

function valueOf(lr: MinimalResult, isAvg: boolean): number {
  return isAvg ? lr.a : lr.b;
}

/** 按 running min 判定 tag(WR>CR>NR),并把更好的成绩并入各 scope 的 running min.
 *  传进来的是赛前基线的进度副本:同场比赛里破纪录后会逐步压低门槛,
 *  这样初赛破纪录、后置轮较慢的成绩就不会再被误标(无赛前基线的 scope 不追踪,同原行为).
 *  仅在拿不到同日成绩池(多日赛无轮次日期)时走这条兜底路径. */
function stepRecord(
  value: number,
  eventId: string,
  isAvg: boolean,
  u: MinimalUser | undefined,
  runWr: Map<string, number>,
  runCr: Map<string, number>,
  runNr: Map<string, number>,
): string {
  const k = `${eventId}|${isAvg ? '1' : '0'}`;
  const wrMin = runWr.get(k);
  const crKey = u?.continentId ? `${k}|${u.continentId}` : null;
  const nrKey = u?.countryId ? `${k}|${u.countryId}` : null;
  const crMin = crKey ? runCr.get(crKey) : undefined;
  const nrMin = nrKey ? runNr.get(nrKey) : undefined;

  let tag = '';
  if (wrMin !== undefined && value <= wrMin) tag = 'WR';
  else if (crMin !== undefined && value <= crMin) tag = 'CR';
  else if (nrMin !== undefined && value <= nrMin) tag = 'NR';

  if (wrMin !== undefined && value < wrMin) runWr.set(k, value);
  if (crKey && crMin !== undefined && value < crMin) runCr.set(crKey, value);
  if (nrKey && nrMin !== undefined && value < nrMin) runNr.set(nrKey, value);
  return tag;
}

/** 按 WCA Reg 9i2 判定 tag:门槛是赛前基线,但同一日历日只认当日最好的那条.
 *  从高到低走 WR → CR → NR:
 *    够不着这一级        → 试下一级
 *    够得着但当日有更快的 → 「日掩」(记下最高的那一级),继续试下一级
 *    够得着且是当日最好   → 定级返回(并列同值也算,Reg 9i1a)
 *  Crimson 7.72 平 WR 但同日陈震 6.99 更快 → WR/CR 双双被掩,落到 NR(PH). */
function judgeByDay(
  value: number,
  eventId: string,
  isAvg: boolean,
  u: MinimalUser | undefined,
  base: CurrentRecords,
  day: DayBest,
): { tag: string; keatoned: KeatonedInfo | null } {
  const k = `${eventId}|${isAvg ? '1' : '0'}`;
  const scopes: { level: string; key: string; baseline: number | undefined; winner: DayBestEntry | undefined }[] = [
    { level: 'WR', key: k, baseline: base.wr.get(k), winner: day.wr.get(k) },
  ];
  if (u?.continentId) {
    const ck = `${k}|${u.continentId}`;
    scopes.push({ level: 'CR', key: ck, baseline: base.cr.get(ck), winner: day.cr.get(ck) });
  }
  if (u?.countryId) {
    const nk = `${k}|${u.countryId}`;
    scopes.push({ level: 'NR', key: nk, baseline: base.nr.get(nk), winner: day.nr.get(nk) });
  }

  let keatoned: KeatonedInfo | null = null;
  for (const s of scopes) {
    if (s.baseline === undefined) continue;   // 无赛前基线的 scope 不追踪(同原行为)
    if (value > s.baseline) continue;         // 够不着这一级
    if (s.winner && value > s.winner.value) {
      // 够得着,但当日已有更快的 → 被日掩.只记最高的那一级.
      if (!keatoned) {
        keatoned = {
          level: s.level,
          byValue: s.winner.value,
          byComp: s.winner.comp,
          byCompName: s.winner.compName,
          byPerson: s.winner.person,
          byPersonIso2: s.winner.personIso2,
        };
      }
      continue;
    }
    return { tag: s.level, keatoned };
  }
  return { tag: '', keatoned };
}

/** 单条「外部源」纪录(WCA Live recentRecords feed)的 Reg 9i2 同日复判.
 *  与 enrichComp 共用 judgeByDay —— 首页纪录列表与比赛页必须同一口径.
 *  拿不到基线快照(current_records 还没 warm)返 null,调用方保留上游 tag. */
export function judgeExternalRecord(
  value: number,
  eventId: string,
  isAvg: boolean,
  iso2: string,
  day: DayBest,
): { tag: string; keatoned: KeatonedInfo | null } | null {
  const recs = peekCurrentRecords();
  if (!recs) return null;
  const countryId = recs.iso2ToCountryId.get((iso2 || '').toLowerCase());
  const u: MinimalUser | undefined = countryId
    ? { region: '', countryId, continentId: recs.countryIdToContinent.get(countryId) }
    : undefined;
  return judgeByDay(value, eventId, isAvg, u, recs, day);
}

/** 上游 tag(WR / AsR 等洲际 / NR)对应的 scope key + 基线表. */
function scopeOfTag(tag: string, k: string, u: MinimalUser | undefined, recs: CurrentRecords):
  { value: number | undefined; at: string | undefined } | null {
  const rank = recordLevelRank(tag);
  if (rank === 0) return { value: recs.wr.get(k), at: recs.wrAt.get(k) };
  if (rank === 1) {
    if (!u?.continentId) return null;
    const ck = `${k}|${u.continentId}`;
    return { value: recs.cr.get(ck), at: recs.crAt.get(ck) };
  }
  if (rank === 2) {
    if (!u?.countryId) return null;
    const nk = `${k}|${u.countryId}`;
    return { value: recs.nr.get(nk), at: recs.nrAt.get(nk) };
  }
  return null;
}

/** 上游给的 tag 是否已被「本场比赛之前就存在的纪录」证伪.
 *
 *  场景:cubing.com / WCA Live 的纪录标志是它们自己那份(可能已过期的)基线判出来的 ——
 *  2026-07-25 芜湖陈震把单手平均 WR 刷到 6.99 后,上游仍给一周后上海的 7.29 标 WR.
 *  本站基线(wca_results_flat)已含 6.99,足以反证.
 *
 *  日期门槛不可省:基线是「当前」纪录,含本场之后才出现的成绩.没有 compDate、或纪录
 *  是本场之后达成的,一律不动上游 tag —— 否则回看历史比赛会把当年真实的 WR 抹掉. */
export function refutesTag(
  tag: string,
  value: number,
  eventId: string,
  isAvg: boolean,
  u: MinimalUser | undefined,
  recs: CurrentRecords,
  compDate: string | null | undefined,
  /** 多日赛用:纪录必须严格早于开赛日.基线日期取比赛 start_date,同日 = 可能就是本场后面
   *  某一天刷出来的(第一天的合法纪录不该被最后一天的更好成绩反证). */
  strictlyBefore = false,
): boolean {
  if (!tag || !compDate) return false;
  const scope = scopeOfTag(tag, `${eventId}|${isAvg ? '1' : '0'}`, u, recs);
  if (!scope || scope.value === undefined || !scope.at) return false;
  // 纪录发生在本场之后 → 说明不了本场当时的事
  if (strictlyBefore ? scope.at >= compDate : scope.at > compDate) return false;
  return value > scope.value;
}

/** 纪录级别序:WR > 洲际(CR 及 AsR/ER/NAR/SAR/AfR/OcR)> NR.数字越大级别越低.
 *  首页纪录列表排序与下面的降级判定共用这一份. */
export function recordLevelRank(tag: string): number {
  if (tag === 'WR') return 0;
  if (tag === 'CR') return 1;
  if (tag === 'NR') return 2;
  return tag.endsWith('R') ? 1 : 3;
}

/** 上游 feed 的 tag + 本站同日复判结果 → 有效 tag;null = 当日已被更快的抹掉,
 *  按 Reg 9i2 根本不是纪录,不该出现在纪录列表里.
 *
 *  只降级不升级:升级要信 wca_results_flat 基线,而那是周更 dump —— 比 feed 更松的基线
 *  会把已被超越的成绩误升成 WR.降级只依赖「同日有更快的」这个本地事实,安全. */
export function resolveFeedTag(
  feedTag: string,
  judged: { tag: string; keatoned: KeatonedInfo | null } | null,
): string | null {
  if (!judged) return feedTag;
  if (judged.tag) return recordLevelRank(judged.tag) > recordLevelRank(feedTag) ? judged.tag : feedTag;
  // 一级都够不着:确实被同日更快的抹掉才丢;单纯没基线(keatoned 为空)不动 feed.
  return judged.keatoned ? null : feedTag;
}

/** 把一场比赛的成绩并入同日最好池.同一 scope 取更小值;并列(同值)保留先入者. */
export function foldCompIntoDayBest(
  day: DayBest,
  comp: { slug: string; name: string; users: Record<string, MinimalUser>; resultsByRound: Record<string, MinimalResult[]> },
): void {
  const recs = peekCurrentRecords();
  if (!recs) return;
  const countryOf = new Map<string, { countryId: string; continentId: string | undefined; iso2: string }>();
  for (const [num, u] of Object.entries(comp.users)) {
    const cid = u.countryId ?? resolveCountryId(u.region, recs);
    if (!cid) continue;
    countryOf.set(num, {
      countryId: cid,
      continentId: u.continentId ?? recs.countryIdToContinent.get(cid),
      iso2: (recs.countryIdToIso2.get(cid) ?? '').toUpperCase(),
    });
  }

  for (const [key, list] of Object.entries(comp.resultsByRound)) {
    const sep = key.indexOf(':');
    const eventId = sep >= 0 ? key.slice(0, sep) : key;
    for (const lr of list) {
      const who = countryOf.get(String(lr.n));
      const person = comp.users[String(lr.n)] as (MinimalUser & { name?: string }) | undefined;
      for (const isAvg of [false, true] as const) {
        const value = isAvg ? lr.a : lr.b;
        if (!value || value <= 0) continue;
        const entry: DayBestEntry = {
          value,
          comp: comp.slug,
          compName: comp.name,
          person: person?.name ?? '',
          personIso2: who?.iso2 ?? '',
        };
        const k = `${eventId}|${isAvg ? '1' : '0'}`;
        const put = (m: Map<string, DayBestEntry>, mk: string) => {
          const prev = m.get(mk);
          if (prev === undefined || value < prev.value) m.set(mk, entry);
        };
        put(day.wr, k);
        if (who?.continentId) put(day.cr, `${k}|${who.continentId}`);
        if (who) put(day.nr, `${k}|${who.countryId}`);
      }
    }
  }
}

export function emptyDayBest(): DayBest {
  return { wr: new Map(), cr: new Map(), nr: new Map() };
}

/** 综合处理一场比赛的数据:
 *  1) 解析每个 user 的 countryId/continentId,attach 进 users (mutate).
 *  2) 给现有 results 的空 sr/ar 推断 tag (mutate).
 *  3) 返回本场比赛涉及国家/洲的 CompRecordsSnapshot — client 拿去给 WS 推的新成绩同款推断.
 *
 *  无 records 缓存时全部跳过,返 null;调用方 fallback 到原行为(显示 PR). */
export function enrichComp(
  users: Record<string, MinimalUser>,
  resultsByRound: Record<string, MinimalResult[]>,
  events?: MinimalEvent[],
  dayBest?: DayBest | null,
  compDate?: string | null,
): CompRecordsSnapshot | null {
  const recs = peekCurrentRecords();
  if (!recs) return null;

  const countriesInComp = new Set<string>();
  for (const u of Object.values(users)) {
    const cid = resolveCountryId(u.region, recs);
    if (cid) {
      u.countryId = cid;
      countriesInComp.add(cid);
      const cont = recs.countryIdToContinent.get(cid);
      if (cont) u.continentId = cont;
    }
  }

  // running min:赛前基线的进度副本.按 (event → round 时序) 处理,轮内按成绩升序(先处理本轮最好的),
  // 破纪录后压低门槛 → 同场后置轮的较慢成绩不再被误标(snapshot 仍返回赛前基线供 WS 推断).
  const runWr = new Map(recs.wr);
  const runCr = new Map(recs.cr);
  const runNr = new Map(recs.nr);

  const orderByEvent: Record<string, string[]> = {};
  if (events) for (const ev of events) orderByEvent[ev.i] = ev.rs.map(r => r.i);

  const groupsByEvent: Record<string, { roundId: string; list: MinimalResult[] }[]> = {};
  for (const [key, list] of Object.entries(resultsByRound)) {
    const sep = key.indexOf(':');
    const eventId = sep >= 0 ? key.slice(0, sep) : key;
    const roundId = sep >= 0 ? key.slice(sep + 1) : '';
    (groupsByEvent[eventId] ||= []).push({ roundId, list });
  }

  for (const [eventId, groups] of Object.entries(groupsByEvent)) {
    const order = orderByEvent[eventId];
    groups.sort((a, b) => roundRank(a.roundId, order) - roundRank(b.roundId, order));
    for (const isAvg of [false, true] as const) {
      for (const g of groups) {
        const ordered = [...g.list].sort((x, y) => valueOf(x, isAvg) - valueOf(y, isAvg));
        for (const lr of ordered) {
          const val = valueOf(lr, isAvg);
          if (val <= 0) continue;
          const u = users[String(lr.n)];
          const already = String((isAvg ? lr.ar : lr.sr) || '');
          if (dayBest) {
            // Reg 9i2 路径:同日只认最好.裁决结果覆盖上游 tag —— cubing.com / WCA Live
            // 都只看本场 + 现存纪录,不做跨比赛同日判定,它们标的 WR 可能已被别处抹掉.
            const { tag, keatoned } = judgeByDay(val, eventId, isAvg, u, recs, dayBest);
            const stale = !tag && !keatoned && refutesTag(already, val, eventId, isAvg, u, recs, compDate);
            if (isAvg) { if (tag || keatoned || stale) lr.ar = tag; lr.ak = keatoned; }
            else { if (tag || keatoned || stale) lr.sr = tag; lr.sk = keatoned; }
          } else {
            // 兜底(多日赛拿不到轮次日期):沿用赛前基线 + 轮次时序 running-min,只填空不覆盖;
            // 但上游 tag 被赛前就存在的纪录证伪时(过期基线标出来的假 WR)照样清掉.
            const tag = stepRecord(val, eventId, isAvg, u, runWr, runCr, runNr);
            if (tag && !already) {
              if (isAvg) lr.ar = tag;
              else lr.sr = tag;
            } else if (!tag && already && refutesTag(already, val, eventId, isAvg, u, recs, compDate, true)) {
              if (isAvg) lr.ar = '';
              else lr.sr = '';
            }
          }
        }
      }
    }
  }

  const continentsInComp = new Set<string>();
  for (const cid of countriesInComp) {
    const cont = recs.countryIdToContinent.get(cid);
    if (cont) continentsInComp.add(cont);
  }
  const wr: Record<string, number> = {};
  for (const [k, v] of recs.wr) wr[k] = v;
  const cr: Record<string, number> = {};
  for (const [k, v] of recs.cr) {
    const continent = k.split('|')[2];
    if (continentsInComp.has(continent)) cr[k] = v;
  }
  const nr: Record<string, number> = {};
  for (const [k, v] of recs.nr) {
    const country = k.split('|')[2];
    if (countriesInComp.has(country)) nr[k] = v;
  }

  let day: DayBestSnapshot | undefined;
  if (dayBest) {
    day = { wr: {}, cr: {}, nr: {} };
    for (const [k, v] of dayBest.wr) day.wr[k] = v;
    for (const [k, v] of dayBest.cr) {
      if (continentsInComp.has(k.split('|')[2])) day.cr[k] = v;
    }
    for (const [k, v] of dayBest.nr) {
      if (countriesInComp.has(k.split('|')[2])) day.nr[k] = v;
    }
  }
  return { wr, cr, nr, day };
}
