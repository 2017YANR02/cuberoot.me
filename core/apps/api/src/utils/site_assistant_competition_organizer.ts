import { isScheduleGroupCode, type ScheduleData, type ScheduleVenue } from '@cuberoot/shared/comp-schedule';
import { z } from 'zod';
import type { JsonReader } from './site_assistant_tools.js';

const id = z.number().int().positive();
const time = z.iso.datetime({ offset: true });
const count = z.number().int().nonnegative();
const organizerCompetition = z.object({
  id,
  alias: z.string(),
  wcaCompetitionId: z.string(),
  registrationStartTime: time.nullish(),
  registrationEndTime: time.nullish(),
  registrationReopenTime: time.nullish(),
  cancellationEndTime: time.nullish(),
  hasBeenFull: z.boolean().optional(),
  tba: z.boolean().optional(),
  onTheSpotRegistration: z.boolean().optional(),
  status: z.string(),
  locations: z.array(z.object({ id, regionIso2: z.string() })).optional(),
  events: z.array(z.object({ eventId: z.string(), roundCount: id })).optional(),
});
const availability = z.object({
  limitType: z.literal('per-competitor'),
  overall: z.object({ limit: id, acceptedCount: count, remaining: count })
    .refine(value => value.remaining === Math.max(0, value.limit - value.acceptedCount)),
});
const slotSchema = z.object({
  id, competitionId: id, scheduleType: z.literal('event'),
  eventId: z.string().regex(/^[a-z0-9]+$/), round: z.object({ eventId: z.string(), roundNumber: id }),
  startTime: time, endTime: time,
  group: z.union([id, z.string().regex(/^[A-Za-z0-9]{1,16}$/)]).nullish(),
  attempt: id.nullish(), venueId: id,
  venue: z.object({ id, competitionLocationId: id, name: z.string(), nameZh: z.string().nullish() }),
});

type Competition = z.infer<typeof organizerCompetition>;

function scheduleData(comp: Competition, raw: unknown, lang: 'zh' | 'en'): ScheduleData | undefined {
  if (!Array.isArray(raw)) return;
  const rooms = new Map<number, ScheduleVenue>();
  const activities: ScheduleData['activities'] = [];
  const groupActivities: ScheduleData['activities'] = [];
  const rounds: ScheduleData['rounds'] = {};
  for (const item of raw) {
    const slot = slotSchema.safeParse(item);
    if (!slot.success) continue;
    const a = slot.data;
    if (a.competitionId !== comp.id || a.eventId !== a.round.eventId || a.venueId !== a.venue.id || a.attempt || Date.parse(a.endTime) <= Date.parse(a.startTime)) continue;
    const { eventId, roundNumber } = a.round;
    const roundId = `${eventId}-r${roundNumber}`;
    const activityCode = a.group ? `${roundId}-g${a.group}` : roundId;
    if (a.group && !isScheduleGroupCode(activityCode)) continue;
    const totalRounds = comp.events?.find(event => event.eventId === eventId)?.roundCount;
    if (totalRounds && roundNumber <= totalRounds) {
      rounds[roundId] = { id: roundId, eventId, roundNumber, totalRounds, format: '', timeLimit: null, cutoff: null, advancementCondition: null };
    }
    const location = comp.locations?.find(location => location.id === a.venue.competitionLocationId);
    const roomName = ((lang === 'zh' && a.venue.nameZh) || a.venue.name).slice(0, 120);
    const room = { id: a.venueId, name: roomName, color: '' };
    rooms.set(room.id, { ...room, countryIso2: location?.regionIso2 ?? '', timezone: location?.regionIso2 === 'CN' ? 'Asia/Shanghai' : '', rooms: [room] });
    const target = a.group ? groupActivities : activities;
    target.push({ id: a.id, name: '', activityCode, startTime: a.startTime, endTime: a.endTime, roomId: room.id, roomName, roomColor: '' });
  }
  return { startDate: '', numberOfDays: 0, venues: [...rooms.values()], activities, groupActivities, rounds };
}

export async function readOrganizerCompetition(
  record: Record<string, unknown>, compId: string, lang: 'zh' | 'en', read: JsonReader,
  wantRegistration: boolean, wantSchedule: boolean,
) {
  if (record.use_wca_registration !== false || record.cancelled_at || typeof record.external_registration_page !== 'string') return;
  const url = URL.parse(record.external_registration_page);
  if (url?.origin !== 'https://cubing.com' || url.username || url.password) return;
  const slug = /^\/competition\/([A-Za-z0-9-]{1,100})\/registration\/?$/.exec(url.pathname)?.[1];
  if (!slug) return;

  const page = `https://cubing.com/competition/${slug}`;
  const api = `https://api.cubing.com/competitions/${slug}`;
  const [meta, capacity, schedule] = await Promise.allSettled([
    read(api),
    wantRegistration ? read(`${api}/registration/availability`) : undefined,
    wantSchedule ? read(`${api}/schedule`) : undefined,
  ]);
  const parsed = organizerCompetition.safeParse(meta.status === 'fulfilled' ? meta.value : undefined);
  const comp = parsed.success && parsed.data.alias === slug && parsed.data.wcaCompetitionId === compId ? parsed.data : undefined;
  const seats = availability.safeParse(capacity.status === 'fulfilled' ? capacity.value : undefined);
  return {
    registrationHref: `${page}/registration`,
    scheduleHref: `${page}/schedule`,
    competition: comp,
    capacity: comp && seats.success ? seats.data.overall : undefined,
    schedule: comp && schedule.status === 'fulfilled' ? scheduleData(comp, schedule.value, lang) : undefined,
  };
}

export type OrganizerCompetition = NonNullable<Awaited<ReturnType<typeof readOrganizerCompetition>>>;
