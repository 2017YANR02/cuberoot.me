// NOTE: 导出 WCA 历史所有已结束比赛 → stats/all_past_comps.json
// Globe 页 history 模式消费这个文件。
//
// 数据源：本地 MySQL wca_developer_database 库（update_database.ts 每周从 WCA 官方 dump 导入）
// 成本：一次 SQL ~1s + 序列化 ~0.5s，整个脚本 < 2s
//
// 用法：npx tsx src/bin/gen_all_comps.ts
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, closePool } from '../core/database.js';
import type { RowDataPacket } from 'mysql2';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../../../../../stats/all_past_comps.json');
// round-1 WCIF 配置（限时/及格/晋级/资格）大文件，列表视图按需懒加载（不内联进 all_past_comps，避免它再涨 ~5MB）
const META_OUTPUT_PATH = resolve(__dirname, '../../../../../stats/comp_round_meta.json');

// NOTE: WCA 内部 event_id → 前端短名（与 fetch_upcoming_comps.ts EVENT_DISPLAY_ORDER 保持一致）
const EVENT_SHORT: Record<string, string> = {
  '333': '3', '222': '2', '444': '4', '555': '5', '666': '6', '777': '7',
  '333bf': '3bf', '333fm': 'fm', '333oh': 'oh',
  'minx': 'minx', 'pyram': 'py', 'clock': 'clock',
  'skewb': 'sk', 'sq1': 'sq1',
  '444bf': '4bf', '555bf': '5bf', '333mbf': 'mbf',
  '333ft': 'ft', '333mbo': 'mbo', 'magic': 'mag', 'mmagic': 'mmag',
};
const EVENT_ORDER: string[] = ['3','2','4','5','6','7','3bf','fm','oh','minx','py','clock','sk','sq1','4bf','5bf','mbf','ft','mbo','mag','mmag'];
const EVENT_RANK: Record<string, number> = Object.fromEntries(EVENT_ORDER.map((k, i) => [k, i]));

interface Row extends RowDataPacket {
  id: string;
  name: string;
  city_name: string;
  country_id: string;
  iso2: string | null;
  latitude_degrees: number | string;
  longitude_degrees: number | string;
  start_date: Date | string;
  end_date: Date | string;
  events_csv: string | null;
  competitors_count: number | string | null;
  competitor_limit: number | string | null;
}

interface RoundRow extends RowDataPacket {
  competition_id: string;
  event_id: string;
  round_count: number;
  person_count: number;
}

interface MetaRow extends RowDataPacket {
  competition_id: string;
  event_id: string;
  time_limit: string | null;
  cutoff: string | null;
  advancement_condition: string | null;
}
interface QualRow extends RowDataPacket {
  competition_id: string;
  event_id: string;
  qualification: string | null;
}
interface DualRow extends RowDataPacket {
  competition_id: string;
  event_id: string;
}

// 紧凑 round-1 meta（与 shared RoundMeta 一致，键省略即无）
interface RoundMeta {
  tl?: number;
  cum?: 1;
  co?: [number, number];
  adv?: string;
  q?: string;
}

function safeParse<T>(s: string | null): T | null {
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}
function encodeAdv(a: { type?: string; level?: number } | null): string | undefined {
  if (!a || a.level == null) return undefined;
  if (a.type === 'ranking') return `r${a.level}`;
  if (a.type === 'percent') return `p${a.level}`;
  if (a.type === 'attemptResult') return `a${a.level}`;
  return undefined;
}
function encodeQual(q: { type?: string; resultType?: string; level?: number | null } | null): string | undefined {
  if (!q || !q.type) return undefined;
  return `${q.type}:${q.resultType ?? ''}:${q.level ?? ''}`;
}

