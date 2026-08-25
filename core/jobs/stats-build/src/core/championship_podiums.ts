// 锦标赛领奖台计算(复刻 WCA 官网 person#championship_podiums + cubingchina getChampionshipPodiums)。
//
// 一个比赛可挂多条 championships 行(如 2024 北美锦标赛同时是当年美国全国赛 → 既 '_North America'
// 又 'US')。对每条 (comp, championship_type) + 每个项目的决赛(round_type c/f, best>0):
//   1. 取该决赛下「符合该锦标赛资格」的选手集合(世界=全部;洲际=本洲;国家=本国 iso2;
//      多国类型 greater_china 等=eligible iso2 集合)。
//   2. 在合格集合里按官方 pos 重排名次:place = (合格集合中 pos 严格更小的人数) + 1(标准并列名次)。
//   3. place ≤ 3 即领奖台,给每个合格领奖者发一行(端点按 wca_id 过滤)。
//
// 这一步必须服务端算:决赛全员名单 + 各自国籍 + pos 客户端拿不到(WCA API 只给本人 overall pos,
// 在「开放赛同时挂洲际/国家锦标赛、外籍选手挤进前列」时 overall pos ≠ 本资格内名次)。
import type { Connection, RowDataPacket } from 'mysql2/promise';

export interface ChampionshipPodiumRow {
  wcaId: string;
  compId: string;
  eventId: string;
  level: string;            // 'world' | continent_id('_North America') | iso2('US') | 'greater_china' …
  place: number;            // 1..3,合格集合内重排
  best: number;
  average: number;          // 0 = 无平均
  attempts: (number | null)[];
  singleRecord: string;     // '' 或 WR/NR/AsR…
  averageRecord: string;
}

interface FinalResult {
  id: number;
  personId: string;
  countryId: string;        // 比赛时国籍(results.country_id)
  pos: number;
  best: number;
  average: number;
  singleRecord: string;
  averageRecord: string;
  attempts: (number | null)[];
}

// 资格判定:返回该比赛某 championship_type 下「某国籍是否合格」的谓词,以及 scope 标签。
function eligibilityFor(
  type: string,
  continentOf: Map<string, string>,
  iso2Of: Map<string, string>,
  eligByType: Map<string, string[]>,
): ((countryId: string) => boolean) | null {
  if (type === 'world') return () => true;
  if (type.startsWith('_')) {
    return (countryId) => continentOf.get(countryId) === type;
  }
  if (/^[A-Z]{2}$/.test(type)) {
    return (countryId) => iso2Of.get(countryId) === type;
  }
  // 多国类型(greater_china 等):eligible iso2 集合
  const isos = new Set((eligByType.get(type) ?? []).map((s) => s.toUpperCase()));
  if (isos.size === 0) return null;
  return (countryId) => {
    const iso = iso2Of.get(countryId);
    return !!iso && isos.has(iso);
  };
}

export async function computeChampionshipPodiums(
  conn: Connection,
  championships: Array<{ championship_type: string; competition_id: string }>,
  continentOf: Map<string, string>,
  iso2Of: Map<string, string>,
  eligByType: Map<string, string[]>,
): Promise<ChampionshipPodiumRow[]> {
  const compIds = [...new Set(championships.map((c) => c.competition_id))];
  if (compIds.length === 0) return [];

  // 拉所有锦标赛比赛的决赛成绩(round c/f, best>0)+ 5 把 attempts。决赛集合很小(几万行)。
  const placeholders = compIds.map(() => '?').join(',');
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT r.id, r.competition_id, r.event_id, r.person_id, r.country_id, r.pos, r.best, r.average,
            r.regional_single_record AS sr, r.regional_average_record AS ar,
            (SELECT GROUP_CONCAT(ra.value ORDER BY ra.attempt_number SEPARATOR ',')
               FROM result_attempts ra WHERE ra.result_id = r.id) AS attempts
       FROM results r
      WHERE r.round_type_id IN ('c','f') AND r.best > 0
        AND r.competition_id IN (${placeholders})`,
    compIds,
  );

  // 按 (comp|event) 聚合决赛全员
  const byCompEvent = new Map<string, FinalResult[]>();
  for (const r of rows) {
    const key = `${r['competition_id']}|${r['event_id']}`;
    const arr = byCompEvent.get(key) ?? [];
    const attRaw = (r['attempts'] as string | null) ?? '';
    const attempts = attRaw === '' ? [] : attRaw.split(',').map((x) => (x === '' ? null : parseInt(x, 10)));
    arr.push({
      id: r['id'] as number,
      personId: r['person_id'] as string,
      countryId: r['country_id'] as string,
      pos: r['pos'] as number,
      best: r['best'] as number,
      average: (r['average'] as number) ?? 0,
      singleRecord: (r['sr'] as string | null) ?? '',
      averageRecord: (r['ar'] as string | null) ?? '',
      attempts,
    });
    byCompEvent.set(key, arr);
  }

  // comp → 该比赛挂的所有 championship_type(去重)
  const typesByComp = new Map<string, Set<string>>();
  for (const ch of championships) {
    const s = typesByComp.get(ch.competition_id) ?? new Set<string>();
    s.add(ch.championship_type);
    typesByComp.set(ch.competition_id, s);
  }

  const out: ChampionshipPodiumRow[] = [];
  const seen = new Set<string>(); // wcaId|comp|event|level 去重

  for (const [compId, types] of typesByComp) {
    for (const type of types) {
      const eligible = eligibilityFor(type, continentOf, iso2Of, eligByType);
      if (!eligible) continue;
      // 该比赛每个项目的决赛
      for (const [key, finalists] of byCompEvent) {
        if (!key.startsWith(`${compId}|`)) continue;
        const eventId = key.slice(compId.length + 1);
        const elig = finalists.filter((f) => eligible(f.countryId));
        if (elig.length === 0) continue;
        for (const f of elig) {
          // 标准并列名次:合格集合中 pos 严格更小的人数 + 1
          const place = elig.reduce((n, o) => n + (o.pos < f.pos ? 1 : 0), 0) + 1;
          if (place > 3) continue;
          const dedup = `${f.personId}|${compId}|${eventId}|${type}`;
          if (seen.has(dedup)) continue;
          seen.add(dedup);
          out.push({
            wcaId: f.personId,
            compId,
            eventId,
            level: type,
            place,
            best: f.best,
            average: f.average,
            attempts: f.attempts,
            singleRecord: f.singleRecord,
            averageRecord: f.averageRecord,
          });
        }
      }
    }
  }
  return out;
}
