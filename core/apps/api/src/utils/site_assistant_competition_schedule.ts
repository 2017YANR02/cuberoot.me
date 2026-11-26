import { isScheduleGroupCode, parseActivityCode, trimWcif, type RawWcif, type ScheduleData } from '@cuberoot/shared/comp-schedule';
import { EVENT_DISPLAY_EN, EVENT_DISPLAY_ZH, WCA_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import { z } from 'zod';
import { readOrganizerCompetition, type OrganizerCompetition } from './site_assistant_competition_organizer.js';
import { roundEventMentions } from './site_assistant_scope.js';
import type { JsonReader, ToolResult } from './site_assistant_tools.js';

const roundSelector = z.enum(['first', 'second', 'third', 'final']);
type RoundSelector = z.infer<typeof roundSelector>;
export const competitionScheduleCall = z.object({
  tool: z.literal('competition_schedule'),
  compId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/).refine(id => !/^\d{4}[A-Z]{4}\d{2}$/i.test(id)),
  event: z.enum(WCA_EVENT_ORDER).optional(),
  round: roundSelector.optional(),
  rounds: z.array(roundSelector).min(2).max(4).optional(),
  groups: z.boolean().optional(),
  group: z.string().regex(/^[A-Za-z0-9]{1,16}$/).optional(),
  schedule: z.boolean().default(true),
  registration: z.boolean().default(false),
  waitlist: z.boolean().optional(),
  personalRegistration: z.boolean().optional(),
}).strict().refine(call => (call.schedule || call.registration) && !(call.round && call.rounds)
  && (call.schedule || !(call.groups || call.group)) && (call.registration || !(call.personalRegistration || call.waitlist)));

type ScheduleCall = z.infer<typeof competitionScheduleCall>;
type Label = (zh: string, en: string) => string;
const roundNumbers = { first: 1, second: 2, third: 3 };
const roundPatterns: Record<RoundSelector, RegExp> = {
  first: /首轮|第\s*[一1]\s*轮|\b(?:(?:first|opening) round|round 1)\b/i,
  second: /第\s*[二2]\s*轮|\b(?:second round|round 2)\b/i,
  third: /第\s*[三3]\s*轮|\b(?:third round|round 3)\b/i,
  final: /决赛|\bfinal(?:s)?\b/i,
};
const scheduleIntent = /赛程|几点|(?:开赛|开场|开始)时间|(?:何时|什么时候).{0,6}(?:比|开赛|开始)|\b(?:schedule|what time|(?:venue|local) time|start(?:ing)? times?|when (?:does|is))\b/i;
const registrationIntent = /报名|候补|名额|\b(?:register|registration|sign up|wait(?:ing)?[ -]?list|spots?)\b/i;
const personalRegistrationIntent = /我的(?:报名|候补|受理)|(?:我|本人).{0,8}(?:报上|被(?:受理|接受)|报名.{0,8}(?:受理|接受|确认|通过|成功|状态)|候补.{0,8}(?:状态|转正|排在|第几))|\b(?:my (?:registration|wait(?:ing)?[ -]?list)|(?:am i|was i|have i been)\s+(?:accepted|registered|waitlisted))\b/i;
const outsideScheduleScope = /成绩|纪录|排名|半决赛|时间差|相差|差多久|\b(?:results|records?|rankings?|semifinals?|time difference|how (?:much later|far apart))\b/i;
const groupIntent = /分组|组别|各组|每组|小组赛程|\b(?:groups?|grouped schedule)\b/i;
const zonedTimestamp = z.iso.datetime({ offset: true });
const instant = (value: unknown) => typeof value === 'string' && zonedTimestamp.safeParse(value).success ? Date.parse(value) : NaN;