function fmtDate(d: Date | string): string {
  if (d instanceof Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return String(d).slice(0, 10);
}

async function main() {
  const start = Date.now();

  // NOTE: 多地代码（XA/XE/XF/XM/XN/XO/XS/XW）保留 — calendar / list 视图能渲染（前端有 flag-multi 占位 + countryName 翻译），
  //       Globe 地图侧通过 latitude_degrees == null 兜底过滤（见下方 map 输出）
  const sql = `
    SELECT
      c.id,
      c.name,
      c.city_name,
      c.country_id,
      co.iso2,
      c.latitude / 1000000.0 AS latitude_degrees,
      c.longitude / 1000000.0 AS longitude_degrees,
      c.start_date,
      c.end_date,
      GROUP_CONCAT(DISTINCT r.event_id) AS events_csv,
      COUNT(DISTINCT r.person_id) AS competitors_count,
      c.competitor_limit
    FROM competitions c
    LEFT JOIN countries co ON co.id = c.country_id
    LEFT JOIN results r ON r.competition_id = c.id
    WHERE c.end_date < CURDATE()
    GROUP BY c.id
    ORDER BY c.start_date
  `;
  const MULTI_REGION = new Set(['XA', 'XE', 'XF', 'XM', 'XN', 'XO', 'XS', 'XW']);

  const rows = await query<Row[]>(sql);

  // NOTE: 每场比赛每个项目的轮次数 + 参赛人数。CI 只导入 REQUIRED_TABLES，没有 competition_events / rounds 表，
  // 用 results.round_type_id 的 distinct count 等价替代轮次（past comps 已跑的轮次必然有 results）；
  // 各项目参赛人数 = 该 (comp, event) 下 DISTINCT person_id。
  const roundsSql = `
    SELECT competition_id, event_id,
      COUNT(DISTINCT round_type_id) AS round_count,
      COUNT(DISTINCT person_id) AS person_count
    FROM results
    GROUP BY competition_id, event_id
  `;
  const roundRows = await query<RoundRow[]>(roundsSql);
  const roundsByComp = new Map<string, Record<string, number>>();
  const regsByComp = new Map<string, Record<string, number>>();
  for (const rr of roundRows) {
    const short = EVENT_SHORT[rr.event_id] ?? rr.event_id;
    let m = roundsByComp.get(rr.competition_id);
    if (!m) { m = {}; roundsByComp.set(rr.competition_id, m); }
    m[short] = Number(rr.round_count);
    let g = regsByComp.get(rr.competition_id);
    if (!g) { g = {}; regsByComp.set(rr.competition_id, g); }
    g[short] = Number(rr.person_count);
  }

  // ── 双轮赛制 (WCA Reg 9v, 2026+) → 每场含双轮的 event 短码列表 ───────────────────────
  // 双轮 = 某项目的两轮被「链接」(rounds.linked_round_id 非空)：全员可打两轮、取较好成绩、
  // 不淘汰。权威信号是 linked_round_id —— 公开 WCIF 不暴露它，advancement_condition 只是
  // 「若 dual 临时取消则回退」的后备值(常见 percent/75)，开发者 dump 的 rounds 表才带 linked_round_id。
  // 旧实现用 advancement==percent/100 启发式，两个方向都错：漏掉后备写 75% 的真 dual(如 Evanston)，
  // 又误报残留 100% 但实际改成淘汰制的非 dual(如 Shanghai)。linked_round_id 已隐含 ≥2 轮，无需再 gate。
  // 只有 2026 起的比赛可能有(新规)，SQL 已按年份收口(只扫几十场，开销可忽略)。
  const dualRows = await query<DualRow[]>(`
    SELECT DISTINCT ce.competition_id, ce.event_id
    FROM rounds r
    JOIN competition_events ce ON ce.id = r.competition_event_id
    JOIN competitions c ON c.id = ce.competition_id
    WHERE r.linked_round_id IS NOT NULL AND c.end_date < CURDATE() AND YEAR(c.start_date) >= 2026
  `);
  const dualByComp = new Map<string, string[]>();
  for (const dr of dualRows) {
    const short = EVENT_SHORT[dr.event_id] ?? dr.event_id;
    let arr = dualByComp.get(dr.competition_id);
    if (!arr) { arr = []; dualByComp.set(dr.competition_id, arr); }
    arr.push(short);
  }
  for (const arr of dualByComp.values()) {
    arr.sort((a, b) => (EVENT_RANK[a] ?? 999) - (EVENT_RANK[b] ?? 999));
  }

  const out = rows
    .filter((r) => {
      // 多地代码（XW/XA/...）通常 lat/lng = 0 没有意义，但 calendar / list 视图照样要展示，
      // 只剔无效坐标的"普通国家"行（数据 bug 兜底）
      if (MULTI_REGION.has(r.country_id)) return true;
      const lat = Number(r.latitude_degrees);
      const lng = Number(r.longitude_degrees);
      return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
    })
    .map((r) => {
      const rawEvents = (r.events_csv ?? '').split(',').filter(Boolean);
      const shortEvents = rawEvents
        .map((e) => EVENT_SHORT[e] ?? e)
        .sort((a, b) => (EVENT_RANK[a] ?? 999) - (EVENT_RANK[b] ?? 999));
      const rounds = roundsByComp.get(r.id);
      const eventRegs = regsByComp.get(r.id);
      const isMulti = MULTI_REGION.has(r.country_id);
      // 多地代码无真实坐标 → 写 null，让 Globe consumer 通过 lat == null 干净地跳过
      return {
        id: r.id,
        // country: ISO 3166-1 alpha-2(与 UpcomingCompRecord.country 一致,直接喂 <Flag> / countryName)。
        // 多地代码(XA/XE/.../XW)的 iso2 在 WCA countries 表里就是代码本身,calendar 的 flag-multi 占位照常工作。
        name: r.name,
        city: r.city_name,
        country: r.iso2 ?? r.country_id,
        latitude_degrees: isMulti ? null : Number(r.latitude_degrees),
        longitude_degrees: isMulti ? null : Number(r.longitude_degrees),
        start_date: fmtDate(r.start_date),
        end_date: fmtDate(r.end_date),
        events: shortEvents,
        ...(rounds && Object.keys(rounds).length > 0 ? { rounds } : {}),
        ...(dualByComp.get(r.id)?.length ? { dual_events: dualByComp.get(r.id) } : {}),
        ...(eventRegs && Object.keys(eventRegs).length > 0 ? { event_regs: eventRegs } : {}),
        ...(Number(r.competitors_count) > 0 ? { competitors: Number(r.competitors_count) } : {}),
        ...(Number(r.competitor_limit) > 0 ? { competitor_limit: Number(r.competitor_limit) } : {}),
      };
    });

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(out), 'utf-8');

  const kb = Math.round((Buffer.byteLength(JSON.stringify(out)) / 1024));
  const dur = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`Generated ${OUTPUT_PATH}: ${out.length} comps, ${kb} KB, ${dur}s`);

  // ── round-1 WCIF 配置（过去比赛）→ comp_round_meta.json ──────────────────
  // rounds.time_limit / cutoff / advancement_condition 与 competition_events.qualification 都是 WCIF 形状的 JSON，
  // 与 fetch_upcoming_comps.ts 从 WCIF 抽的字段一致。只取 number=1（round-1），过去比赛。
  const metaStart = Date.now();
  const metaRows = await query<MetaRow[]>(`
    SELECT ce.competition_id, ce.event_id, r.time_limit, r.cutoff, r.advancement_condition
    FROM rounds r
    JOIN competition_events ce ON ce.id = r.competition_event_id
    JOIN competitions c ON c.id = ce.competition_id
    WHERE r.number = 1 AND c.end_date < CURDATE()
  `);
  const qualRows = await query<QualRow[]>(`
    SELECT ce.competition_id, ce.event_id, ce.qualification
    FROM competition_events ce
    JOIN competitions c ON c.id = ce.competition_id
    WHERE c.end_date < CURDATE() AND ce.qualification IS NOT NULL AND ce.qualification <> ''
  `);

  const metaByComp: Record<string, Record<string, RoundMeta>> = {};
  const ensure = (comp: string, short: string): RoundMeta => {
    let m = metaByComp[comp];
    if (!m) { m = {}; metaByComp[comp] = m; }
    let e = m[short];
    if (!e) { e = {}; m[short] = e; }
    return e;
  };
  for (const r of metaRows) {
    const short = EVENT_SHORT[r.event_id] ?? r.event_id;
    const tl = safeParse<{ centiseconds?: number; cumulativeRoundIds?: string[] }>(r.time_limit);
    const co = safeParse<{ numberOfAttempts?: number; attemptResult?: number }>(r.cutoff);
    const adv = encodeAdv(safeParse(r.advancement_condition));
    const hasTl = tl && typeof tl.centiseconds === 'number';
    const hasCo = co && typeof co.numberOfAttempts === 'number' && typeof co.attemptResult === 'number';
    if (!hasTl && !hasCo && !adv) continue;
    const e = ensure(r.competition_id, short);
    if (hasTl) { e.tl = tl!.centiseconds!; if ((tl!.cumulativeRoundIds?.length ?? 0) > 0) e.cum = 1; }
    if (hasCo) e.co = [co!.numberOfAttempts!, co!.attemptResult!];
    if (adv) e.adv = adv;
  }
  for (const r of qualRows) {
    const q = encodeQual(safeParse(r.qualification));
    if (!q) continue;
    ensure(r.competition_id, EVENT_SHORT[r.event_id] ?? r.event_id).q = q;
  }

  const metaJson = JSON.stringify(metaByComp);
  writeFileSync(META_OUTPUT_PATH, metaJson, 'utf-8');
  const metaKb = Math.round(Buffer.byteLength(metaJson) / 1024);
  console.log(`Generated ${META_OUTPUT_PATH}: ${Object.keys(metaByComp).length} comps, ${metaKb} KB, ${((Date.now() - metaStart) / 1000).toFixed(2)}s`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => closePool());
