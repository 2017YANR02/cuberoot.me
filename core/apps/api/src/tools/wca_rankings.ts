/**
 * WCA 世界排名(Top 100)—— 忠实移植自退役的 Python wca_rankings.py。
 *
 * 通过 WCA 官网排名页 URL 加 `Accept: application/json` 头拿 JSON 排名,算 gen_title 的
 * `/WRxx` 后缀。排名变化缓慢,本地缓存 3 天(rankings_cache.json,与本模块同目录,gitignored)。
 *
 * 自包含:只用 fetch + fs,不碰 PG。服务器自己的纪录文案走 routes/wca_stats_extra 的
 * worldRankTop100(查本地 wca_results_flat),那是另一套语境;本工具是本地离线 CLI,保持
 * Python 版「只靠联网、任意机器可跑」的特性。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = join(SCRIPT_DIR, 'rankings_cache.json');
// 缓存有效期(秒):3 天
const CACHE_TTL = 3 * 24 * 60 * 60;

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
    + 'AppleWebKit/537.36 (KHTML, like Gecko) '
    + 'Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// WCA 所有官方项目 ID
const EVENT_IDS = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '333fm', '333oh', 'clock', 'minx',
  'pyram', 'skewb', 'sq1', '444bf', '555bf', '333mbf',
];

/** 单榜单 Top100:`th100` = 第100名成绩(门控),`ranks` = 升序 [成绩, 排名] 含并列 */
interface RankData {
  th100: number;
  ranks: [number, number][];
}
type EventRanks = Record<string, RankData>; // 'single' | 'average'

interface DiskPayload {
  cachedAt: number; // 秒
  data: Record<string, Record<string, { th100: number; ranks: [number, number][] }>>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class RankingCache {
  private cache: Record<string, EventRanks> = {};
  private initialized = false;

  isAvailable(): boolean {
    return this.initialized;
  }

  private loadDiskCache(): boolean {
    if (!existsSync(CACHE_FILE)) return false;
    try {
      const raw = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as DiskPayload;
      const cachedAt = raw.cachedAt ?? 0;
      if (Date.now() / 1000 - cachedAt > CACHE_TTL) return false;
      const data = raw.data ?? {};
      for (const [eid, types] of Object.entries(data)) {
        this.cache[eid] = {};
        for (const [tname, tdata] of Object.entries(types)) {
          this.cache[eid]![tname] = {
            th100: tdata.th100,
            ranks: tdata.ranks.map(([s, r]) => [s, r] as [number, number]),
          };
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  private saveDiskCache(): void {
    try {
      const data: DiskPayload['data'] = {};
      for (const [eid, types] of Object.entries(this.cache)) {
        data[eid] = {};
        for (const [tname, tdata] of Object.entries(types)) {
          data[eid]![tname] = { th100: tdata.th100, ranks: tdata.ranks };
        }
      }
      const payload: DiskPayload = { cachedAt: Date.now() / 1000, data };
      writeFileSync(CACHE_FILE, JSON.stringify(payload), 'utf-8');
    } catch (e) {
      console.error(`[rankings] save cache failed: ${(e as Error).message}`);
    }
  }

  /** 全量更新所有项目 Top100。优先本地缓存(3 天有效),失效时逐榜 JSON API 拉取。 */
  async updateAll(): Promise<void> {
    if (this.loadDiskCache()) {
      this.initialized = true;
      return;
    }

    let count = 0;
    const total = EVENT_IDS.length * 2;
    let idx = 0;

    for (const eventId of EVENT_IDS) {
      this.cache[eventId] ??= {};
      for (const typeName of ['single', 'average']) {
        idx += 1;
        try {
          const data = await this.fetchTop100(eventId, typeName);
          if (data) {
            this.cache[eventId]![typeName] = data;
            count += 1;
          }
        } catch (e) {
          console.error(`[rankings] ${eventId}/${typeName} fetch error: ${(e as Error).message}`);
        }
        // 短暂延迟防限流 (0.3 ~ 0.6s)
        if (idx < total) await sleep(300 + Math.random() * 300);
      }
    }

    this.initialized = true;
    if (count > 0) this.saveDiskCache();
  }

  /** 查询成绩世界排名;优于第 100 名返名次,否则 null。 */
  getWorldRank(eventId: string, typeName: string, result: number): number | null {
    if (!this.isAvailable()) return null;
    const typeKey = typeName === 'single' ? 'single' : 'average';
    const eventData = this.cache[eventId]?.[typeKey];
    if (!eventData) return null;

    // 快速检查是否在 Top 100 内
    const limit100th = eventData.th100;
    if (limit100th != null && result > limit100th) return null;

    const ranks = eventData.ranks;
    // 比第一名还快 → WR1
    if (ranks.length === 0 || result < ranks[0]![0]) return 1;
    // 线性查找(只有 100 项)
    for (const [score, rank] of ranks) {
      if (result <= score) return rank;
    }
    return null;
  }

  /** 通过 WCA JSON API 取单个榜单 Top100。 */
  private async fetchTop100(eventId: string, typeName: string): Promise<RankData | null> {
    const url = `https://www.worldcubeassociation.org/results/rankings/${eventId}/${typeName}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    let resp: Response;
    try {
      resp = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
    if (resp.status !== 200) return null;

    const data = (await resp.json()) as { rows?: { best?: number; average?: number }[] };
    const rows = data.rows ?? [];
    if (rows.length === 0) return null;

    // single 用 best,average 用 average;单位厘秒(FMC 步数 / 多盲独立编码)
    const scoreKey = typeName === 'single' ? 'best' : 'average';

    const ranks: [number, number][] = [];
    // WCA JSON API 的 pos 字段不可靠,改用数组顺序推断;并列共享名次
    let prevScore: number | null = null;
    for (let i = 0; i < rows.length; i++) {
      const score = rows[i]![scoreKey] as number | undefined;
      if (score == null || score <= 0) continue;
      const rank = (prevScore !== null && score === prevScore) ? ranks[ranks.length - 1]![1] : i + 1;
      ranks.push([score, rank]);
      prevScore = score;
    }
    if (ranks.length === 0) return null;

    return { th100: ranks[ranks.length - 1]![0], ranks };
  }
}

// 全局单例(对齐 Python `RANKINGS = RankingCache()`)
export const RANKINGS = new RankingCache();
