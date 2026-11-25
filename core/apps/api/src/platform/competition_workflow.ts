import { timerEventIdFromSelector } from '@cuberoot/shared/timer/event-catalog';
import { generateNetBattleScramble } from '../utils/battle_scramble.js';
import { WCA_TIMED_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import { platformQuery, type PlatformDb } from './db.js';
import { badRequest, conflict, forbidden } from './errors.js';
import { arrayField, booleanField, enumField, integerField, isObject, isoTimestampField, stringField, type JsonObject } from './validation.js';

export const competitionId = (value: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) badRequest('Invalid resource id');
  return value;
};

export function requiredCompetitionTimestamp(body: JsonObject, key: string) {
  const value = isoTimestampField(body, key);
  if (!value) badRequest(`${key} is required`);
  return value;
}

export function readCompetitionProjects(body: JsonObject, minimumCapacity = 1) {
  const projects = arrayField(body, 'projects', { required: true, maxItems: 8 })!.map(raw => {
    if (!isObject(raw)) badRequest('Invalid project');
    const project = enumField(raw, 'project', WCA_TIMED_EVENT_ORDER, { required: true })!;
    const device = enumField(raw, 'device', ['ordinary', 'smart'], { required: true })!;
    if (device === 'smart' && project !== '333') badRequest('Smart cube support is currently limited to 3x3');
    return {
      project, device,
      amountMinor: integerField(raw, 'amountMinor', { required: true, min: 0, max: 10000000 })!,
      capacity: integerField(raw, 'capacity', { required: true, min: minimumCapacity, max: 1000000 })!,
    };
  });
  if (new Set(projects.map(p => `${p.project}:${p.device}`)).size !== projects.length) badRequest('Duplicate project and device');
  return projects;
}

type CompetitionWindow = { startsAt: string; endsAt: string; opens: string; closes: string };

export function readCompetitionDraft(body: JsonObject, dates: CompetitionWindow) {
  const format = enumField(body, 'format', ['average', 'advancement'], { required: true })!;
  const mode = enumField(body, 'supervisionMode', ['self_service', 'supervised', 'offline']) ?? 'supervised';
  const legacy = body.projects === undefined;
  const projects = readCompetitionProjects(legacy ? { projects: [{ ...body, amountMinor: body.feeMinor }] } : body, format === 'advancement' ? 2 : 1);
  if (!projects.length) badRequest('Add at least one project');
  if (Date.parse(dates.closes) > Date.parse(dates.startsAt)) badRequest('Registration must close before the competition starts');
  const totalCapacity = projects.reduce((total, project) => total + project.capacity, 0);
  if (mode !== 'supervised' && totalCapacity > 1000000) badRequest('Combined project capacity cannot exceed 1000000');
  const venue = body.offlineVenue;
  if (mode === 'offline' && !isObject(venue)) badRequest('Offline competitions require a venue');
  const offlineVenue = mode === 'offline' && isObject(venue) ? {
    city: stringField(venue, 'city', { required: true, max: 160 })!,
    address: stringField(venue, 'address', { required: true, max: 500 })!,
    contact: stringField(venue, 'contact', { max: 500 }) ?? '',
    checkinGuide: stringField(venue, 'checkinGuide', { max: 2000 }) ?? '',
  } : null;
  const sessions = mode !== 'supervised' ? [] : arrayField(body, 'sessions', { maxItems: 100 })?.map(raw => {
    if (!isObject(raw)) badRequest('Invalid session');
    const startsAt = requiredCompetitionTimestamp(raw, 'startsAt');
    const endsAt = requiredCompetitionTimestamp(raw, 'endsAt');
    if (Date.parse(startsAt) < Date.parse(dates.startsAt) || Date.parse(endsAt) > Date.parse(dates.endsAt) || Date.parse(startsAt) >= Date.parse(endsAt)) {
      badRequest('Sessions must be inside the competition window');
    }
    return {
      startsAt, endsAt, capacity: integerField(raw, 'capacity', { required: true, min: 1, max: 1000 })!,
      supervisor: integerField(raw, 'supervisorUserId', { min: 1 }) ?? null,
      assistance: booleanField(raw, 'assistanceRequested') ?? false,
    };
  }) ?? (legacy ? null : []);
  return {
    format, mode, projects, sessions, totalCapacity, offlineVenue, legacy,
    refund: stringField(body, 'refundPolicy', { max: 10000 }) ?? '',
    recording: stringField(body, 'recordingPolicy', { max: 10000 }) ?? '',
    refundTemplate: enumField(body, 'refundTemplate', ['before_24h', 'before_start', 'custom']) ?? 'custom',
  };
}

