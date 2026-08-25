// NOTE: 比赛场馆海拔(米) — WCA 不提供,由经纬度反查 DEM。
// 数据源:Open-Meteo Elevation API(Copernicus GLO-90 卫星 DEM,免费无 key,批量 ≤100 坐标/请求)。
// 缓存:stats/comp_elevations.json,{ "lat,lng"(4 位小数) → 整数米 }。场馆坐标不变即永久命中,
// CI 增量只为新比赛发请求;按坐标(非比赛 id)做 key,系列赛共用场馆天然去重。
// 失败语义:批次重试耗尽只 WARN 并跳过(该批比赛本轮缺 elevation 字段,下轮重试),不崩 workflow。
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const API_URL = 'https://api.open-meteo.com/v1/elevation';
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 300;

/** 缓存 key:4 位小数(~11m,超出 DEM 90m 网格精度),同场馆微小坐标差也能命中 */
export function elevationKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

interface HasCoords {
  latitude_degrees?: number | null;
  longitude_degrees?: number | null;
  elevation?: number;
}

/** 有效坐标 → 缓存 key;缺坐标 / 非有限值 / (0,0) 哨兵(多地代码) → null */
function keyOf(c: HasCoords): string | null {
  const lat = c.latitude_degrees, lng = c.longitude_degrees;
  if (lat == null || lng == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return elevationKey(lat, lng);
}

// 429 = 免费配额用尽(实测 5000 坐标/小时,10000/天),小时内不会恢复 → 直接中止本轮,
// 剩余坐标留给下轮(CI 日更 / 回填循环)增量补,不做无谓重试。
async function fetchBatch(lats: number[], lngs: number[]): Promise<number[] | 'quota' | null> {
  const url = `${API_URL}?latitude=${lats.join(',')}&longitude=${lngs.join(',')}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 30_000);
      try {
        const resp = await fetch(url, { signal: ctrl.signal });
        if (resp.status === 429) return 'quota';
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as { elevation?: unknown };
        if (!Array.isArray(data.elevation) || data.elevation.length !== lats.length) {
          throw new Error('bad response shape');
        }
        return data.elevation as number[];
      } finally {
        clearTimeout(t);
      }
    } catch (e) {
      console.log(`[ELEV][WARN] 批次请求失败 (${(e as Error).message}), 重试 ${attempt + 1}/3...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return null;
}

/**
 * 就地给 comps 补 elevation 字段(整数米,含负值如死海沿岸;无有效坐标的条目不写字段)。
 * 缓存 miss 的坐标批量查 API 并回写 cachePath(key 排序,diff 稳定)。
 * 返回本轮统计:failed>0 = 配额/网络导致部分坐标没查到,下轮增量续。
 */
export async function enrichCompElevations(
  comps: HasCoords[],
  cachePath: string,
): Promise<{ missing: number; fetched: number; failed: number }> {
  let cache: Record<string, number> = {};
  if (existsSync(cachePath)) {
    try {
      cache = JSON.parse(readFileSync(cachePath, 'utf-8')) as Record<string, number>;
    } catch {
      console.log('[ELEV][WARN] 缓存损坏,重建');
      cache = {};
    }
  }

  const missing = new Map<string, [number, number]>();
  for (const c of comps) {
    const k = keyOf(c);
    if (k && !(k in cache)) missing.set(k, [c.latitude_degrees!, c.longitude_degrees!]);
  }

  let fetched = 0;
  let failed = 0;
  if (missing.size > 0) {
    const entries = [...missing.entries()];
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const arr = await fetchBatch(batch.map(([, v]) => v[0]), batch.map(([, v]) => v[1]));
      if (arr === 'quota') {
        failed += entries.length - i;
        console.log(`[ELEV][WARN] 配额用尽(429),本轮跳过剩余 ${entries.length - i} 坐标,下轮增量续`);
        break;
      }
      if (arr) {
        batch.forEach(([k], j) => {
          const v = arr[j];
          if (typeof v === 'number' && Number.isFinite(v)) {
            cache[k] = Math.round(v);
            fetched++;
          } else {
            failed++;
          }
        });
      } else {
        failed += batch.length;
      }
      if (i + BATCH_SIZE < entries.length) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
    if (fetched > 0) {
      const sorted: Record<string, number> = {};
      for (const k of Object.keys(cache).sort()) sorted[k] = cache[k]!;
      writeFileSync(cachePath, JSON.stringify(sorted), 'utf-8');
    }
    console.log(`[ELEV] 新坐标 ${missing.size}: 查得 ${fetched}, 失败 ${failed}; 缓存共 ${Object.keys(cache).length} 条`);
  }

  let applied = 0;
  for (const c of comps) {
    const k = keyOf(c);
    const v = k != null ? cache[k] : undefined;
    if (v != null) {
      c.elevation = v;
      applied++;
    }
  }
  console.log(`[ELEV] ${applied}/${comps.length} 场比赛已带海拔`);
  return { missing: missing.size, fetched, failed };
}
