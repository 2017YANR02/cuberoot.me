/**
 * WCA Live 近期纪录查询 + 格式化 —— 移植自退役 Python wca_live_records.py。
 *
 * 只保留 gen_title 需要的两个入口:
 *   - queryRecentRecords(): 拉 WCA Live recentRecords
 *   - formatRecordMessage(record): 单条 record → {cn, en, url}
 *
 * 纪录文案直接复用权威的 record_format.ts(formatRecordMessage),世界排名用本工具自带的
 * 离线 RANKINGS(live 拉 WCA Top100)注入。record_format 全站唯一一份,不再有 Python 副本。
 */
import {
  formatRecordMessage as fmtRecord,
  type RecordEvent,
  type FormattedRecord,
} from '../utils/record_format.js';
import { enrichName } from './wca_local_names.js';
import { RANKINGS } from './wca_rankings.js';

const WCA_LIVE_API = 'https://live.worldcubeassociation.org/api';

// GraphQL 查询:获取近期纪录的完整信息(结构与 Python RECORDS_QUERY 1:1)
const RECORDS_QUERY = `
{
  recentRecords {
    id
    tag
    type
    attemptResult
    result {
      person {
        name
        wcaId
        country {
          name
          iso2
        }
      }
      round {
        id
        name
        competitionEvent {
          event {
            id
            name
          }
          competition {
            id
            name
            venues {
              country {
                iso2
              }
            }
          }
        }
      }
    }
  }
}
`;

export interface LiveRecord {
  id: string;
  tag: string;
  type: string; // 'single' | 'average'
  attemptResult: number;
  result: {
    person: {
      name: string;
      wcaId: string | null;
      country: { name: string; iso2: string };
    };
    round: {
      id: string;
      name: string;
      competitionEvent: {
        event: { id: string; name: string };
        competition: {
          id: string;
          name: string;
          venues: { country: { iso2: string } }[];
        };
      };
    };
  };
}

/** 查询 WCA Live 最近的纪录列表 */
export async function queryRecentRecords(): Promise<LiveRecord[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const resp = await fetch(WCA_LIVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: RECORDS_QUERY }),
      signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as { data?: { recentRecords?: LiveRecord[] } };
    return data.data?.recentRecords ?? [];
  } finally {
    clearTimeout(t);
  }
}

/** WCA Live GraphQL record → record_format 的 RecordEvent(对应 Python _record_to_kwargs) */
async function recordToEvent(record: LiveRecord): Promise<RecordEvent> {
  const result = record.result;
  const person = result.person;
  const round = result.round;
  const event = round.competitionEvent.event;
  const competition = round.competitionEvent.competition;
  const venues = competition.venues ?? [];
  const compIso2 = venues.length ? venues[0]!.country.iso2 : '';
  return {
    tag: record.tag,
    rec_type: record.type,
    attempt_result: record.attemptResult,
    event_id: event.id,
    event_name: event.name,
    // WCA Live 不返本地名,从 WCA REST 补全 "Lim Hung" → "Lim Hung (林弘)"
    person_name: await enrichName(person.name, person.wcaId),
    person_iso2: person.country.iso2,
    person_country_en: person.country.name,
    comp_name: competition.name,
    comp_iso2: compIso2,
    url: `https://live.worldcubeassociation.org/competitions/${competition.id}/rounds/${round.id}`,
  };
}

const getRank = (eventId: string, recType: string, value: number) =>
  RANKINGS.getWorldRank(eventId, recType, value);

/** 单条 WCA Live record → {cn, en, url}(世界排名注入离线 RANKINGS) */
export async function formatRecordMessage(record: LiveRecord): Promise<FormattedRecord> {
  const ev = await recordToEvent(record);
  return fmtRecord(ev, getRank);
}