/** Round timing is independent of any registration clause in the request. */
export function competitionRoundTiming(text: string): Pick<ScheduleCall, 'event' | 'round' | 'rounds' | 'groups' | 'group'> | undefined {
  if (outsideScheduleScope.test(text)) return;
  const mentions = roundEventMentions(text);
  const event = mentions[0]?.event;
  if (mentions.length && (!event || mentions.some(mention => mention.event !== event))) return;
  const rounds = roundSelector.options.filter(round => roundPatterns[round].test(text));
  const groupNames = new Set([...text.matchAll(/第\s*([A-Za-z0-9]{1,16}|[一二三四五六七八九十])\s*组|\b[Gg]roup\s+([A-Za-z][0-9]{0,3}|[0-9]{1,3})\b|([A-Z][0-9]{0,3})\s*组/g)].map(match => {
    const name = match[1] ?? match[2] ?? match[3];
    const ordinal = '一二三四五六七八九十'.indexOf(name) + 1;
    return ordinal ? String(ordinal) : name.toUpperCase();
  }));
  if (groupNames.size > 1) return;
  const [group] = groupNames;
  const groups = !!group || groupIntent.test(text);
  const asksTiming = scheduleIntent.test(text) || ((rounds.length || groups) && /何时|什么时候|\bwhen\b|\btime\b/i.test(text));
  if (!asksTiming && !/分组(?:安排|赛程)|\bgroup schedule\b/i.test(text)) return;
  if (!event && (rounds.length || !/赛程|\bschedule\b/i.test(text))) return;
  return { event, ...(rounds.length > 1 ? { rounds } : { round: rounds[0] }), ...(groups ? { groups, group } : {}) };
}

export function competitionScheduleRequest(question: string): ScheduleCall | undefined {
  const text = question.normalize('NFKC').trim();
  const link = /(?:https:\/\/(?:www\.)?worldcubeassociation\.org\/competitions\/|(?:https:\/\/(?:www\.)?cuberoot\.me)?\/(?:zh\/|en\/)?wca\/comp\/)([A-Za-z0-9_-]{1,100})(?=[/?#\s，。！？,]|$)(?:[/?#][^\s，。！？,]*)?/i;
  const explicitId = /\b[A-Z][A-Za-z0-9_-]{1,95}(?:19|20)\d{2}\b/;
  const match = text.match(link) ?? text.match(explicitId);
  if (!match) return;
  const rest = text.replace(match[0], '');
  if (outsideScheduleScope.test(rest)
    || /上次|顺便|资格|报名费|报名流程|报名时间|什么时候(?:开始报名|截止)|报名(?:何时|什么时候|几点|截止时间)|\b(?:entry fee|eligible|last competed|when (?:does )?registration|(?:when|what time) can I (?:register|sign up))\b/i.test(rest)
    || link.test(rest) || explicitId.test(rest)) return;
  const personalRegistration = personalRegistrationIntent.test(rest);
  const registration = personalRegistration || registrationIntent.test(rest);
  const timing = competitionRoundTiming(rest);
  if (!timing && (scheduleIntent.test(rest) || !registration)) return;
  if (/对比|比较|\bcompare\b/i.test(rest) && !timing?.rounds) return;
  const call = competitionScheduleCall.safeParse({ tool: 'competition_schedule', compId: match[1] ?? match[0],
    ...timing, schedule: !!timing, registration, ...(/候补|\bwait(?:ing)?[ -]?list\b/i.test(rest) ? { waitlist: true } : {}),
    ...(personalRegistration ? { personalRegistration } : {}) });
  return call.success ? call.data : undefined;
}

function localDateTime(timestamp: string, zone: string) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(timestamp));
}

