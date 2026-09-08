import { calculateCompetitionStreak, calculatePersonalRecordStreak } from '@cuberoot/shared/pr-streak';
import { roundChronologicalOrder } from '@cuberoot/shared/wca-round';
import { ALL_EVENT_IDS, CANCELLED_EVENT_IDS } from './event-constants';
import { decodeMbldFields } from './mbf-average';
import { CONTINENT_RECORD_ABBR, ISO2_TO_CONTINENT } from './continent';
import { toWcaEventId } from './wca-events';
import { wcaResultRowKey, type WcaResultRow, type WcaCompetition, type ChampionshipPodiumRow } from './wca-person-api';
import { statsUrl } from './stats-base';

// One catalog owns the rules shown in the directory and on earned badges.
export const EXPLORER_ACHIEVEMENTS = {
  together: { title: { zh: '并肩登台', en: 'Side by side' }, tiers: [10, 50, 100, 500], stat: 'most_podiums_together', description: { zh: '与同一选手共同登上项目领奖台至少 10／50／100／500 次。', en: 'Share an event podium with the same person at least 10 / 50 / 100 / 500 times.' } },
  finals: { title: { zh: '决赛常客', en: 'Finals regular' }, tiers: [100, 500, 1000, 2000], stat: 'most_finals', description: { zh: '正式参加至少 100／500／1000／2000 场项目决赛，DNF 计入，DNS 不计。', en: 'Participate in at least 100 / 500 / 1000 / 2000 official event finals. DNF counts; DNS does not.' } },
  weekly: { title: { zh: '每周之巅', en: 'Weekly summit' }, tiers: [10, 50, 100], stat: 'winned_week_count', description: { zh: '某项目累计至少 10／50／100 周取得全球当周最快单次，含并列，周次按比赛开始日期计算。', en: 'Record an event’s fastest worldwide single in at least 10 / 50 / 100 weeks, including ties. Weeks use competition start dates.' } },
  sub5: { title: { zh: '五秒连击', en: 'Sub-five streak' }, tiers: [5, 10, 20, 50], stat: 'consecutive_sub_5_average', description: { zh: '三阶连续至少 5／10／20／50 个正式轮次的平均低于 5 秒，DNF、DNS 或无平均会中断。', en: 'Finish at least 5 / 10 / 20 / 50 consecutive official 3×3 rounds with averages under five seconds. DNF, DNS or missing averages break the streak.' } },
  firstRecord: { title: { zh: '一鸣惊人', en: 'World-class debut record' }, tiers: [1], stat: 'first_r_is_wr', description: { zh: '生涯第一条正式纪录就是 WR；同日先后无法确认时不推断。', en: 'Your first official record is a WR. Ambiguous ordering within the same day is not inferred.' } },
  worldsBest: { title: { zh: '世锦赛最佳', en: 'Worlds best' }, tiers: [1], stat: 'world_championship_records', description: { zh: '保持某项目世锦赛历史最佳单次或平均，包含追平。', en: 'Hold an event’s best single or average across World Championships, including ties.' } },
  debutWin: { title: { zh: '初战告捷', en: 'Winning debut' }, tiers: [1], stat: null, description: { zh: '首次正式参加某项目的比赛就获得该项目冠军，DNS 不算参赛。', en: 'Win an event at your first official competition in that event. DNS does not count as participation.' } },
  blindQuartet: { title: { zh: '盲拧四重奏', en: 'Blindfold quartet' }, tiers: [4], stat: null, description: { zh: '三盲、四盲、五盲和现行多盲均取得正式有效成绩。', en: 'Record successful official results in 3BLD, 4BLD, 5BLD and current multi-blind.' } },
  championPuzzle: { title: { zh: '冠军拼图', en: 'Champion mosaic' }, tiers: [5, 10, 17], stat: null, description: { zh: '曾在至少 5／10／全部 17 个现行项目夺冠。', en: 'Win at least 5 / 10 / all 17 current events.' } },
  podiumPuzzle: { title: { zh: '领奖台拼图', en: 'Podium mosaic' }, tiers: [5, 10, 17], stat: null, description: { zh: '曾在至少 5／10／全部 17 个现行项目登上领奖台。', en: 'Reach the podium in at least 5 / 10 / all 17 current events.' } },
  evergreen: { title: { zh: '常青树', en: 'Evergreen competitor' }, tiers: [5, 10, 15, 20], stat: null, description: { zh: '连续至少 5／10／15／20 个自然年正式参赛。DNF 计入，DNS 不计。', en: 'Compete officially in at least 5 / 10 / 15 / 20 consecutive calendar years. DNF counts; DNS does not.' } },
  defend: { title: { zh: '卫冕王冠', en: 'Defending crown' }, tiers: [2, 3], stat: null, description: { zh: '同项目连续至少两届实际举行的世锦赛夺冠，缺席或未夺冠会中断。', en: 'Win the same event at two or more consecutive held World Championships. Missing an edition or not winning breaks the streak.' } },
  medalTrio: { title: { zh: '奖牌三色', en: 'Medal trilogy' }, tiers: [3], stat: null, description: { zh: '同项目在历届世锦赛集齐金、银、铜牌。', en: 'Collect gold, silver and bronze in the same event across World Championships.' } },
  perfectBlind: { title: { zh: '完美多盲', en: 'Perfect multi-blind' }, tiers: [10, 20, 30], stat: null, description: { zh: '一次现行多盲正式尝试零失误成功至少 10／20／30 个魔方。', en: 'Solve at least 10 / 20 / 30 cubes without a miss in one official current multi-blind attempt.' } },
  blindRelay: { title: { zh: '盲拧接力', en: 'Blindfold relay' }, tiers: [3], stat: null, description: { zh: '同场正式比赛的三盲、四盲、五盲全部取得有效成绩。', en: 'Record successful 3BLD, 4BLD and 5BLD results at the same official competition.' } },
  traveler: { title: { zh: '环球旅人', en: 'World traveler' }, tiers: [5, 10, 20, 50], stat: 'most_visited_countries', description: { zh: '在 5／10／20／50 个国家或地区正式参赛，以比赛举办地计算，同一地点只计一次。', en: 'Compete officially in 5 / 10 / 20 / 50 countries or regions, counted by competition location. Each country or region counts once.' } },
  continents: { title: { zh: '洲际足迹', en: 'Continental footprints' }, tiers: [2, 3, 4, 5, 6], stat: 'most_visited_continents', description: { zh: '在 2／3／4／5／6 个大洲正式参赛，按 WCA 六大洲分类，以比赛举办地计算。', en: 'Compete officially on 2 / 3 / 4 / 5 / 6 continents, using competition locations and the WCA six-continent classification.' } },
  breakthrough: { title: { zh: '突破不停', en: 'Personal best streak' }, tiers: [5, 10, 20], stat: 'longest_streak_of_personal_records', description: { zh: '连续 5／10／20 场正式比赛取得至少一项 PR，包含追平。', en: 'Set or tie a personal best at 5 / 10 / 20 consecutive official competitions.' } },
  podiumStreak: { title: { zh: '领奖台常客', en: 'Podium streak' }, tiers: [5, 10, 20], stat: 'longest_streak_of_podiums', description: { zh: '同项目连续参赛 5／10／20 场登台。未参加该项目的比赛不计；未进决赛或无有效成绩会中断。', en: 'Reach the podium in an event at 5 / 10 / 20 consecutive competitions entered in that event. Missing the final or having no successful result breaks the streak.' } },
  haul: { title: { zh: '满载而归', en: 'Medal harvest' }, tiers: [5, 10], stat: 'most_podiums_at_single_competition', description: { zh: '单场正式比赛在至少 5／10 个项目登台。', en: 'Reach the podium in at least 5 / 10 events at one official competition.' } },
  sweep: { title: { zh: '横扫全场', en: 'Clean sweep' }, tiers: [3, 5, 10], stat: 'complete_competition_winners', description: { zh: '包揽一场比赛的全部项目冠军，至少包含 3／5／10 个项目。', en: 'Win every event at one competition offering at least 3 / 5 / 10 events.' } },
  storm: { title: { zh: '纪录风暴', en: 'Record storm' }, tiers: [3, 5], stat: 'most_records_at_single_competition', description: { zh: '单场获得至少 3／5 次纪录，WR／CR／NR 按官方标记分别计数，单次与平均分开，包含追平。', en: 'Achieve at least 3 / 5 records at one competition. WR / CR / NR markers count separately, as do singles and averages, including ties.' } },
  constellation: { title: { zh: '多项纪录选手', en: 'Record constellation' }, tiers: [3, 5], stat: 'records_in_most_events', description: { zh: '在至少 3／5 个不同项目曾获纪录，WR／CR／NR 按官方标记分别统计。', en: 'Earn record markers in at least 3 / 5 distinct events, counted separately for WR / CR / NR.' } },
  monument: { title: { zh: '时间之碑', en: 'Standing the test of time' }, tiers: [365, 1095, 1825], stat: 'longest_standing_records', description: { zh: '某条正式 WR 或洲际纪录在被更快成绩打破前保持至少 365／1095／1825 天。追平不结束保持期；退役项目只计至退役。', en: 'Hold an official world or continental record for at least 365 / 1095 / 1825 days before a better result. Ties do not end its duration; retired events stop accruing days at retirement.' } },
  solves: { title: { zh: '万次复原', en: 'Ten thousand solves' }, tiers: [10000, 20000], stat: 'most_completed_solves', description: { zh: '正式比赛累计成功复原至少 10000／20000 次。DNF、DNS 不计；多盲每次尝试计一次。', en: 'Complete at least 10,000 / 20,000 successful official attempts. DNF and DNS are excluded; a multi-blind attempt counts once.' } },
  firstWin: { title: { zh: '终于夺冠', en: 'The long-awaited win' }, tiers: [20, 50], stat: 'most_competitions_before_winning', description: { zh: '同项目经历至少 20／50 场未夺冠的比赛后，首次获得项目冠军。', en: 'Win an event for the first time after at least 20 / 50 prior competitions in that event without a win.' } },
  butterfly: { title: { zh: '破茧成功', en: 'Breakthrough blindfolded' }, tiers: [10, 20, 40], stat: 'most_solves_before_bld_success', description: { zh: '同一盲拧项目经历至少 10／20／40 次 DNF 后首次成功。DNS 不计。', en: 'Succeed in a blindfolded event for the first time after at least 10 / 20 / 40 DNF attempts. DNS does not count.' } },
  calendar: { title: { zh: '日期彩蛋', en: 'Calendar coincidence' }, tiers: [1], stat: 'date_match_pr', description: { zh: 'PR 秒数写成 M.DD 时，对应日期落在比赛赛期内，例如 5.20 对应 5 月 20 日。跨日比赛不推断具体复原日期。', en: 'A PR in M.DD seconds matches a date within the competition, such as 5.20 on May 20. Multi-day events do not establish the actual solve date.' } },
  triplets: { title: { zh: '三人同分', en: 'Three of a kind' }, tiers: [1], stat: 'tied_podium_results', description: { zh: '同轮官方前三名三位选手的有效单次或平均完全相同，你是其中之一。不含最少步，也不要求决赛。', en: 'Be one of the official top three in a round with identical valid singles or averages. Fewest Moves is excluded; the round need not be a final.' } },
  passport: { title: { zh: '海外奖牌收藏家', en: 'Medal passport' }, tiers: [3, 5, 10], stat: 'best_medal_collection_from_abroad_by_person', description: { zh: '在至少 3／5／10 个海外国家或地区登台。海外以主页当前代表的国家或地区为基准。', en: 'Reach the podium in at least 3 / 5 / 10 foreign countries or regions, relative to the country or region currently represented on the profile.' } },
  worldPodium: { title: { zh: '世锦赛领奖台', en: 'World Championship podium' }, tiers: [1], stat: 'world_championship_podiums_by_person', description: { zh: '曾获世锦赛项目奖牌，每项目展示历史最好奖牌，包含银牌和铜牌。', en: 'Win a World Championship medal. Each event displays its best historical medal, including silver and bronze.' } },
} as const;
export type ExplorerKind = keyof typeof EXPLORER_ACHIEVEMENTS;
export type AchievementEvidence = { compId?: string; date?: string; endDate?: string; event?: string; value?: number; type?: 'single' | 'average'; text?: string; place?: number; personId?: string; personName?: string };
export type ExplorerAchievement = { kind: ExplorerKind; count: number; tier: number; event?: string; record?: 'WR' | 'CR' | 'NR'; place?: number; evidence: AchievementEvidence[] };
export function explorerTier(kind: ExplorerKind, count: number) {
  return Number.isSafeInteger(count) && count > 0 ? EXPLORER_ACHIEVEMENTS[kind].tiers.findLast(n => count >= n) : undefined;
}
function recordLevel(marker?: string | null): 'WR' | 'CR' | 'NR' | undefined {
  return marker === 'WR' || marker === 'NR' ? marker : marker === 'CR' || Object.values(CONTINENT_RECORD_ABBR).includes(marker ?? '') ? 'CR' : undefined;
}
export function personalExplorerAchievements(results: WcaResultRow[], comps: WcaCompetition[], country = '', podiums: (Pick<ChampionshipPodiumRow, 'level' | 'place' | 'eventId'> & Partial<ChampionshipPodiumRow>)[] = [], worldEditions: string[] = []): ExplorerAchievement[] {
  const out: ExplorerAchievement[] = [];
  const add = (kind: ExplorerKind, count: number, evidence: AchievementEvidence[], extra: Partial<ExplorerAchievement> = {}) => {
    const tier = explorerTier(kind, count);
    if (tier) out.push({ kind, count, tier, evidence, ...extra });
  };
  const compMap = new Map(comps.map(c => [c.id, c]));
  const date = (r: WcaResultRow) => compMap.get(r.competition_id)?.start_date || r.date || '';
  // Official rows only. Identity deduplication prevents mirrored rounds inflating awards.
  const rows = [...new Map(results.filter(r => !r.live && r.competition_id && ALL_EVENT_IDS.includes(r.event_id)).map(r => [wcaResultRowKey(r), r])).values()]
    .sort((a, b) => date(a).localeCompare(date(b)) || a.competition_id.localeCompare(b.competition_id) || roundChronologicalOrder(a.round_type_id) - roundChronologicalOrder(b.round_type_id));
  const ev = (r: WcaResultRow): AchievementEvidence => ({ compId: r.competition_id, date: date(r), event: r.event_id });
  const attended = [...new Set(rows.filter(r => r.best > 0 || r.best === -1).map(r => r.competition_id))];
  const locations = new Map<string, AchievementEvidence>();
  const continents = new Map<string, AchievementEvidence>();
  for (const id of attended) {
    const c = compMap.get(id);
    const iso = c?.country_iso2.toUpperCase();
    const continent = iso && ISO2_TO_CONTINENT[iso];
    if (!c || !iso || !continent) continue;
    if (!locations.has(iso)) locations.set(iso, { compId: id, date: c.start_date, text: iso });
    if (!continents.has(continent)) continents.set(continent, { compId: id, date: c.start_date, text: continent });
  }
  add('traveler', locations.size, [...locations.values()]);
  add('continents', continents.size, [...continents.values()]);
  // Missing dates cannot establish chronological achievements.
  const dated = rows.filter(r => /^\d{4}-\d{2}-\d{2}$/.test(date(r)));
  const completeDates = dated.length === rows.length;
  if (completeDates) {
    const streak = calculatePersonalRecordStreak(dated.map(r => ({ competitionId: r.competition_id, competitionDate: date(r), eventId: r.event_id, single: r.best, average: r.average }))).longest;
    add('breakthrough', streak.length, streak.map(compId => ({ compId, date: compMap.get(compId)?.start_date })));
  }
  const finals = rows.filter(r => ['f', 'c'].includes(r.round_type_id) && r.best > 0 && r.pos >= 1 && r.pos <= 3);
  const participation = rows.filter(r => r.best > 0 || r.best === -1);
  const enteredFinals = participation.filter(r => ['f', 'c'].includes(r.round_type_id));
  add('finals', enteredFinals.length, EXPLORER_ACHIEVEMENTS.finals.tiers.flatMap(n => enteredFinals[n - 1] ? [{ ...ev(enteredFinals[n - 1]), text: String(n) }] : []));
  const activeMedals = finals.filter(r => !CANCELLED_EVENT_IDS.has(r.event_id));
  for (const kind of ['championPuzzle', 'podiumPuzzle'] as const) {
    const events = new Map<string, WcaResultRow>();
    for (const r of activeMedals) if ((kind === 'podiumPuzzle' || r.pos === 1) && !events.has(r.event_id)) events.set(r.event_id, r);
    add(kind, events.size, [...events.values()].map(ev));
  }
  const blindEvents = ['333bf', '444bf', '555bf', '333mbf'];
  const blindSuccess = blindEvents.flatMap(event => { const r = rows.find(r => r.event_id === event && r.best > 0); return r ? [r] : []; });
  add('blindQuartet', blindSuccess.length, blindSuccess.map(ev));
  const blindByComp = new Map<string, Map<string, WcaResultRow>>();
  for (const r of rows) if (r.best > 0 && blindEvents.slice(0, 3).includes(r.event_id)) {
    const success = blindByComp.get(r.competition_id) ?? new Map<string, WcaResultRow>();
    if (!success.has(r.event_id)) success.set(r.event_id, r);
    blindByComp.set(r.competition_id, success);
  }
  const relay = [...blindByComp.values()].find(success => success.size === 3);
  if (relay) add('blindRelay', 3, [...relay.values()].map(ev));
  let perfect: { row: WcaResultRow; value: number; count: number } | undefined;
  for (const r of rows.filter(r => r.event_id === '333mbf')) for (const value of r.attempts) {
    if (!Number.isSafeInteger(value) || value <= 0 || value >= 1_000_000_000) continue;
    const decoded = decodeMbldFields(value);
    const count = 99 - decoded.dd;
    if (decoded.missed === 0 && decoded.seconds > 0 && decoded.seconds <= 3600 && count >= 2 && count > (perfect?.count ?? 0)) perfect = { row: r, value, count };
  }
  if (perfect) add('perfectBlind', perfect.count, [{ ...ev(perfect.row), value: perfect.value, type: 'single' }], { event: '333mbf' });
  if (completeDates) {
    const years = [...new Map(participation.map(r => [Number(date(r).slice(0, 4)), r])).entries()].sort((a, b) => a[0] - b[0]);
    let run: WcaResultRow[] = [], longest: WcaResultRow[] = [], previous = -1;
    for (const [year, r] of years) { run = year === previous + 1 ? [...run, r] : [r]; previous = year; if (run.length > longest.length) longest = run; }
    add('evergreen', longest.length, longest.map(ev));
    let subRun: WcaResultRow[] = [], subBest: WcaResultRow[] = [];
    for (const r of rows.filter(r => r.event_id === '333')) { subRun = r.average > 0 && r.average < 500 ? [...subRun, r] : []; if (subRun.length > subBest.length) subBest = subRun; }
    add('sub5', subBest.length, subBest.map(ev), { event: '333' });
    const marked = rows.filter(r => r.best > 0 && recordLevel(r.regional_single_record) || r.average > 0 && recordLevel(r.regional_average_record));
    if (marked.length) {
      const earliest = marked.filter(r => date(r) === date(marked[0]));
      const markers = earliest.flatMap(r => [[r.best, r.regional_single_record], [r.average, r.regional_average_record]] as const).filter(([value, marker]) => value > 0 && recordLevel(marker));
      if (markers.every(([, marker]) => marker === 'WR')) add('firstRecord', 1, earliest.map(ev));
    }
    for (const event of new Set(participation.map(r => r.event_id))) {
      const first = participation.find(r => r.event_id === event)!;
      const win = finals.find(r => r.event_id === event && r.competition_id === first.competition_id && r.pos === 1);
      if (win) add('debutWin', 1, [ev(win)], { event });
    }
  }
  const medals = new Map<string, WcaResultRow[]>();
  for (const r of finals) medals.set(r.competition_id, [...medals.get(r.competition_id) ?? [], r]);
  const bestHaul = [...medals.values()].sort((a, b) => b.length - a.length)[0];
  if (bestHaul) add('haul', bestHaul.length, bestHaul.map(ev));
  const abroad = new Map<string, AchievementEvidence>();
  if (ISO2_TO_CONTINENT[country.toUpperCase()]) for (const r of finals) {
    const iso = compMap.get(r.competition_id)?.country_iso2.toUpperCase();
    if (iso && ISO2_TO_CONTINENT[iso] && iso !== country.toUpperCase() && !abroad.has(iso)) abroad.set(iso, { ...ev(r), text: iso });
  }
  add('passport', abroad.size, [...abroad.values()]);
  const successful: AchievementEvidence[] = [];
  let solveCount = 0;
  for (const r of rows) {
    const n = r.attempts.filter(v => v > 0).length;
    if (n) { solveCount += n; successful.push({ ...ev(r), text: String(solveCount) }); }
  }
  // Store milestone crossings rather than thousands of attempts in the popup.
  add('solves', solveCount, EXPLORER_ACHIEVEMENTS.solves.tiers.flatMap(n => { const e = successful.find(e => Number(e.text) >= n); return e ? [{ ...e, text: String(n) }] : []; }));
  for (const event of new Set(rows.map(r => r.event_id))) {
    const eventRows = rows.filter(r => r.event_id === event);
    if (completeDates) {
      const ids = [...new Set(eventRows.map(r => r.competition_id))];
      const reached = new Set(finals.filter(r => r.event_id === event).map(r => r.competition_id));
      const streak = calculateCompetitionStreak(ids, reached).longest;
      add('podiumStreak', streak.length, streak.map(compId => ({ compId, date: compMap.get(compId)?.start_date })), { event });
      const winner = eventRows.find(r => ['f', 'c'].includes(r.round_type_id) && r.pos === 1 && r.best > 0);
      if (winner) add('firstWin', ids.indexOf(winner.competition_id), [ev(winner)], { event });
      if (['333bf', '444bf', '555bf', '333mbf'].includes(event)) {
        let failures = 0;
        outer: for (const r of eventRows) for (const v of r.attempts) {
          if (v === -1) failures++;
          else if (v > 0) { add('butterfly', failures, [{ ...ev(r), value: v, type: 'single' }], { event }); break outer; }
        }
      }
    }
  }
  // A championship feed can arrive before the person's results.
  for (const event of new Set(podiums.filter(p => p.level === 'world' && p.place >= 1 && p.place <= 3).map(p => p.eventId))) {
    if (out.some(a => a.kind === 'worldPodium' && a.event === event)) continue;
    const world = podiums.filter(p => p.level === 'world' && p.eventId === event && p.place >= 1 && p.place <= 3);
    add('worldPodium', world.length, world.map(p => ({ compId: p.compId, date: p.compDate ?? undefined, event, place: p.place })), { event, place: Math.min(...world.map(p => p.place)) });
    const colors = new Map(world.map(p => [p.place, p]));
    add('medalTrio', colors.size, [...colors.values()].map(p => ({ compId: p.compId, date: p.compDate ?? undefined, event, place: p.place })), { event });
    const wins = new Map(world.filter(p => p.place === 1 && p.compId).map(p => [p.compId!, p]));
    let run: AchievementEvidence[] = [], longest: AchievementEvidence[] = [];
    for (const compId of worldEditions) {
      const p = wins.get(compId);
      run = p ? [...run, { compId, date: p.compDate ?? undefined, event, place: 1 }] : [];
      if (run.length > longest.length) longest = run;
    }
    add('defend', longest.length, longest, { event });
  }
  for (const record of ['WR', 'CR', 'NR'] as const) {
    const records: AchievementEvidence[] = [];
    for (const r of rows) for (const [value, marker, type] of [[r.best, r.regional_single_record, 'single'], [r.average, r.regional_average_record, 'average']] as const) {
      if (value > 0 && recordLevel(marker) === record) records.push({ ...ev(r), value, type });
    }
    const events = new Map(records.map(e => [e.event!, e]));
    add('constellation', events.size, [...events.values()], { record });
    const grouped = new Map<string, AchievementEvidence[]>();
    for (const e of records) grouped.set(e.compId!, [...grouped.get(e.compId!) ?? [], e]);
    const best = [...grouped.values()].sort((a, b) => b.length - a.length)[0];
    if (best) add('storm', best.length, best, { record });
  }
  return out;
}