export async function saveCompetitionProjects(db: PlatformDb, eventId: string, dates: CompetitionWindow, projects: ReturnType<typeof readCompetitionProjects>) {
  await platformQuery(db, `UPDATE platform_event_ticket_types SET status='archived'
    WHERE event_id=$1::uuid AND competition_project IS NOT NULL`, [eventId]);
  for (const p of projects) {
    await platformQuery(db, `INSERT INTO platform_event_ticket_types
      (event_id,code,title_zh,title_en,amount_minor,currency,capacity,sales_start_at,sales_end_at,competition_project,competition_device)
      VALUES($1::uuid,$2,$3,$3,$4,'CNY',$5,$6,$7,$8,$9)
      ON CONFLICT(event_id,code) DO UPDATE SET status='active',amount_minor=EXCLUDED.amount_minor,capacity=EXCLUDED.capacity,
        sales_start_at=EXCLUDED.sales_start_at,sales_end_at=EXCLUDED.sales_end_at,
        competition_project=EXCLUDED.competition_project,competition_device=EXCLUDED.competition_device`,
    [eventId, `${p.project}-${p.device}`, `${p.project} ${p.device}`, p.amountMinor, p.capacity, dates.opens, dates.closes, p.project, p.device]);
  }
}

export async function lockCompetitionSupervisors(db: PlatformDb, ids: number[]) {
  if (ids.length) await platformQuery(db, 'SELECT id FROM app_users WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE', [ids]);
}

export async function validateCompetitionSupervisor(db: PlatformDb, supervisor: number, organizationId: string, allowPlatform: boolean, starts: string, ends: string, sessionId: string | null) {
  const [eligible] = await platformQuery(db, `SELECT u.id FROM app_users u WHERE u.id=$1 AND ($3 OR EXISTS(
    SELECT 1 FROM organization_members m WHERE m.user_id=u.id AND m.organization_id=$2::uuid
      AND m.status='active' AND m.role IN ('owner','admin','teacher','assistant')))`, [supervisor, organizationId, allowPlatform]);
  if (!eligible) forbidden('Assign an active member of your organization; CubeRoot administrators can assign assistance');
  const [overlap] = await platformQuery(db, `SELECT s.id FROM platform_competition_sessions s JOIN platform_events e ON e.id=s.event_id
    WHERE s.supervisor_user_id=$1 AND s.starts_at<$3 AND s.ends_at>$2 AND e.status IN ('draft','published')
      AND ($4::uuid IS NULL OR s.id<>$4::uuid) LIMIT 1`, [supervisor, starts, ends, sessionId]);
  if (overlap) conflict('Supervisor already has an overlapping session');
}

export async function saveCompetitionDraft(db: PlatformDb, eventId: string, organizationId: string, admin: boolean, dates: CompetitionWindow, draft: ReturnType<typeof readCompetitionDraft>) {
  const previous = draft.legacy ? draft.projects[0] : undefined;
  await platformQuery(db, `UPDATE platform_competitions SET registration_opens_at=$2,registration_closes_at=$3,
    competition_format=$4,supervision_mode=$5,refund_policy=$6,recording_policy=$7,refund_template=$8,offline_venue=$9::jsonb,
    review_status='draft',submitted_at=NULL,competition_project=$10,competition_device=$11,participant_limit=$12,registration_fee_minor=$13
    WHERE event_id=$1::uuid`,
  [eventId, dates.opens, dates.closes, draft.format, draft.mode, draft.refund, draft.recording, draft.refundTemplate, draft.offlineVenue,
    previous?.project ?? null, previous?.device ?? null, previous?.capacity ?? null, previous?.amountMinor ?? null]);
  await saveCompetitionProjects(db, eventId, dates, draft.projects);
  if (draft.sessions === null) return;
  if (draft.mode !== 'supervised') {
    await platformQuery(db, `DELETE FROM platform_competition_sessions WHERE event_id=$1::uuid AND session_kind='supervised'`, [eventId]);
    await platformQuery(db, `INSERT INTO platform_competition_sessions(event_id,starts_at,ends_at,capacity,session_kind)
      VALUES($1::uuid,$2,$3,$4,$5) ON CONFLICT(event_id) WHERE session_kind<>'supervised'
      DO UPDATE SET starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,capacity=EXCLUDED.capacity,session_kind=EXCLUDED.session_kind`,
    [eventId, dates.startsAt, dates.endsAt, draft.totalCapacity, draft.mode]);
    return;
  }
  await lockCompetitionSupervisors(db, draft.sessions.flatMap(session => session.supervisor ? [session.supervisor] : []));
  await platformQuery(db, 'DELETE FROM platform_competition_sessions WHERE event_id=$1::uuid', [eventId]);
  for (const session of draft.sessions) {
    if (session.supervisor) await validateCompetitionSupervisor(db, session.supervisor, organizationId, admin, session.startsAt, session.endsAt, null);
    await platformQuery(db, `INSERT INTO platform_competition_sessions(event_id,starts_at,ends_at,capacity,supervisor_user_id,assistance_requested)
      VALUES($1::uuid,$2,$3,$4,$5,$6)`, [eventId, session.startsAt, session.endsAt, session.capacity, session.supervisor, session.assistance]);
  }
}

export function competitionScramble(project: string) {
  const event = timerEventIdFromSelector(project);
  if (!event) badRequest('Unsupported competition event');
  return generateNetBattleScramble(event);
}