function scheduleRows(call: ScheduleCall, schedule: ScheduleData, label: Label, names: Record<string, string>, useGroups: boolean) {
  const zones = new Map(schedule.venues.flatMap(venue => venue.rooms.map(room => [room.id, venue.timezone] as const)));
  const requested = call.rounds ?? (call.round ? [call.round] : []);
  const activities = useGroups ? schedule.groupActivities ?? [] : schedule.activities;
  const slots = activities.flatMap(activity => {
    if (typeof activity.activityCode !== 'string') return [];
    const parsed = parseActivityCode(activity.activityCode);
    if (!parsed.roundNumber || !WCA_EVENT_ORDER.some(event => event === parsed.eventId)
      || (call.event && parsed.eventId !== call.event) || parsed.attempt) return [];
    if (useGroups ? !isScheduleGroupCode(activity.activityCode) || (call.group && parsed.group?.toUpperCase() !== call.group.toUpperCase())
      : !!parsed.group) return [];
    const round = schedule.rounds[`${parsed.eventId}-r${parsed.roundNumber}`];
    const final = !!round && round.roundNumber === round.totalRounds;
    const matches = requested.filter(round => round === 'final' ? final : roundNumbers[round] === parsed.roundNumber);
    if (requested.length && !matches.length) return [];
    const start = instant(activity.startTime), end = instant(activity.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    return [{ activity, parsed, final, start, matches }];
  }).sort((a, b) => a.start - b.start);
  const shown = new Set(requested.flatMap(round => {
    const slot = slots.find(slot => slot.matches.includes(round));
    return slot ? [slot] : [];
  }));
  for (const slot of slots) {
    if (shown.size >= 12) break;
    shown.add(slot);
  }
  const rows = slots.filter(slot => shown.has(slot)).map(({ activity, parsed, final }) => {
    const round = label(`第 ${parsed.roundNumber} 轮`, `Round ${parsed.roundNumber}`);
    const venueZone = zones.get(activity.roomId);
    let zone = venueZone || 'UTC';
    try { localDateTime(activity.startTime, zone); } catch { zone = 'UTC'; }
    const zoneLabel = zone === venueZone ? zone : label('UTC（场馆时区未知）', 'UTC (venue time zone unavailable)');
    return [names[parsed.eventId], final ? label(`${round}（决赛）`, `${round} (final)`) : round,
      ...(useGroups ? [parsed.group!] : []),
      localDateTime(activity.startTime, zone), localDateTime(activity.endTime, zone), zoneLabel, activity.roomName || '—'];
  });
  return { rows, total: slots.length, missing: requested.filter(round => !slots.some(slot => slot.matches.includes(round))) };
}

function registrationStatus(record: Record<string, unknown>, now: number, label: Label) {
  if (record.cancelled_at) return { state: 'cancelled', text: label('官方资料显示赛事已取消。', 'The official competition record marks it cancelled.') };
  if (record.use_wca_registration === false && typeof record.external_registration_page === 'string' && record.external_registration_page.trim()) {
    return { state: 'external', text: label('赛事使用外部报名，请从 WCA 官方页进入并核对当前状态。', 'This competition uses external registration. Follow the official WCA page to check its status.') };
  }
  const open = instant(record.registration_open);
  const close = instant(record.registration_close);
  if (record.use_wca_registration !== true || !Number.isFinite(open) || !Number.isFinite(close) || open >= close) {
    return { state: 'unknown', text: label('公开资料未能确认报名时段，请核对官方报名页。', 'The public record does not confirm a registration window. Check the official registration page.') };
  }
  if (now < open) return { state: 'not_open', text: label('报名时段尚未开始。', 'The registration window has not opened yet.') };
  if (now >= close) return { state: 'closed', text: label('报名时段已结束。', 'The registration window has closed.') };
  if (record['registration_full?'] === true || record['registration_full_and_accepted?'] === true) {
    return { state: 'full', text: label('报名时段内，官方标记名额已满。', 'The window is open and WCA marks capacity as full.') };
  }
  return record['registration_full?'] === false
    ? { state: 'open', text: label('报名时段已开放，官方尚未标记额满。资格和受理状态以报名页为准。', 'The window is open and WCA has not marked it full. Check the registration page for eligibility and acceptance.') }
    : { state: 'capacity_unknown', text: label('报名时段已开放，公开资料未确认名额。请核对官方报名页。', 'The window is open and capacity is unconfirmed. Check the official registration page.') };
}

function organizerRegistrationStatus(source: OrganizerCompetition, now: number, label: Label) {
  const { competition: comp, capacity } = source;
  if (!comp) return { state: 'unavailable', text: label('暂时无法核实主办方报名时段和名额，请查看报名页。', 'The organizer’s registration window and capacity could not be verified. Check the registration page.') };
  if (/^cancel(?:l)?ed$/.test(comp.status)) return { state: 'cancelled', text: label('主办方已标记赛事取消。', 'The organizer marks the competition canceled.') };
  const open = instant(comp.registrationStartTime), close = instant(comp.registrationEndTime);
  const reopening = instant(comp.registrationReopenTime);
  const withdrawal = instant(comp.cancellationEndTime);
  const pausing = reopening > now && reopening < close && (comp.hasBeenFull === true || !(withdrawal > now));
  // The organizer may mark that registration reopened, even after the final deadline.
  const window = comp.tba || !Number.isFinite(open) || !Number.isFinite(close) || open >= close ? 'unknown'
    : now < open ? 'not_open'
    : now >= close ? 'closed'
    : pausing ? 'paused'
    : capacity?.remaining === 0 ? 'full' : capacity ? 'open' : 'capacity_unknown';
  const inReopenedWindow = reopening >= open && reopening < close && now >= reopening && now < close;
  const state = {
    unknown: label('主办方公开资料未能确认报名时段。', 'The organizer’s public data does not confirm a registration window.'),
    not_open: label('主办方报名时段尚未开始。', 'The organizer’s registration window has not opened yet.'),
    closed: label('主办方线上报名时段已结束。', 'The organizer’s online registration window has closed.'),
    paused: label('主办方线上报名暂时暂停，需等重新开放。', 'Online registration is paused until the organizer reopens it.'),
    full: label('报名时段内，主办方显示名额已满。', 'The window is active and the organizer shows capacity is full.'),
    open: inReopenedWindow ? label('主办方已重新开放报名。', 'The organizer has reopened registration.')
      : label('主办方报名时段已开放。', 'The organizer’s registration window is open.'),
    capacity_unknown: label('主办方报名时段已开放，暂时无法核实名额。', 'The organizer’s registration window is open. Capacity could not be verified.'),
  }[window];
  const seats = capacity ? label(`主办方公开名额为 ${capacity.acceptedCount}/${capacity.limit}，剩余 ${capacity.remaining}。`,
    `The organizer reports ${capacity.acceptedCount}/${capacity.limit} places filled, with ${capacity.remaining} remaining.`)
    : window !== 'capacity_unknown' ? label('暂时无法核实主办方名额。', 'The organizer’s capacity could not be verified.') : '';
  const onsite = window === 'closed' && comp.onTheSpotRegistration === true
    ? label('主办方另标有现场报名，请查看现场规则。', 'The organizer separately lists on-site registration. Check its conditions.') : '';
  return { state: window, text: [state, seats, onsite].filter(Boolean).join(' ') };
}

function waitlistStatus(record: Record<string, unknown> | undefined, now: number, label: Label) {
  const deadline = record?.use_wca_registration === true ? instant(record.waiting_list_deadline_date) : NaN;
  if (!Number.isFinite(deadline)) return { state: 'unknown', text: label('公开来源未确认能否加入候补，请核对报名页。', 'The public sources do not confirm whether you can join the waitlist. Check the registration page.') };
  if (now >= deadline) return { state: 'deadline_passed', text: label('WCA 公示的候补处理期限已过。', 'The WCA waitlist processing deadline has passed.') };
  const date = localDateTime(new Date(deadline).toISOString(), 'UTC');
  return { state: 'deadline_pending', text: label(`WCA 公示的候补处理截止时间为 ${date} UTC。能否新加入，以报名页为准。`,
    `WCA lists a waitlist processing deadline of ${date} UTC. Check the registration page for whether new entries are accepted.`) };
}

function publishedSchedule(schedule: unknown): schedule is ScheduleData {
  const data = schedule as ScheduleData | undefined;
  return !!data && Array.isArray(data.activities) && Array.isArray(data.venues) && !!data.rounds;
}

export function publicWcifSchedule(data: unknown, compId: string): ScheduleData | undefined {
  const raw = data as (RawWcif & { id?: string }) | undefined;
  if (raw?.id !== compId || !Array.isArray(raw.schedule?.venues)) return;
  return trimWcif(raw) ?? undefined;
}

export async function readCompetitionSchedule(call: ScheduleCall, lang: 'zh' | 'en', read: JsonReader, now = Date.now()): Promise<ToolResult> {
  const label: Label = (zh, en) => ({ zh, en })[lang];
  const eventNames = { zh: EVENT_DISPLAY_ZH, en: EVENT_DISPLAY_EN }[lang];
  const { compId, personalRegistration } = call;
  const wantsGroups = !!(call.groups || call.group);
  const scheduleHref = `/wca/comp/${compId}?view=schedule`;
  const officialHref = `https://www.worldcubeassociation.org/competitions/${compId}`;
  const registrationHref = `${officialHref}/register`;
  const competitionApi = `https://www.worldcubeassociation.org/api/v0/competitions/${compId}`;
  const wcifHref = `${competitionApi}/wcif/public`;
  const cachedRead = call.schedule ? read(`https://api.cuberoot.me/v1/wca/comp/${compId}/schedule`).then(value => value?.schedule).catch(() => undefined) : undefined;
  const readRecord = () => read(competitionApi)
    .then(record => record?.id === compId ? record as Record<string, unknown> : undefined).catch(() => undefined);
  const recordRead = call.registration || wantsGroups ? readRecord()
    : cachedRead?.then(cached => publishedSchedule(cached) ? undefined : readRecord());
  const organizerRead = recordRead?.then(record => record
    ? readOrganizerCompetition(record, compId, lang, read, call.registration, call.schedule) : undefined);
  const wcifRead = wantsGroups ? cachedRead?.then(async cached => {
    if (publishedSchedule(cached) && Array.isArray(cached.groupActivities)) return;
    try {
      const payload = await read(wcifHref);
      if (payload?.id === compId && publishedSchedule(payload.schedule) && Array.isArray(payload.schedule.groupActivities)) return payload.schedule;
      return publicWcifSchedule(payload, compId);
    } catch { /* Retain the available cached round blocks when WCIF is unavailable. */ }
  }) : undefined;
  const [cached, registration, organizer] = await Promise.all([cachedRead, recordRead, organizerRead]);
  const out: ToolResult = { evidence: null, sources: [], artifacts: [] };
  const lines: string[] = [];
  let scheduleState: string | undefined, registrationState: string | undefined;
  let waitlistState: string | undefined;
  let rows: string[][] = [];
  const title = typeof registration?.name === 'string' && registration.name.trim() ? registration.name.trim().slice(0, 160) : compId;
  const cancelled = !!registration?.cancelled_at || /^cancel(?:l)?ed$/.test(organizer?.competition?.status ?? '');
  if (call.schedule) {
    const hasGroups = wantsGroups && [organizer?.schedule, cached].some(data => {
      const slots = publishedSchedule(data) ? scheduleRows(call, data, label, eventNames, true) : undefined;
      return !!slots?.rows.length && !slots.missing.length;
    });
    const wcif = !cancelled && !hasGroups ? await wcifRead : undefined;
    const candidates = [
      { data: organizer?.schedule, href: organizer?.scheduleHref ?? scheduleHref, groupsHref: organizer?.scheduleHref ?? scheduleHref },
      { data: cached, href: scheduleHref, groupsHref: wcifHref },
      { data: wcif, href: wcifHref, groupsHref: wcifHref },
    ].flatMap(source => publishedSchedule(source.data) ? [{ ...source, data: source.data }] : []);
    const confirmed = (groups: boolean) => candidates
      .map(source => ({ source, slots: scheduleRows(call, source.data, label, eventNames, groups) }))
      .filter(({ slots }) => slots.rows.length)
      .sort((a, b) => a.slots.missing.length - b.slots.missing.length)[0];
    const groupResult = wantsGroups && !cancelled ? confirmed(true) : undefined;
    const result = groupResult ?? (cancelled ? undefined : confirmed(false));
    const { source, slots } = result ?? {};
    const published = candidates.length > 0;
    rows = slots?.rows ?? [];
    const scheduleId = `schedule:${compId}`;
    scheduleState = cancelled ? 'cancelled' : groupResult ? 'groups_published' : wantsGroups && published ? 'groups_unconfirmed'
      : rows.length ? 'published' : published ? 'no_matching_rounds' : cached === null ? 'not_available' : 'unavailable';
    const status = {
      cancelled: label('本场赛事已取消。', 'This competition has been cancelled.'),
      published: label(`查到 ${slots?.total} 个赛程时段，表中注明场馆时区。`, `Found ${slots?.total} scheduled slots. The table shows each venue time zone.`),
      groups_published: label(`核实到 ${slots?.total} 个公开分组时段。`, `Verified ${slots?.total} published group slots.`),
      groups_unconfirmed: label(`公开来源未能核实${call.group ? `第 ${call.group} 组的具体时段` : '分组的具体时段'}。${rows.length ? '表中为整个轮次的时间。' : ''}`,
        `The public sources could not verify ${call.group ? `a time for group ${call.group}` : 'individual group times'}.${rows.length ? 'The table shows round blocks.' : ''}`),
      no_matching_rounds: label('现有公开赛程未核实到所问的项目或轮次。', 'The published schedule does not list the requested event or round.'),
      not_available: label('现有公开来源未提供赛程。', 'The public source has no schedule available.'),
      unavailable: label('暂时读不到公开赛程。', 'The public schedule could not be retrieved right now.'),
    }[scheduleState];
    const scheduleSource = source ?? candidates[0];
    const scheduleVerified = !cancelled && (published || cached === null);
    out.sources.push({ id: scheduleId, title: groupResult ? label(`${compId} 公开分组赛程`, `${compId} published group schedule`)
      : label(`${compId} 赛程`, `${compId} schedule`), href: (groupResult ? scheduleSource?.groupsHref : scheduleSource?.href) ?? scheduleHref, read: scheduleVerified });
    lines.push(status + (scheduleVerified ? ` [[${scheduleId}]]` : ''));
    if (rows.length) out.artifacts.push({ kind: 'table', title: groupResult ? label(`${title} · 分组赛程`, `${title} · Group schedule`)
      : label(`${title} · 赛程`, `${title} · Schedule`),
      columns: [label('项目', 'Event'), label('轮次', 'Round'), ...(groupResult ? [label('组别', 'Group')] : []),
        label('开始', 'Starts'), label('结束', 'Ends'), label('场馆时区', 'Venue time zone'), label('场地', 'Room')],
      rows });
    if (slots && slots.total > rows.length) lines.push(label('表中仅显示部分时段，完整安排见赛程页。', 'The table shows a subset of the slots. Open the schedule for the full program.'));
    if (rows.length && slots?.missing.length) {
      const missing = slots.missing.map(round => round === 'final' ? label('决赛', 'final') : label(`第 ${roundNumbers[round]} 轮`, `round ${roundNumbers[round]}`));
      lines.push(label(`现有赛程未核实到${missing.join('、')}。`, `The published schedule does not confirm ${missing.join(', ')}.`));
    }
    if (!call.registration && registration && (!rows.length || cancelled)) {
      const metadataId = `competition:${compId}`;
      out.sources.push({ id: metadataId, title: label(`${compId} WCA 赛事资料`, `${compId} WCA competition`), href: officialHref, read: true });
      const start = z.iso.date().safeParse(registration.start_date), end = z.iso.date().safeParse(registration.end_date);
      const dates = start.success ? (end.success && end.data > start.data ? `${start.data} – ${end.data}` : start.data) : undefined;
      lines.push((dates && !cancelled ? label(`WCA 公示的比赛日期为 ${dates}。`, `WCA lists the competition date as ${dates}.`)
        : label('WCA 赛事资料可核对。', 'The WCA competition record is available.')) + ` [[${metadataId}]]`);
    }
  }
  if (call.registration) {
    const registrationId = `registration:${compId}`;
    const status = registration ? registrationStatus(registration, now, label) : {
      state: 'unavailable', text: label('暂时无法核实报名状态，请查看 WCA 官方报名页。', 'Registration status could not be verified. Check the official WCA registration page.'),
    };
    const organizerId = `organizer-registration:${compId}`;
    const organizerStatus = organizer ? organizerRegistrationStatus(organizer, now, label) : undefined;
    registrationState = organizerStatus?.state ?? status.state;
    out.sources.push({ id: registrationId, title: label(`${compId} 官方报名`, `${compId} WCA registration`), href: registrationHref, read: !!registration });
    if (organizer) out.sources.push({ id: organizerId, title: label(`${compId} 主办方报名`, `${compId} organizer registration`),
      href: organizer.registrationHref, read: !!organizer.competition });
    lines.push(organizerStatus
      ? label('WCA 指向主办方报名页。', 'WCA points to the organizer’s registration page.') + ` [[${registrationId}]] `
        + organizerStatus.text + (organizer?.competition ? ` [[${organizerId}]]` : '')
      : status.text + (registration ? ` [[${registrationId}]]` : ''));
    const waiting = !cancelled && (call.waitlist || registrationState === 'full') ? waitlistStatus(registration, now, label) : undefined;
    waitlistState = waiting?.state;
    if (waiting) lines.push(waiting.text + (waiting.state !== 'unknown' ? ` [[${registrationId}]]` : ''));
    if (personalRegistration) lines.push(label('本人是否已受理、是否在候补名单上，需要登录报名页查看个人状态。公开名额无法确认个人结果。',
      'Sign in to the registration page to check whether your entry was accepted or waitlisted. Public capacity does not establish your status.'));
  }
  const hasRead = out.sources.some(source => source.read);
  const incomplete = out.sources.some(source => !source.read) || scheduleState === 'groups_unconfirmed'
    || (call.registration && !!organizer?.competition && !organizer.capacity && registrationState !== 'cancelled');
  out.outcome = { state: !hasRead ? 'temporary_failure' : incomplete ? 'partial' : 'success' };
  out.evidence = { compId, name: title, scheduleState, registrationState, waitlistState, capacity: organizer?.capacity,
    personalRegistration: personalRegistration ? 'check_signed_in_registration_page' : undefined,
    event: call.event, round: call.round, rounds: call.rounds, group: call.group, rows,
    registrationCheckedAt: registration ? new Date(now).toISOString() : undefined,
    scope: 'Published schedules contain round blocks and verified group times where available. Personal assignments and acceptance require the registration account. An open window does not confirm a place.' };
  out.factualSummary = `${title} · ${lines.join(' ')}`;
  return out;
}