export interface AchievementStat { rows?: unknown[][]; sections?: { title: string; rows: unknown[][] }[]; panels?: { id: string; sections?: { title: string; rows: unknown[][] }[] }[]; achievementRows?: unknown[][]; worldEditions?: { compId: string; date: string; events: string[] }[] }

// These compact rows come from the full calculation, independently of visible top-N tables.
export function expansionStatAchievements(kind: 'together' | 'weekly' | 'worldsBest', data: AchievementStat, wcaId: string): ExplorerAchievement[] {
  const out = new Map<string, ExplorerAchievement>();
  for (const row of data.achievementRows ?? []) {
    if (kind === 'together') {
      if (row[0] !== wcaId && row[1] !== wcaId) continue;
      const count = Number(row[2]), tier = explorerTier(kind, count);
      if (!tier || row[0] === row[1]) continue;
      const partner = row[0] === wcaId ? 1 : 0;
      const personId = String(row[partner]);
      out.set(personId, { kind, count, tier, evidence: [{ personId, personName: typeof row[partner + 3] === 'string' ? String(row[partner + 3]) : undefined, text: String(count) }] });
    } else {
      if (row[0] !== wcaId || !ALL_EVENT_IDS.includes(String(row[1]))) continue;
      const event = String(row[1]);
      if (kind === 'weekly') {
        const count = Number(row[2]), tier = explorerTier(kind, count);
        if (tier) out.set(event, { kind, count, tier, event, evidence: [{ event, text: String(count) }] });
      } else {
        const type = row[2];
        const value = Number(row[3]);
        if ((type !== 'single' && type !== 'average') || !Number.isSafeInteger(value) || value <= 0 || type === 'average' && ['333mbf', '333mbo'].includes(event)) continue;
        const previous = out.get(event);
        const evidence: AchievementEvidence = { event, type, value, compId: String(row[4]) };
        if (previous) previous.evidence.push(evidence);
        else out.set(event, { kind, count: 1, tier: 1, event, evidence: [evidence] });
      }
    }
  }
  // One badge per family, with every qualifying partner in its history.
  if (kind === 'together' && out.size) {
    const all = [...out.values()].sort((a, b) => b.count - a.count);
    return [{ ...all[0], evidence: all.flatMap(a => a.evidence) }];
  }
  return [...out.values()];
}
export function statExplorerAchievements(kind: 'sweep' | 'calendar' | 'triplets', data: AchievementStat, wcaId: string): ExplorerAchievement[] {
  const groups = kind === 'calendar' ? data.panels?.find(p => p.id === 'ranking')?.sections ?? [] : data.sections ?? [{ title: '', rows: data.rows ?? [] }];
  const earned = new Map<string, ExplorerAchievement>();
  for (const section of groups) for (const row of section.rows) {
    const people = kind === 'triplets' ? row.slice(2, 5) : [row[1]];
    if (!people.some(cell => String(cell).includes(`/persons/${wcaId})`))) continue;
    const event = kind === 'sweep' ? undefined : toWcaEventId(section.title.replace(/ - (Single|Average)$/, ''));
    if (event && !ALL_EVENT_IDS.includes(event)) continue;
    const compId = String(row.at(-1)).match(/\/competitions\/([^/)#]+)/)?.[1];
    const count = kind === 'sweep' ? Number(row[0]) : 1;
    const tier = explorerTier(kind, count);
    if (!tier) continue;
    const evidence: AchievementEvidence = { compId, event, date: kind === 'calendar' ? String(row[3]) : undefined, text: kind === 'calendar' ? String(row[2]) : kind === 'triplets' ? `${row[0]} (${row[1]})` : String(count) };
    const key = event ?? kind;
    const previous = earned.get(key);
    if (!previous || kind === 'sweep' && count > previous.count) earned.set(key, { kind, count, tier, event, evidence: [evidence] });
    else if (kind !== 'sweep') { previous.count++; previous.evidence.push(evidence); }
  }
  return [...earned.values()];
}

export interface RecordHistoryBundle { updated: string; rows: { e: string; t: 's' | 'a'; v: number; l: string; p: string; c: string; d: string }[] }
export function standingRecordAchievements(bundle: RecordHistoryBundle, wcaId: string, record: 'WR' | 'CR'): ExplorerAchievement[] {
  const out = new Map<string, ExplorerAchievement>();
  const groups = new Map<string, RecordHistoryBundle['rows']>();
  for (const r of bundle.rows) {
    // History includes unofficial multi-blind means; they are not WCA records.
    if (!(r.v > 0) || !ALL_EVENT_IDS.includes(r.e) || ['333mbf', '333mbo'].includes(r.e) && r.t === 'a' || !recordLevel(r.l) || record === 'WR' && r.l !== 'WR') continue;
    const key = `${r.e}:${r.t}`;
    groups.set(key, [...groups.get(key) ?? [], r]);
  }
  for (const rows of groups.values()) {
    rows.sort((a, b) => a.d.localeCompare(b.d));
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.p !== wcaId || record === 'CR' && recordLevel(r.l) !== 'CR') continue;
      const end = rows.slice(i + 1).find(next => next.v < r.v)?.d ?? bundle.updated;
      const retirement = r.e === '333ft' ? '2020-01-01' : ['magic', 'mmagic'].includes(r.e) ? '2013-01-01' : r.e === '333mbo' ? '2009-01-01' : undefined;
      const cutoff = retirement && retirement < end ? retirement : end;
      const days = Math.floor((Date.parse(cutoff) - Date.parse(r.d)) / 86400000);
      const tier = explorerTier('monument', days);
      const key = r.e;
      if (tier && days > (out.get(key)?.count ?? 0)) out.set(key, { kind: 'monument', count: days, tier, event: r.e, record, evidence: [{ compId: r.c, date: r.d, endDate: cutoff, event: r.e, value: r.v, type: r.t === 's' ? 'single' : 'average' }] });
    }
  }
  return [...out.values()];
}

// Reuse complete existing feeds, never infer eligibility from truncated top-N lists.
const achievementFeedCache = new Map<string, { expires: number; data: AchievementStat }>();
async function fetchAchievementFeed(stat: string, signal: AbortSignal): Promise<AchievementStat> {
  const cached = achievementFeedCache.get(stat);
  if (cached && cached.expires > Date.now()) return cached.data;
  const response = await fetch(statsUrl(`/stats/${stat}.json`), { signal });
  if (!response.ok) throw new Error(String(response.status));
  const data = await response.json() as AchievementStat;
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  achievementFeedCache.set(stat, { expires: Date.now() + 300_000, data });
  return data;
}
export async function fetchExplorerAchievements(wcaId: string, markers: string[], signal: AbortSignal, podiums: (Pick<ChampionshipPodiumRow, 'level' | 'place' | 'eventId'> & Partial<ChampionshipPodiumRow>)[] = []): Promise<ExplorerAchievement[]> {
  const tasks: Promise<ExplorerAchievement[]>[] = (['sweep', 'calendar', 'triplets'] as const).map(async kind => {
    return statExplorerAchievements(kind, await fetchAchievementFeed(EXPLORER_ACHIEVEMENTS[kind].stat, signal), wcaId);
  });
  for (const kind of ['together', 'weekly', 'worldsBest'] as const) tasks.push((async () => {
    const data = await fetchAchievementFeed(EXPLORER_ACHIEVEMENTS[kind].stat, signal);
    const awards = expansionStatAchievements(kind, data, wcaId);
    if (kind === 'worldsBest' && data.worldEditions) {
      const editions = [...data.worldEditions].sort((a, b) => a.date.localeCompare(b.date)).map(e => e.compId);
      awards.push(...personalExplorerAchievements([], [], '', podiums, [...new Set(editions)]).filter(a => a.kind === 'defend'));
    }
    return awards;
  })());
  const regions: Record<string, string> = { WR: 'world', AfR: 'continent/africa', AsR: 'continent/asia', ER: 'continent/europe', NAR: 'continent/northAmerica', OcR: 'continent/oceania', SAR: 'continent/southAmerica' };
  for (const marker of new Set(markers)) if (regions[marker]) tasks.push((async () => {
    const response = await fetch(statsUrl(`/stats/records/history/${regions[marker]}.json`), { signal });
    if (!response.ok) throw new Error(String(response.status));
    return standingRecordAchievements(await response.json(), wcaId, marker === 'WR' ? 'WR' : 'CR');
  })());
  const results = await Promise.allSettled(tasks);
  const merged = new Map<string, ExplorerAchievement>();
  for (const result of results) if (result.status === 'fulfilled') for (const a of result.value) {
    const key = `${a.kind}:${a.event}:${a.record}`;
    if (!merged.has(key) || merged.get(key)!.count < a.count) merged.set(key, a);
  }
  return [...merged.values()];
}
