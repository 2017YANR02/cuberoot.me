import { randomUUID } from 'node:crypto';
import { WCA_TIMED_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import { placePlatformOrder } from '../platform/commerce/order-create.js';
import { retireCompetitionVideoGeneration } from './video_rooms.js';
import { ownerKey } from '../utils/account.js';
import type { Context } from 'hono';
import { requirePlatformActor, requirePlatformAdmin, type PlatformActor } from '../platform/auth.js';
import { platformDb, platformQuery, sendMutation, withIdempotency, type PlatformDb } from '../platform/db.js';
import { badRequest, conflict, forbidden, notFound } from '../platform/errors.js';
import { platformRouter, privateNoStore } from '../platform/http.js';
import { arrayField, booleanField, enumField, integerField, isObject, readJsonObject, stringField, type JsonObject } from '../platform/validation.js';
import { competitionInteger, competitionResultSummary, requireCompetitionManager, requireCompetitionRegistration, validateCompetitionAttempts } from '../platform/competitions.js';
import { paymentAvailability } from '../platform/payment.js';
import { competitionId as uuid, requiredCompetitionTimestamp as requiredTimestamp, readCompetitionDraft,
  readCompetitionProjects, saveCompetitionDraft, saveCompetitionProjects, lockCompetitionSupervisors, validateCompetitionSupervisor } from '../platform/competition_workflow.js';
import { closeEndedCompetitionBrackets, generateCompetitionBrackets } from '../platform/competition_brackets.js';
import { validateCompetitionDeviceCheckIn } from '../platform/competition_device_reports.js';
import { competitionHostOverview } from '../platform/competition_settlement.js';

export const platformCompetitionRoutes = platformRouter();
const id = (c: Context) => uuid(c.req.param('id') ?? '');
const DRAFT_SETUP = `CASE WHEN c.competition_device IS NOT NULL THEN jsonb_build_object(
  'format', c.competition_format, 'device', c.competition_device, 'capacity', c.participant_limit,
  'project', c.competition_project, 'feeMinor', c.registration_fee_minor) END AS setup`;
const LIST = `SELECT e.id::text,e.slug,e.title_zh AS "titleZh",e.title_en AS "titleEn",e.status,
  e.starts_at AS "startsAt",e.ends_at AS "endsAt",o.name AS "organizationName",o.id::text AS "organizationId",
  c.submitted_at AS "submittedAt",c.registration_opens_at AS "registrationOpensAt",c.registration_closes_at AS "registrationClosesAt",
  COALESCE(c.competition_format,'average') AS format,c.supervision_mode AS "supervisionMode",
  c.review_status AS "reviewStatus",c.finalized_at AS "finalizedAt",c.is_test AS "isTest",
  ${DRAFT_SETUP},
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id::text,'project',t.competition_project,'device',t.competition_device,
    'amountMinor',t.amount_minor,'currency',t.currency,'capacity',t.capacity) ORDER BY t.competition_project,t.competition_device)
    FROM platform_event_ticket_types t WHERE t.event_id=e.id AND t.competition_project IS NOT NULL AND t.status='active'),'[]'::jsonb) AS projects
  FROM platform_competitions c JOIN platform_events e ON e.id=c.event_id
  JOIN organizations o ON o.id=c.organization_id`;

async function optionalActor(c: Context): Promise<PlatformActor | null> {
  return c.req.header('Authorization') ? requirePlatformActor(c) : null;
}

platformCompetitionRoutes.get('/platform/competitions', async (c) => {
  privateNoStore(c);
  const competitions = await platformQuery(platformDb(), `${LIST} WHERE NOT c.is_test AND e.status IN ('published','completed') AND o.status='active' ORDER BY e.starts_at DESC LIMIT 100`);
  return c.json({ competitions });
});
platformCompetitionRoutes.get('/platform/competitions/manage', async (c) => {
  const actor = await requirePlatformActor(c);
  privateNoStore(c);
  const competitions = await platformQuery(platformDb(), `${LIST} WHERE NOT (c.is_test AND e.status='cancelled') AND ($2 OR (NOT c.is_test AND EXISTS (SELECT 1 FROM organization_members m
    WHERE m.organization_id=o.id AND m.user_id=$1 AND m.status='active' AND m.role IN ('owner','admin')))) ORDER BY e.created_at DESC LIMIT 100`, [actor.userId,actor.isAdmin]);
  return c.json({ competitions });
});
platformCompetitionRoutes.get('/platform/competitions/host/overview', async (c) => {
  const actor = await requirePlatformActor(c);
  privateNoStore(c);
  return c.json(await competitionHostOverview(platformDb(), actor));
});
platformCompetitionRoutes.get('/platform/competitions/me/supervised', async (c) => {
  const actor = await requirePlatformActor(c);
  privateNoStore(c);
  const competitions = await platformQuery(platformDb(), `${LIST}
    WHERE e.status IN ('published','completed') AND o.status='active'
      AND EXISTS (SELECT 1 FROM platform_competition_sessions s
        WHERE s.event_id=e.id AND s.supervisor_user_id=$1)
    ORDER BY e.starts_at DESC LIMIT 100`, [actor.userId]);
  return c.json({ competitions });
});
platformCompetitionRoutes.get('/platform/competitions/me/entries', async (c) => {
  const actor = await requirePlatformActor(c);
  privateNoStore(c);
  const entries = await platformQuery(platformDb(), `
    WITH own_entries AS (
      SELECT r.id::text AS "registrationId", e.id::text AS "competitionId",
        e.title_zh AS "titleZh", e.title_en AS "titleEn", r.status, t.competition_device AS device,cc.is_test AS "isTest",
        i.order_id::text AS "orderId", s.starts_at AS "sessionStartsAt",
        CASE WHEN r.status='reserved' AND o.status='pending_payment' THEN r.reservation_expires_at END AS "reservationExpiresAt",
        CASE
          WHEN r.status = 'reserved' AND r.reservation_expires_at > NOW() AND o.status = 'pending_payment' THEN 'pay'
          WHEN r.status IN ('confirmed', 'attended') AND r.result_recorded_at IS NOT NULL THEN 'results'
          WHEN e.status='published' AND r.status='confirmed' AND cc.competition_format='advancement'
            AND e.starts_at<=NOW() AND NOW()<e.ends_at THEN 'enter_bracket'
          WHEN e.status = 'published' AND r.status = 'confirmed' AND s.session_kind<>'offline'
            AND COALESCE(cc.competition_format,'average')='average'
            AND s.starts_at <= NOW() AND NOW() < s.ends_at
            THEN CASE WHEN r.checked_in_at IS NULL THEN 'check_in' ELSE 'enter' END
          WHEN e.status = 'published' AND r.status = 'confirmed' AND s.starts_at > NOW() THEN 'upcoming'
          ELSE 'details'
        END AS action
      FROM platform_event_registrations r
      JOIN platform_event_ticket_types t ON t.id = r.ticket_type_id
      JOIN platform_competition_sessions s ON s.id = r.competition_session_id
      JOIN platform_competitions cc ON cc.event_id = r.event_id
      JOIN platform_events e ON e.id = cc.event_id
      JOIN organizations org ON org.id = cc.organization_id
      JOIN platform_order_items i ON i.id = r.order_item_id
      JOIN platform_orders o ON o.id = i.order_id
      WHERE r.user_id = $1 AND e.status IN ('published', 'completed') AND org.status = 'active'
        AND (r.status IN ('confirmed', 'attended', 'refunded')
          OR (r.status = 'reserved' AND r.reservation_expires_at > NOW()))
    )
    SELECT * FROM own_entries
    ORDER BY CASE action
      WHEN 'enter' THEN 0 WHEN 'enter_bracket' THEN 0 WHEN 'check_in' THEN 0 WHEN 'pay' THEN 1
      WHEN 'upcoming' THEN 2 ELSE 3 END,
      CASE WHEN action IN ('enter', 'enter_bracket', 'check_in', 'pay', 'upcoming') THEN "sessionStartsAt" END,
      "sessionStartsAt" DESC, "registrationId"
    LIMIT 20
  `, [actor.userId]);
  return c.json({ entries });
});
platformCompetitionRoutes.get('/platform/competitions/review-queue', async c => {
  await requirePlatformAdmin(c);
  privateNoStore(c);
  const competitions = await platformQuery(platformDb(), `WITH pending AS (
      ${LIST} WHERE c.review_status='pending_approval' AND e.status='draft' ORDER BY c.submitted_at,e.id LIMIT 100
    )
    SELECT p.*,o.slug AS "organizationSlug",c.commission_bps AS "commissionBps",c.settlement_days AS "settlementDays",
      c.settlement_anchor AS "settlementAnchor",c.refund_policy AS "refundPolicy",c.recording_policy AS "recordingPolicy",
      c.refund_template AS "refundTemplate",c.offline_venue AS "offlineVenue",c.review_note AS "reviewNote",
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'kind',s.session_kind,'startsAt',s.starts_at,'endsAt',s.ends_at,
        'capacity',s.capacity,'available',s.capacity,'supervisorUserId',s.supervisor_user_id,'staffed',s.supervisor_user_id IS NOT NULL,
        'assistanceRequested',s.assistance_requested) ORDER BY s.starts_at,s.id)
        FROM platform_competition_sessions s WHERE s.event_id=c.event_id),'[]'::jsonb) AS sessions
    FROM pending p JOIN platform_competitions c ON c.event_id=p.id::uuid JOIN organizations o ON o.id=c.organization_id
    ORDER BY c.submitted_at,c.event_id`);
  const supervisors = await platformQuery(platformDb(), `SELECT id,display_name AS name FROM app_users
    WHERE is_admin AND merged_into_user_id IS NULL ORDER BY display_name,id`);
  return c.json({ competitions, supervisors: supervisors.map(user => ({ ...user, id: competitionInteger(user.id) })) });
});

async function testOrganizer(db: PlatformDb, organizationId?: string) {
  const [organization] = await platformQuery<{ id: string }>(db, `
    SELECT id::text FROM organizations
    WHERE status='active' AND competition_organizer_approved_at IS NOT NULL AND ($1::uuid IS NULL OR id=$1::uuid)
    ORDER BY created_at,id LIMIT 1 FOR SHARE`, [organizationId ?? null]);
  if (!organization) conflict('No approved competition organizer is available');
  return organization.id;
}

const TEST_SUPERVISORS = `
  FROM app_users u WHERE u.merged_into_user_id IS NULL AND (
    u.is_admin OR u.id=$2 OR EXISTS (
      SELECT 1 FROM organization_members m WHERE m.organization_id=$1::uuid AND m.user_id=u.id
        AND m.status='active' AND m.role IN ('owner','admin','teacher','assistant')
    )
  )`;

platformCompetitionRoutes.get('/platform/competitions/test/options', async c => {
  const actor = await requirePlatformAdmin(c);
  const requested = c.req.query('organizationId');
  const organizationId = await testOrganizer(platformDb(), requested ? uuid(requested) : undefined);
  const supervisors = await platformQuery<{ id: number | string; name: string }>(platformDb(), `
    SELECT u.id,u.display_name AS name ${TEST_SUPERVISORS} ORDER BY u.display_name,u.id`, [organizationId, actor.userId]);
  privateNoStore(c);
  return c.json({ organizationId, supervisors: supervisors.map(user => ({ ...user, id: competitionInteger(user.id) })) });
});

platformCompetitionRoutes.post('/platform/competitions/test', async c => {
  const actor = await requirePlatformAdmin(c);
  const body = await readJsonObject(c);
  const format = enumField(body, 'format', ['average', 'advancement']) ?? 'average';
  const mode = enumField(body, 'supervisionMode', ['self_service', 'supervised']) ?? 'self_service';
  const device = enumField(body, 'device', ['smart', 'ordinary']) ?? 'smart';
  const project = enumField(body, 'project', WCA_TIMED_EVENT_ORDER) ?? '333';
  if (device === 'smart' && project !== '333') badRequest('Smart cube competitions require 3x3');
  const autoEnter = booleanField(body, 'autoEnter') ?? false;
  if (autoEnter && (format !== 'average' || mode !== 'self_service')) badRequest('Direct entry requires a self-service Ao5');
  if (autoEnter && actor.userId === null) forbidden('Direct entry requires a site administrator account');
  const supervisor = integerField(body, 'supervisorUserId', { min: 1 }) ?? actor.userId;
  const requested = stringField(body, 'organizationId', { max: 36 });
  return sendMutation(c, await withIdempotency(c, actor, 'competition.test.create', body, async db => {
    const organizationId = await testOrganizer(db, requested ? uuid(requested) : undefined);
    if (mode === 'supervised') {
      if (supervisor === null) badRequest('Choose a supervisor for video supervision');
      const [eligible] = await platformQuery(db, `SELECT u.id ${TEST_SUPERVISORS} AND u.id=$3`, [organizationId, actor.userId, supervisor]);
      if (!eligible) badRequest('Choose an active organization supervisor or site administrator');
    }
    const [clock] = await platformQuery<{ now: Date; label: string }>(db,
      "SELECT NOW() AS now,to_char(NOW() AT TIME ZONE 'Asia/Shanghai','HH24:MI') AS label");
    const timestamp = +clock.now;
    const scheduled = timestamp + 15 * 60_000;
    const dates = {
      opens: new Date(timestamp - (autoEnter ? 120_000 : 60_000)).toISOString(),
      closes: new Date(scheduled).toISOString(),
      startsAt: new Date(autoEnter ? timestamp : scheduled).toISOString(),
      endsAt: new Date((autoEnter ? timestamp : scheduled) + 120 * 60_000).toISOString(),
    };
    const eventId = randomUUID();
    const slug = `test-${eventId}`;
    const formatLabel = format === 'average' ? 'Ao5' : '1v1';
    const zh = `测试赛 · ${device === 'smart' ? '智能' : '普通'} ${project} ${formatLabel} · ${clock.label}`;
    const en = `Test · ${device === 'smart' ? 'Smart' : 'Standard'} ${project} ${formatLabel} · ${clock.label}`;
    const capacity = autoEnter ? 1 : 16;
    await platformQuery(db, `INSERT INTO platform_events (id,slug,title_zh,title_en,status,starts_at,ends_at,timezone,created_by_user_id,published_at)
      VALUES($1::uuid,$2,$3,$4,'published',$5,$6,'Asia/Shanghai',$7,NOW())`,
    [eventId, slug, zh, en, dates.startsAt, dates.endsAt, actor.userId]);
    await platformQuery(db, `INSERT INTO platform_competitions
      (event_id,organization_id,is_test,review_status,reviewed_by,reviewed_at,registration_opens_at,registration_closes_at,
        competition_format,supervision_mode,competition_device,competition_project,registration_fee_minor,participant_limit,
        refund_template,refund_policy,recording_policy)
      VALUES($1::uuid,$2::uuid,TRUE,'approved',$3,NOW(),$4,$5,$6,$7,$8,$9,0,$10,'custom',$11,$12)`,
    [eventId, organizationId, actor.userId, dates.opens, dates.closes, format, mode, device, project, capacity,
      '测试报名免费。 / Test entry is free.', '录像仅用于本场测试。 / Recordings are used for this test only.']);
    const [session] = await platformQuery<{ id: string }>(db, `INSERT INTO platform_competition_sessions
      (event_id,starts_at,ends_at,capacity,session_kind,supervisor_user_id) VALUES($1::uuid,$2,$3,$4,$5,$6) RETURNING id::text`,
    [eventId, dates.startsAt, dates.endsAt, capacity, mode, mode === 'supervised' ? supervisor : null]);
    await saveCompetitionProjects(db, eventId, dates, [{ project, device, capacity, amountMinor: 0 }]);

    let registrationId: string | null = null;
    if (autoEnter) {
      const [ticket] = await platformQuery<{ id: string }>(db, 'SELECT id::text FROM platform_event_ticket_types WHERE event_id=$1::uuid', [eventId]);
      const order = await placePlatformOrder(db, actor, [{
        sellableType: 'event_ticket', eventTicketTypeId: ticket.id, competitionSessionId: session.id, device,
      }], slug);
      const [registration] = await platformQuery<{ id: string }>(db, `UPDATE platform_event_registrations r
        SET checked_in_at=CASE WHEN $3 THEN NOW() ELSE NULL END
        FROM platform_order_items i
        WHERE r.event_id=$1::uuid AND r.order_item_id=i.id AND i.order_id=$2::uuid AND r.status='confirmed'
        RETURNING r.id::text`, [eventId, order.resourceId, device === 'ordinary']);
      if (!registration) throw new Error('Test competition order did not fulfill its registration');
      registrationId = registration.id;
      await platformQuery(db, 'UPDATE platform_competitions SET registration_closes_at=NOW() WHERE event_id=$1::uuid', [eventId]);
      await platformQuery(db, 'UPDATE platform_event_ticket_types SET sales_end_at=NOW() WHERE event_id=$1::uuid', [eventId]);
    }

    return { status: 201, body: { id: eventId, slug, registrationId }, resourceType: 'competition', resourceId: eventId };
  }));
});

async function lockTestCompetition(db: PlatformDb, eventId: string) {
  const [competition] = await platformQuery<{ is_test: boolean; status: string; competition_format: string; brackets_generated_at: Date | null }>(db, `
    SELECT c.is_test,e.status,c.competition_format,c.brackets_generated_at FROM platform_competitions c
    JOIN platform_events e ON e.id=c.event_id WHERE c.event_id=$1::uuid FOR UPDATE OF c,e`, [eventId]);
  if (!competition) notFound('Competition');
  if (!competition.is_test) conflict('This action is only available for test competitions');
  return competition;
}

platformCompetitionRoutes.post('/platform/competitions/:id/test/start-now', async c => {
  const actor = await requirePlatformAdmin(c);
  const eventId = id(c);
  const body = await readJsonObject(c);
  return sendMutation(c, await withIdempotency(c, actor, `competition.test.start:${eventId}`, body, async db => {
    // Checkout locks tickets before the competition, so use that order here as well.
    await platformQuery(db, `SELECT t.id FROM platform_event_ticket_types t
      JOIN platform_competitions c ON c.event_id=t.event_id AND c.is_test
      WHERE t.event_id=$1::uuid ORDER BY t.id FOR UPDATE OF t`, [eventId]);
    const competition = await lockTestCompetition(db, eventId);
    if (competition.status !== 'published') conflict('Only a published test competition can be started');
    let bracketsGenerated = !!competition.brackets_generated_at;
    if (competition.competition_format === 'advancement' && !bracketsGenerated) {
      const [entries] = await platformQuery<{ confirmed: number; held: boolean }>(db, `
        SELECT COUNT(*) FILTER(WHERE status='confirmed')::int AS confirmed,
          COALESCE(BOOL_OR(status='reserved' AND reservation_expires_at>NOW()),FALSE) AS held
        FROM platform_event_registrations WHERE event_id=$1::uuid`, [eventId]);
      if (entries.held) conflict('Wait for held registrations to be resolved before starting');
      if (entries.confirmed < 2) conflict('At least two confirmed competitors are required to start a duel');
      bracketsGenerated = await generateCompetitionBrackets(db, eventId);
    }
    await platformQuery(db, 'UPDATE platform_competitions SET registration_closes_at=LEAST(registration_closes_at,NOW()) WHERE event_id=$1::uuid', [eventId]);
    await platformQuery(db, `UPDATE platform_event_ticket_types SET sales_end_at=LEAST(COALESCE(sales_end_at,NOW()),NOW())
      WHERE event_id=$1::uuid`, [eventId]);
    await platformQuery(db, `UPDATE platform_events SET starts_at=LEAST(starts_at,NOW()),ends_at=GREATEST(ends_at,NOW()+INTERVAL '2 hours') WHERE id=$1::uuid`, [eventId]);
    await platformQuery(db, `UPDATE platform_competition_sessions SET starts_at=LEAST(starts_at,NOW()),ends_at=GREATEST(ends_at,NOW()+INTERVAL '2 hours') WHERE event_id=$1::uuid`, [eventId]);
    return { status: 200, body: { id: eventId, started: true, ...(competition.competition_format === 'advancement' ? { bracketsGenerated } : {}) } };
  }));
});

type RetiredRoom = { id: string; generation: string };

platformCompetitionRoutes.post('/platform/competitions/:id/test/cleanup', async c => {
  const actor = await requirePlatformAdmin(c);
  const eventId = id(c);
  const body = await readJsonObject(c);
  const result = await withIdempotency(c, actor, `competition.test.cleanup:${eventId}`, body, async db => {
    const competition = await lockTestCompetition(db, eventId);
    const [nonzero] = await platformQuery(db, `SELECT o.id FROM platform_order_items i JOIN platform_orders o ON o.id=i.order_id
      JOIN platform_event_ticket_types t ON t.id=i.event_ticket_type_id
      WHERE t.event_id=$1::uuid AND (o.total_amount_minor>0 OR i.line_total_amount_minor>0) LIMIT 1`, [eventId]);
    if (nonzero) conflict('A test competition with a non-zero order cannot be cleaned up');
    let rooms: RetiredRoom[] = [];
    if (competition.status !== 'cancelled') {
      await platformQuery(db, 'UPDATE platform_competitions SET registration_closes_at=LEAST(registration_closes_at,NOW()) WHERE event_id=$1::uuid', [eventId]);
      await platformQuery(db, "UPDATE platform_events SET status='cancelled' WHERE id=$1::uuid", [eventId]);
      rooms = await platformQuery<RetiredRoom>(db, `WITH prior AS MATERIALIZED (
        SELECT id,competition_video_generation AS generation FROM platform_event_registrations WHERE event_id=$1::uuid FOR UPDATE
      )
      UPDATE platform_event_registrations r SET
        status=CASE WHEN r.status IN ('reserved','confirmed') THEN 'cancelled' ELSE r.status END,
        cancelled_at=CASE WHEN r.status IN ('reserved','confirmed') THEN NOW() ELSE r.cancelled_at END,
        competition_video_generation=gen_random_uuid()
      FROM prior WHERE r.id=prior.id RETURNING r.id::text,prior.generation::text`, [eventId]);
    }
    return { status: 200, body: { id: eventId, status: 'cancelled', rooms } };
  });
  // Store the retired generations with the idempotent result for safe retries after commit.
  const { rooms, ...response } = result.body as { id: string; status: string; rooms: RetiredRoom[] };
  await Promise.all(rooms.map(room => retireCompetitionVideoGeneration(room.id, room.generation)));
  return sendMutation(c, { ...result, body: response });
});

platformCompetitionRoutes.get('/platform/competitions/:id', async (c) => {
  const key = c.req.param('id');
  const actor = await optionalActor(c);
  privateNoStore(c);
  const rows = await platformQuery(platformDb(), `SELECT e.id::text,e.slug,e.title_zh AS "titleZh",e.title_en AS "titleEn",e.status,
    e.starts_at AS "startsAt",e.ends_at AS "endsAt",e.timezone,o.id::text AS "organizationId",o.name AS "organizationName",o.slug AS "organizationSlug",
    c.registration_opens_at AS "registrationOpensAt",c.registration_closes_at AS "registrationClosesAt",
    c.commission_bps AS "commissionBps",c.settlement_days AS "settlementDays",c.settlement_anchor AS "settlementAnchor",
    c.refund_policy AS "refundPolicy",c.recording_policy AS "recordingPolicy",c.submitted_at AS "submittedAt",
    COALESCE(c.competition_format,'average') AS format,c.supervision_mode AS "supervisionMode",
    c.review_status AS "reviewStatus",c.finalized_at AS "finalizedAt",c.is_test AS "isTest",
    c.refund_template AS "refundTemplate",c.offline_venue AS "offlineVenue",
    CASE WHEN $3 OR EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id=o.id
      AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin')) THEN c.review_note ELSE '' END AS "reviewNote",
    ${DRAFT_SETUP},
    ($3 OR (NOT c.is_test AND EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id=o.id AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin')))) AS "canManage",
    EXISTS (SELECT 1 FROM platform_competition_sessions s WHERE s.event_id=e.id AND s.supervisor_user_id=$2) AS "canSupervise"
    FROM platform_competitions c JOIN platform_events e ON e.id=c.event_id JOIN organizations o ON o.id=c.organization_id
    WHERE (e.id::text=$1 OR e.slug=$1) AND o.status='active'
      AND (NOT c.is_test OR ($2::bigint IS NOT NULL AND e.status IN ('published','completed')))
      AND (e.status IN ('published','completed') OR $3 OR EXISTS (SELECT 1 FROM organization_members m
      WHERE m.organization_id=o.id AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin')))`, [key,actor?.userId ?? null,actor?.isAdmin ?? false]);
  const competition = rows[0];
  if (!competition) notFound('Competition');
  if (competition.isTest) c.header('X-Robots-Tag', 'noindex, nofollow');
  const projects = await platformQuery(platformDb(), `SELECT t.id::text,t.competition_project AS project,t.competition_device AS device,t.amount_minor AS "amountMinor",t.currency,t.capacity,
    GREATEST(t.capacity-t.sold_quantity-COALESCE((SELECT SUM(r.quantity) FROM platform_event_registrations r
      WHERE r.event_id=t.event_id AND r.ticket_type_id=t.id AND r.status='reserved' AND r.reservation_expires_at>NOW()),0),0)::integer AS available
    FROM platform_event_ticket_types t WHERE t.event_id=$1::uuid AND t.competition_project IS NOT NULL AND t.status='active'
    ORDER BY t.competition_project,t.competition_device`, [competition.id]);
  const sessions = await platformQuery(platformDb(), `SELECT s.id::text,s.starts_at AS "startsAt",s.ends_at AS "endsAt",s.capacity,
    GREATEST(s.capacity-(SELECT COUNT(*) FROM platform_event_registrations r WHERE r.competition_session_id=s.id
      AND (r.status IN ('confirmed','attended') OR (r.status='reserved' AND r.reservation_expires_at>NOW()))),0)::integer AS available,
    CASE WHEN $2 OR s.supervisor_user_id=$3 THEN s.supervisor_user_id ELSE NULL END AS "supervisorUserId",
    (s.session_kind<>'supervised' OR s.supervisor_user_id IS NOT NULL) AS staffed,s.session_kind AS kind,s.assistance_requested AS "assistanceRequested"
    FROM platform_competition_sessions s WHERE s.event_id=$1::uuid ORDER BY s.starts_at,s.id`, [competition.id,competition.canManage,actor?.userId ?? null]);
  return c.json({ competition: { ...competition, canPublish: actor?.isAdmin ?? false,
    projects:projects.map(p=>({...p,amountMinor:competitionInteger(p.amountMinor),capacity:competitionInteger(p.capacity)})),
    sessions:sessions.map(s=>({...s,capacity:competitionInteger(s.capacity),available:competitionInteger(s.available),supervisorUserId:s.supervisorUserId==null?null:competitionInteger(s.supervisorUserId)})) } });
});

function windowFields(body: JsonObject) {
  const startsAt = requiredTimestamp(body,'startsAt');
  const endsAt = requiredTimestamp(body,'endsAt');
  const opens = requiredTimestamp(body,'registrationOpensAt');
  const closes = requiredTimestamp(body,'registrationClosesAt');
  if (Date.parse(endsAt)<=Date.parse(startsAt) || Date.parse(closes)<=Date.parse(opens) || Date.parse(closes)>Date.parse(endsAt)) badRequest('Invalid competition or registration window');
  return { startsAt,endsAt,opens,closes };
}
function competitionTitles(body: JsonObject) {
  const titleZh = stringField(body,'titleZh',{max:240}) ?? '';
  const titleEn = stringField(body,'titleEn',{max:240}) ?? '';
  if (!titleZh && !titleEn) badRequest('A title is required');
  return { titleZh, titleEn };
}

async function createCompetition(c: Context, withSetup: boolean) {
  const actor = await requirePlatformActor(c);
  const body = await readJsonObject(c);
  const organizationId = uuid(stringField(body,'organizationId',{required:true})!);
  const { titleZh, titleEn } = competitionTitles(body);
  const slug = stringField(body,'slug',{required:true,max:120,pattern:/^[a-z0-9][a-z0-9_-]*$/})!;
  const dates = windowFields(body);
  const setup = withSetup ? readCompetitionDraft(body, dates) : null;
  const refund = withSetup ? '' : stringField(body,'refundPolicy',{max:10000}) ?? '';
  const recording = withSetup ? '' : stringField(body,'recordingPolicy',{max:10000}) ?? '';
  return sendMutation(c,await withIdempotency(c,actor,withSetup ? 'competition.draft.create' : 'competition.create',body,async(db) => {
    const orgs = await platformQuery(db, `SELECT id FROM organizations o WHERE id=$1::uuid AND status='active' AND competition_organizer_approved_at IS NOT NULL AND ($3 OR EXISTS
      (SELECT 1 FROM organization_members m WHERE m.organization_id=o.id AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin')))`,[organizationId,actor.userId,actor.isAdmin]);
    if (!orgs[0]) forbidden('An approved organizer and active owner or administrator access are required');
    const events = await platformQuery<{id:string}>(db, `INSERT INTO platform_events(slug,title_zh,title_en,starts_at,ends_at,timezone,venue_snapshot,created_by_user_id)
      VALUES($1,$2,$3,$4,$5,'Asia/Shanghai','{"online":true}'::jsonb,$6) RETURNING id::text`,[slug,titleZh,titleEn,dates.startsAt,dates.endsAt,actor.userId]);
    await platformQuery(db, `INSERT INTO platform_competitions(
      event_id,organization_id,registration_opens_at,registration_closes_at,refund_policy,recording_policy,refund_template
    ) VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,'custom')`, [events[0].id, organizationId, dates.opens, dates.closes, refund, recording]);
    if (setup) await saveCompetitionDraft(db, events[0].id, organizationId, actor.isAdmin, dates, setup);
    return {status:201,body:{id:events[0].id,status:'draft'}};
  }));
}

platformCompetitionRoutes.post('/platform/competitions', c => createCompetition(c, false));
platformCompetitionRoutes.post('/platform/competitions/drafts', c => createCompetition(c, true));
platformCompetitionRoutes.put('/platform/competitions/drafts/:id', async c => {
  const actor = await requirePlatformActor(c);
  const eventId = id(c);
  const body = await readJsonObject(c);
  const { titleZh, titleEn } = competitionTitles(body);
  const dates = windowFields(body);
  const setup = readCompetitionDraft(body, dates);
  return sendMutation(c, await withIdempotency(c, actor, `competition.draft.update:${eventId}`, body, async db => {
    const event = await requireCompetitionManager(db, actor, eventId);
    if (event.status !== 'draft') conflict('Only competition drafts can be edited');
    await saveCompetitionDraft(db, eventId, event.organization_id, actor.isAdmin, dates, setup);
    const eventUpdated = await platformQuery(db, `UPDATE platform_events SET title_zh=$2,title_en=$3,starts_at=$4,ends_at=$5
      WHERE id=$1::uuid AND status='draft' RETURNING id`,
      [eventId, titleZh, titleEn, dates.startsAt, dates.endsAt]);
    if (!eventUpdated.length) conflict('Only competition drafts can be edited');
    return { status: 200, body: { id: eventId, status: 'draft' } };
  }));
});

async function requireSupervisedConfiguration(db: PlatformDb, eventId: string) {
  const [configuration] = await platformQuery<{ supervision_mode: string }>(db,
    'SELECT supervision_mode FROM platform_competitions WHERE event_id=$1::uuid', [eventId]);
  if (configuration?.supervision_mode !== 'supervised') conflict('This competition uses automatic scheduling');
}

platformCompetitionRoutes.put('/platform/competitions/:id/config', async(c) => {
  const actor = await requirePlatformActor(c); const eventId=id(c); const body=await readJsonObject(c);
  const dates=windowFields(body);
  const titleZh=stringField(body,'titleZh',{max:240});
  const titleEn=stringField(body,'titleEn',{max:240});
  if(titleZh!==undefined && titleEn!==undefined && !titleZh && !titleEn)badRequest('A title is required');
  const commission=integerField(body,'commissionBps',{min:0,max:10000}) ?? null;
  const days=integerField(body,'settlementDays',{min:0,max:3650}) ?? null;
  const anchor=enumField(body,'settlementAnchor',['ended','finalized']) ?? null;
  const refund=stringField(body,'refundPolicy',{max:10000}) ?? '';
  const recording=stringField(body,'recordingPolicy',{max:10000}) ?? '';
  const projects = readCompetitionProjects(body);
  return sendMutation(c,await withIdempotency(c,actor,`competition.config:${eventId}`,body,async(db)=>{
    const event=await requireCompetitionManager(db,actor,eventId); if(event.status!=='draft') conflict('Only draft competition configuration can be edited');
    await requireSupervisedConfiguration(db, eventId);
    const outside=await platformQuery(db,`SELECT id FROM platform_competition_sessions WHERE event_id=$1::uuid AND (starts_at<$2 OR ends_at>$3) LIMIT 1`,[eventId,dates.startsAt,dates.endsAt]);
    if(outside.length) conflict('The new window excludes an existing supervised session');
    await platformQuery(db,`UPDATE platform_competitions SET registration_opens_at=$2,registration_closes_at=$3,commission_bps=CASE WHEN $9 THEN $4 ELSE commission_bps END,settlement_days=CASE WHEN $9 THEN $5 ELSE settlement_days END,settlement_anchor=CASE WHEN $9 THEN $6 ELSE settlement_anchor END,refund_policy=$7,recording_policy=$8,submitted_at=NULL,review_status='draft' WHERE event_id=$1::uuid`,[eventId,dates.opens,dates.closes,commission,days,anchor,refund,recording,actor.isAdmin]);
    await platformQuery(db,`UPDATE platform_events SET starts_at=$2,ends_at=$3,title_zh=COALESCE($4,title_zh),title_en=COALESCE($5,title_en) WHERE id=$1::uuid`,[eventId,dates.startsAt,dates.endsAt,titleZh??null,titleEn??null]);
    await saveCompetitionProjects(db, eventId, dates, projects);
    return {status:200,body:{id:eventId,status:'draft'}};
  }));
});
async function saveSession(c:Context){
  const actor=await requirePlatformActor(c);const eventId=id(c);const body=await readJsonObject(c);
  const sessionId=c.req.param('sessionId') ? uuid(c.req.param('sessionId')!) : null;
  const starts=requiredTimestamp(body,'startsAt');const ends=requiredTimestamp(body,'endsAt');
  const capacity=integerField(body,'capacity',{required:true,min:1,max:1000})!;
  const supervisor=integerField(body,'supervisorUserId',{min:1}) ?? null;
  const assistance=booleanField(body,'assistanceRequested') ?? false;
  if(Date.parse(ends)<=Date.parse(starts))badRequest('Session end must be after start');
  return sendMutation(c,await withIdempotency(c,actor,`competition.session:${eventId}:${sessionId ?? 'new'}`,body,async(db)=>{
    const event=await requireCompetitionManager(db,actor,eventId);if(event.status!=='draft')conflict('Sessions can only be added to drafts');
    await requireSupervisedConfiguration(db, eventId);
    const within=await platformQuery(db,`SELECT id FROM platform_events WHERE id=$1::uuid AND starts_at<=$2 AND ends_at>=$3`,[eventId,starts,ends]);
    if(!within.length)badRequest('Session must be inside the competition window');
    if (supervisor) {
      await lockCompetitionSupervisors(db, [supervisor]);
      await validateCompetitionSupervisor(db, supervisor, event.organization_id, actor.isAdmin, starts, ends, sessionId);
    }
    const rows=sessionId ? await platformQuery<{id:string}>(db,`UPDATE platform_competition_sessions SET starts_at=$3,ends_at=$4,capacity=$5,supervisor_user_id=$6,assistance_requested=$7 WHERE id=$1::uuid AND event_id=$2::uuid RETURNING id::text`,[sessionId,eventId,starts,ends,capacity,supervisor,assistance]) : await platformQuery<{id:string}>(db,`INSERT INTO platform_competition_sessions(event_id,starts_at,ends_at,capacity,supervisor_user_id,assistance_requested) VALUES($1::uuid,$2,$3,$4,$5,$6) RETURNING id::text`,[eventId,starts,ends,capacity,supervisor,assistance]);
    await platformQuery(db,`UPDATE platform_competitions SET submitted_at=NULL,review_status='draft' WHERE event_id=$1::uuid`,[eventId]);
    if(!rows.length)notFound('Session');
    return {status:sessionId ? 200 : 201,body:{id:rows[0].id}};
  }));
}
platformCompetitionRoutes.post('/platform/competitions/:id/sessions',saveSession);
platformCompetitionRoutes.patch('/platform/competitions/:id/sessions/:sessionId',saveSession);

async function saveSettlementTerms(db: PlatformDb, eventId: string, body: JsonObject) {
  const commission = integerField(body, 'commissionBps', { min: 0, max: 10000 });
  const days = integerField(body, 'settlementDays', { min: 0, max: 3650 });
  const anchor = enumField(body, 'settlementAnchor', ['ended', 'finalized']);
  if (commission !== undefined || days !== undefined || anchor !== undefined) {
    await platformQuery(db, `UPDATE platform_competitions SET commission_bps=$2,settlement_days=$3,settlement_anchor=$4 WHERE event_id=$1::uuid`,
      [eventId, commission ?? null, days ?? null, anchor ?? null]);
  }
}

export async function publicationProblems(db: PlatformDb, eventId: string, submission = false): Promise<string[]> {
  const [row] = await platformQuery<{
    valid_window: boolean; windows_ordered: boolean; approved: boolean; paid: boolean; projects: number;
    sessions: number; unstaffed: number; refund_policy: string; recording_policy: string; supervision_mode: string;
    offline_venue: { city?: string; address?: string } | null; competition_format: string | null;
    commission_bps: number | null; settlement_days: number | null; settlement_anchor: string | null;
  }>(db, `SELECT c.*, c.registration_closes_at>NOW() AS valid_window,
    c.registration_closes_at<=e.starts_at AS windows_ordered,
    (o.status='active' AND o.competition_organizer_approved_at IS NOT NULL) AS approved,
    EXISTS(SELECT 1 FROM platform_event_ticket_types t WHERE t.event_id=c.event_id AND t.status='active' AND amount_minor>0) AS paid,
    (SELECT COUNT(*)::integer FROM platform_event_ticket_types t WHERE t.event_id=c.event_id AND t.status='active' AND t.competition_project IS NOT NULL) AS projects,
    (SELECT COUNT(*)::integer FROM platform_competition_sessions s WHERE s.event_id=c.event_id AND s.session_kind=c.supervision_mode) AS sessions,
    (SELECT COUNT(*)::integer FROM platform_competition_sessions s WHERE s.event_id=c.event_id AND s.session_kind='supervised'
      AND (s.supervisor_user_id IS NULL OR s.starts_at<c.registration_closes_at)
      AND (NOT $2 OR NOT s.assistance_requested OR s.starts_at<c.registration_closes_at)) AS unstaffed
    FROM platform_competitions c JOIN platform_events e ON e.id=c.event_id JOIN organizations o ON o.id=c.organization_id
    WHERE c.event_id=$1::uuid`, [eventId, submission]);
  if (!row) notFound('Competition');
  const problems: string[] = [];
  if (!row.approved) problems.push('Organizer application must be approved before competition publication');
  if (!row.valid_window) problems.push('Registration window has ended');
  if (row.competition_format && !row.windows_ordered) problems.push('Registration must close before the competition starts');
  if (!row.projects) problems.push('Add at least one project');
  if (!row.sessions || row.unstaffed) problems.push('Configure sessions after registration closes and assign or request supervision');
  if (row.supervision_mode === 'offline' && (!row.offline_venue?.city || !row.offline_venue.address)) problems.push('An offline venue is required');
  if (!row.refund_policy.trim() || !row.recording_policy.trim()) problems.push('Refund and recording policies are required');
  if (!submission && row.paid) {
    if (row.commission_bps == null || row.settlement_days == null || row.settlement_anchor == null) problems.push('Configure commission and settlement terms before paid publication');
    if (!Object.values(paymentAvailability()).some(Boolean)) problems.push('Platform payment collection is not configured');
  }
  return problems;
}

async function checkPublication(db: PlatformDb, eventId: string, submission = false) {
  const problems = await publicationProblems(db, eventId, submission);
  if (problems.length) conflict(problems.join('; '), { problems });
}

async function publishCompetition(db: PlatformDb, eventId: string, userId: number | null, note: string) {
  await platformQuery(db, `UPDATE platform_competitions SET review_status='approved', reviewed_by=$2,
    reviewed_at=NOW(), review_note=$3, submitted_at=COALESCE(submitted_at,NOW()) WHERE event_id=$1::uuid`, [eventId, userId, note]);
  await platformQuery(db, `UPDATE platform_events SET status='published',published_at=NOW() WHERE id=$1::uuid`, [eventId]);
}

async function submitCompetition(c: Context) {
  const actor = await requirePlatformActor(c);
  const eventId = id(c);
  const body = await readJsonObject(c);
  return sendMutation(c, await withIdempotency(c, actor, `competition.publish:${eventId}`, body, async db => {
    const event = await requireCompetitionManager(db, actor, eventId);
    if (event.status !== 'draft' || event.review_status === 'pending_approval') conflict('Only editable drafts may be submitted or published');
    if (actor.isAdmin) await saveSettlementTerms(db, eventId, body);
    await checkPublication(db, eventId, !actor.isAdmin);
    if (actor.isAdmin) await publishCompetition(db, eventId, actor.userId, '');
    else await platformQuery(db, `UPDATE platform_competitions SET review_status='pending_approval',submitted_at=NOW() WHERE event_id=$1::uuid`, [eventId]);
    return { status: 200, body: { id: eventId, status: actor.isAdmin ? 'published' : 'pending_approval' } };
  }));
}

platformCompetitionRoutes.post('/platform/competitions/:id/publish', submitCompetition);
platformCompetitionRoutes.post('/platform/competitions/:id/submit', submitCompetition);

platformCompetitionRoutes.get('/platform/competitions/organizers/:id/supervisors', async c => {
  const actor = await requirePlatformActor(c);
  const organizationId = id(c);
  privateNoStore(c);
  const [organization] = await platformQuery(platformDb(), `SELECT o.id FROM organizations o WHERE o.id=$1::uuid
    AND o.status='active' AND o.competition_organizer_approved_at IS NOT NULL AND ($3 OR EXISTS(
      SELECT 1 FROM organization_members m WHERE m.organization_id=o.id AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin')))`,
  [organizationId, actor.userId, actor.isAdmin]);
  if (!organization) forbidden('Competition organizer access required');
  const supervisors = await platformQuery(platformDb(), `SELECT u.id,u.display_name AS name FROM app_users u
    JOIN organization_members m ON m.user_id=u.id WHERE m.organization_id=$1::uuid AND m.status='active'
    AND m.role IN ('owner','admin','teacher','assistant') AND u.merged_into_user_id IS NULL ORDER BY u.display_name,u.id`, [organizationId]);
  return c.json({ supervisors: supervisors.map(user => ({ ...user, id: competitionInteger(user.id) })) });
});

platformCompetitionRoutes.post('/platform/competitions/:id/review', async c => {
  const actor = await requirePlatformAdmin(c);
  const eventId = id(c);
  const body = await readJsonObject(c);
  const decision = enumField(body, 'decision', ['approve', 'reject'], { required: true })!;
  const note = stringField(body, 'note', { required: decision === 'reject', max: 4000 }) ?? '';
  const assignments = arrayField(body, 'supervisorAssignments', { maxItems: 100 })?.map(raw => {
    if (!isObject(raw)) badRequest('Invalid supervisor assignment');
    return {
      sessionId: uuid(stringField(raw, 'sessionId', { required: true })!),
      supervisor: integerField(raw, 'supervisorUserId', { required: true, min: 1 })!,
    };
  }) ?? [];
  if (new Set(assignments.map(a => a.sessionId)).size !== assignments.length) badRequest('Duplicate session assignment');
  return sendMutation(c, await withIdempotency(c, actor, `competition.review:${eventId}`, body, async db => {
    const event = await requireCompetitionManager(db, actor, eventId);
    if (event.status !== 'draft' || event.review_status !== 'pending_approval') conflict('Competition is not awaiting review');
    const submittedAt = stringField(body, 'submittedAt', { max: 64 });
    if (submittedAt !== undefined) {
      const submitted = Date.parse(submittedAt);
      const [revision] = await platformQuery<{ submitted_at: Date }>(db, 'SELECT submitted_at FROM platform_competitions WHERE event_id=$1::uuid', [eventId]);
      if (revision?.submitted_at?.getTime() !== submitted) conflict('The competition changed after you opened it. Refresh the review queue.');
    }
    if (decision === 'approve') {
      await lockCompetitionSupervisors(db, assignments.map(a => a.supervisor));
      for (const { sessionId, supervisor } of assignments) {
        const [session] = await platformQuery<{ starts: string; ends: string }>(db, `SELECT starts_at AS starts,ends_at AS ends
          FROM platform_competition_sessions WHERE id=$1::uuid AND event_id=$2::uuid AND session_kind='supervised' AND assistance_requested`,
        [sessionId, eventId]);
        if (!session) badRequest('Assignment must target a session requesting assistance');
        const [eligible] = await platformQuery(db, 'SELECT id FROM app_users WHERE id=$1 AND is_admin AND merged_into_user_id IS NULL', [supervisor]);
        if (!eligible) badRequest('Select an eligible platform supervisor');
        await validateCompetitionSupervisor(db, supervisor, event.organization_id, true, session.starts, session.ends, sessionId);
        await platformQuery(db, `UPDATE platform_competition_sessions SET supervisor_user_id=$2 WHERE id=$1::uuid`, [sessionId, supervisor]);
      }
      await saveSettlementTerms(db, eventId, body);
      await checkPublication(db, eventId);
      await publishCompetition(db, eventId, actor.userId, note);
    } else {
      await platformQuery(db, `UPDATE platform_competitions SET review_status='rejected',review_note=$2,reviewed_by=$3,reviewed_at=NOW()
        WHERE event_id=$1::uuid`, [eventId, note, actor.userId]);
    }
    const recipients = await platformQuery<{ id: number; wca_id: string | null }>(db, `SELECT u.id,u.wca_id FROM app_users u
      JOIN organization_members m ON m.user_id=u.id
      WHERE m.organization_id=$1::uuid AND m.status='active' AND m.role IN ('owner','admin')`, [event.organization_id]);
    for (const recipient of recipients) {
      await platformQuery(db, `INSERT INTO notifications(user_key,kind,actor_name,title,excerpt,link)
        VALUES($1,$2,'CubeRoot',$3,$4,$5)`,
      [ownerKey(recipient.id, recipient.wca_id), decision === 'approve' ? 'competition_approved' : 'competition_rejected',
        decision === 'approve' ? '赛事已发布 / Competition published' : '赛事退回修改 / Competition changes requested',
        note, `/competitions/workspace/manage/${eventId}`]);
    }
    return { status: 200, body: { id: eventId, status: decision === 'approve' ? 'published' : 'rejected' } };
  }));
});

platformCompetitionRoutes.get('/platform/competitions/:id/registrations',async(c)=>{
  const actor=await requirePlatformActor(c);const eventId=id(c);privateNoStore(c);
  const registrations=await platformQuery(platformDb(),`SELECT r.id::text,r.user_id AS "userId",o.buyer_display_name_snapshot AS "displayName",r.status,r.competition_project AS project,
    t.competition_device AS device,s.session_kind AS "sessionKind",r.competition_session_id::text AS "sessionId",i.order_id::text AS "orderId",r.checked_in_at AS "checkedInAt",
    r.competition_attempts AS attempts,
    (SELECT MAX(a.attempt_number) FROM platform_competition_attempts a WHERE a.registration_id=r.id) AS "attemptNumber",
    EXISTS(SELECT 1 FROM platform_competition_attempts a WHERE a.registration_id=r.id AND a.review_required) AS "reviewRequired",
    COALESCE((SELECT jsonb_agg(jsonb_build_object('attemptNumber',a.attempt_number,'centiseconds',a.centiseconds,'penalty',a.penalty)
      ORDER BY a.attempt_number) FROM platform_competition_attempts a
      WHERE a.registration_id=r.id AND a.recorded_at IS NOT NULL AND a.review_required),'[]'::jsonb) AS "reviewAttempts",
    r.result_recorded_at AS "resultRecordedAt",r.reservation_expires_at AS "reservationExpiresAt",
    (r.user_id=$2 AND r.status='confirmed' AND s.session_kind<>'offline'
      AND (s.session_kind='supervised' OR t.competition_device='smart' OR COALESCE(c.competition_format,'average')='average') AND NOW()>=s.starts_at AND NOW()<s.ends_at) AS "canCheckIn",
    (s.supervisor_user_id=$2 AND r.user_id<>$2 AND r.checked_in_at IS NOT NULL AND r.status='confirmed'
      AND NOW()>=s.starts_at AND NOW()<s.ends_at) AS "canJoinVideo",
    (s.supervisor_user_id=$2 AND r.user_id<>$2 AND r.checked_in_at IS NOT NULL AND r.status IN ('confirmed','attended')
      AND t.competition_device='ordinary' AND NOW()>=s.starts_at AND NOW()<s.ends_at AND COALESCE(c.competition_format,'average')='average') AS "canRecordResult"
    FROM platform_event_registrations r JOIN platform_order_items i ON i.id=r.order_item_id JOIN platform_orders o ON o.id=i.order_id
    JOIN platform_event_ticket_types t ON t.id=r.ticket_type_id JOIN platform_competition_sessions s ON s.id=r.competition_session_id
    JOIN platform_competitions c ON c.event_id=r.event_id WHERE r.event_id=$1::uuid AND (r.user_id=$2 OR s.supervisor_user_id=$2 OR $3
      OR (NOT c.is_test AND EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=c.organization_id AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin')))) ORDER BY r.created_at LIMIT 1000`,[eventId,actor.userId,actor.isAdmin]);
  return c.json({registrations:registrations.map(r=>({...r,userId:competitionInteger(r.userId)}))});
});
platformCompetitionRoutes.post('/platform/competitions/registrations/:id/check-in',async(c)=>{
  const actor=await requirePlatformActor(c);const registrationId=id(c);const body=await readJsonObject(c);
  return sendMutation(c,await withIdempotency(c,actor,`competition.checkin:${registrationId}`,body,async(db)=>{
    const r=await requireCompetitionRegistration(db,registrationId);
    if(Number(r.user_id)!==actor.userId)forbidden('Only the registered participant can check in');
    if (r.session_kind === 'offline' || (r.competition_format === 'advancement' && r.session_kind !== 'supervised' && r.device !== 'smart')
      || !['confirmed','attended'].includes(r.status) || !r.in_window) conflict('Check-in requires an active online registration during the competition');
    if (r.device === 'smart') validateCompetitionDeviceCheckIn(body);
    await platformQuery(db,`UPDATE platform_event_registrations SET checked_in_at=COALESCE(checked_in_at,NOW()) WHERE id=$1::uuid`,[registrationId]);
    return {status:200,body:{id:registrationId,checkedIn:true}};
  }));
});
platformCompetitionRoutes.post('/platform/competitions/registrations/:id/result',async(c)=>{
  const actor=await requirePlatformActor(c);const registrationId=id(c);const body=await readJsonObject(c);
  if(body.attempts!==undefined)badRequest('Results must come from the supervised attempt workflow');
  return sendMutation(c,await withIdempotency(c,actor,`competition.result:${registrationId}`,body,async(db)=>{
    const r=await requireCompetitionRegistration(db,registrationId);
    if(r.session_kind!=='supervised'||r.competition_format==='advancement'||Number(r.supervisor_user_id)!==actor.userId||Number(r.user_id)===actor.userId)forbidden('Only the assigned independent supervisor can record this result');
    if(r.status!=='confirmed'||!r.in_window||!r.checked_in_at)conflict('An active checked-in registration without a recorded result is required');
    const recorded=await platformQuery<{centiseconds:number|null;penalty:string}>(db,`SELECT centiseconds,penalty FROM platform_competition_attempts WHERE registration_id=$1::uuid AND recorded_at IS NOT NULL ORDER BY attempt_number`,[registrationId]);
    const attempts=validateCompetitionAttempts(recorded);
    await platformQuery(db,`UPDATE platform_event_registrations SET competition_attempts=$2::jsonb,result_recorded_by=$3,result_recorded_at=NOW(),status='attended',competition_video_generation=gen_random_uuid() WHERE id=$1::uuid`,[registrationId,attempts,actor.userId]);
    return {status:200,body:{id:registrationId,attempts,status:'attended'}};
  }));
});
platformCompetitionRoutes.post('/platform/competitions/:id/offline-results', async c => {
  const actor = await requirePlatformActor(c);
  const eventId = id(c);
  const body = await readJsonObject(c);
  const entries = (arrayField(body, 'results', { required: true, maxItems: 100 }) ?? []).map(raw => {
    if (!isObject(raw)) badRequest('Invalid result');
    return { registrationId: uuid(stringField(raw, 'registrationId', { required: true })!), attempts: validateCompetitionAttempts(raw.attempts) };
  });
  if (!entries.length || new Set(entries.map(entry => entry.registrationId)).size !== entries.length) badRequest('Provide one result per registration');
  return sendMutation(c, await withIdempotency(c, actor, `competition.offline-results:${eventId}`, body, async db => {
    const event = await requireCompetitionManager(db, actor, eventId);
    if (event.status !== 'published' || event.supervision_mode !== 'offline' || event.competition_format === 'advancement') conflict('An active offline average competition is required');
    const [started] = await platformQuery(db, 'SELECT id FROM platform_events WHERE id=$1::uuid AND starts_at<=NOW()', [eventId]);
    if (!started) conflict('The competition has not started');
    for (const entry of entries) {
      const changed = await platformQuery(db, `UPDATE platform_event_registrations r SET competition_attempts=$3::jsonb,
        result_recorded_by=$4,result_recorded_at=NOW(),status='attended'
        WHERE r.event_id=$1::uuid AND r.id=$2::uuid AND r.status IN ('confirmed','attended')
          AND EXISTS (SELECT 1 FROM platform_event_ticket_types t WHERE t.id=r.ticket_type_id AND t.competition_device='ordinary')
          AND r.competition_session_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM platform_competition_disputes d WHERE d.registration_id=r.id AND d.resolved_at IS NULL
          ) RETURNING id`, [eventId, entry.registrationId, entry.attempts, actor.userId]);
      if (!changed.length) conflict('The registration is unavailable or has an outstanding dispute');
    }
    return { status: 200, body: { id: eventId, recorded: entries.length } };
  }));
});

platformCompetitionRoutes.post('/platform/competitions/registrations/:id/disputes',async(c)=>{
  const actor=await requirePlatformActor(c);const registrationId=id(c);const body=await readJsonObject(c);const reason=stringField(body,'reason',{required:true,max:4000})!;
  return sendMutation(c,await withIdempotency(c,actor,`competition.dispute:${registrationId}`,body,async(db)=>{
    const rows=await platformQuery(db,`SELECT r.id FROM platform_event_registrations r JOIN platform_competitions c ON c.event_id=r.event_id
      WHERE r.id=$1::uuid AND r.user_id=$2 AND r.competition_session_id IS NOT NULL AND r.status IN ('confirmed','attended') AND c.finalized_at IS NULL FOR UPDATE OF c,r`,[registrationId,actor.userId]);
    if(!rows.length)conflict('Only your active registration before finalization can be disputed');
    const inserted=await platformQuery<{id:string}>(db,`INSERT INTO platform_competition_disputes(registration_id,user_id,reason) VALUES($1::uuid,$2,$3) ON CONFLICT(registration_id) WHERE resolved_at IS NULL DO NOTHING RETURNING id::text`,[registrationId,actor.userId,reason]);
    if(!inserted.length)conflict('An unresolved dispute already exists');
    return {status:201,body:{id:inserted[0].id,status:'open'}};
  }));
});
platformCompetitionRoutes.get('/platform/competitions/:id/results',async(c)=>{
  privateNoStore(c);const eventId=id(c);
  const actor = await optionalActor(c);
  const results=await platformQuery<{id:string;project:string;device:string;attempts:unknown;displayName:string}>(platformDb(),`SELECT r.id::text,o.buyer_display_name_snapshot AS "displayName",r.competition_project AS project,t.competition_device AS device,u.wca_id AS "wcaId",CASE WHEN u.wca_id IS NOT NULL THEN u.country_iso2 END AS "countryCode",
    r.competition_attempts AS attempts,
    EXISTS(SELECT 1 FROM platform_competition_attempts a WHERE a.registration_id=r.id AND a.review_required) AS "reviewRequired",
    CASE WHEN c.finalized_at IS NOT NULL AND NOT c.is_test AND t.competition_device='smart' THEN ARRAY(
      SELECT d.attempt_number FROM platform_competition_device_reports d WHERE d.registration_id=r.id
        AND d.report IS NOT NULL AND d.report->>'disconnected'='false'
        AND jsonb_array_length(d.report->'moves')>0 ORDER BY d.attempt_number
    ) ELSE ARRAY[]::smallint[] END AS "replayAttempts",
    r.result_recorded_at AS "recordedAt",c.finalized_at AS "finalizedAt"
    FROM platform_event_registrations r JOIN platform_order_items i ON i.id=r.order_item_id JOIN platform_orders o ON o.id=i.order_id
    JOIN platform_event_ticket_types t ON t.id=r.ticket_type_id JOIN platform_competitions c ON c.event_id=r.event_id JOIN platform_events e ON e.id=r.event_id
    LEFT JOIN app_users u ON u.id=r.user_id
    WHERE r.event_id=$1::uuid AND e.status IN ('published','completed') AND r.status='attended' AND r.competition_attempts IS NOT NULL
      AND (NOT c.is_test OR $2::bigint IS NOT NULL)
      AND NOT EXISTS(SELECT 1 FROM platform_competition_disputes d WHERE d.registration_id=r.id AND d.resolved_at IS NULL)
    ORDER BY r.competition_project,r.result_recorded_at`,[eventId,actor?.userId ?? null]);
  const ranked=results.map(row=>({...row,...competitionResultSummary(row.attempts)})).sort((a,b)=>String(a.project).localeCompare(String(b.project))||String(a.device).localeCompare(String(b.device))||(a.averageCentiseconds??Infinity)-(b.averageCentiseconds??Infinity)||(a.bestCentiseconds??Infinity)-(b.bestCentiseconds??Infinity));
  let place=0,rank=0,previous:typeof ranked[number]|undefined;
  return c.json({results:ranked.map(row=>{
    if(!previous||previous.project!==row.project||previous.device!==row.device){place=0;rank=0;previous=undefined;}
    place++;
    if(!previous||previous.averageCentiseconds!==row.averageCentiseconds||previous.bestCentiseconds!==row.bestCentiseconds)rank=place;
    previous=row;return {...row,rank:row.averageCentiseconds===null?null:rank};
  })});
});
platformCompetitionRoutes.get('/platform/competitions/:id/disputes',async(c)=>{
  const actor=await requirePlatformActor(c);const eventId=id(c);privateNoStore(c);
  const disputes=await platformQuery(platformDb(),`SELECT d.id::text,d.registration_id::text AS "registrationId",d.reason,d.resolution,d.original_attempts AS "originalAttempts",d.corrected_attempts AS "correctedAttempts",d.created_at AS "createdAt",d.resolved_at AS "resolvedAt"
    FROM platform_competition_disputes d JOIN platform_event_registrations r ON r.id=d.registration_id JOIN platform_competitions c ON c.event_id=r.event_id
    WHERE r.event_id=$1::uuid AND (d.user_id=$2 OR $3 OR (NOT c.is_test AND EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=c.organization_id AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin')))) ORDER BY d.created_at DESC LIMIT 1000`,[eventId,actor.userId,actor.isAdmin]);
  return c.json({disputes});
});
platformCompetitionRoutes.post('/platform/competitions/disputes/:id/resolve',async(c)=>{
  const actor=await requirePlatformAdmin(c);const disputeId=id(c);const body=await readJsonObject(c);const resolution=stringField(body,'resolution',{required:true,max:4000})!;
  const corrected=body.correctedAttempts===undefined ? null : validateCompetitionAttempts(body.correctedAttempts);
  return sendMutation(c,await withIdempotency(c,actor,`competition.resolve:${disputeId}`,body,async(db)=>{
    const located=await platformQuery<{event_id:string;registration_id:string}>(db,`SELECT r.event_id::text,d.registration_id::text FROM platform_competition_disputes d JOIN platform_event_registrations r ON r.id=d.registration_id WHERE d.id=$1::uuid`,[disputeId]);
    if(!located.length)notFound('Dispute');
    await requireCompetitionManager(db,actor,located[0].event_id);
    const rows=await platformQuery<{competition_attempts:unknown;resolved_at:unknown;finalized_at:unknown;device:string}>(db,`SELECT r.competition_attempts,d.resolved_at,c.finalized_at,t.competition_device AS device
      FROM platform_event_registrations r JOIN platform_competition_disputes d ON d.registration_id=r.id
      JOIN platform_competitions c ON c.event_id=r.event_id JOIN platform_event_ticket_types t ON t.id=r.ticket_type_id WHERE d.id=$1::uuid FOR UPDATE OF r,d`,[disputeId]);
    if(rows[0].resolved_at||rows[0].finalized_at)conflict('The dispute is already resolved or competition finalized');
    if(corrected){
      if(!rows[0].competition_attempts)conflict('Close the supervised result before correcting it');
      if (rows[0].device === 'smart') {
        const previous = validateCompetitionAttempts(rows[0].competition_attempts);
        if (corrected.some((attempt, i) => attempt.penalty !== 'DNF'
          && (attempt.penalty !== previous[i].penalty || attempt.centiseconds !== previous[i].centiseconds))) {
          conflict('Smart cube results require verified device data');
        }
      }
      await platformQuery(db,`UPDATE platform_event_registrations SET competition_attempts=$2::jsonb,competition_video_generation=gen_random_uuid() WHERE id=$1::uuid`,[located[0].registration_id,corrected]);
    }
    await platformQuery(db,`UPDATE platform_competition_disputes SET resolution=$2,resolved_by=$3,resolved_at=NOW(),original_attempts=$4::jsonb,corrected_attempts=$5::jsonb WHERE id=$1::uuid`,[disputeId,resolution,actor.userId,rows[0].competition_attempts,corrected]);
    return {status:200,body:{id:disputeId,status:'resolved'}};
  }));
});
platformCompetitionRoutes.post('/platform/competitions/:id/close-sessions',async(c)=>{
  const actor=await requirePlatformActor(c);const eventId=id(c);const body=await readJsonObject(c);
  return sendMutation(c,await withIdempotency(c,actor,`competition.close:${eventId}`,body,async(db)=>{
    const event=await requireCompetitionManager(db,actor,eventId);
    if(event.status!=='published')conflict('Only published competition sessions can be closed');
    if (event.competition_format === 'advancement') {
      const [ended] = await platformQuery<{ generated: boolean }>(db, `SELECT c.brackets_generated_at IS NOT NULL AS generated
        FROM platform_events e JOIN platform_competitions c ON c.event_id=e.id WHERE e.id=$1::uuid AND e.ends_at<=NOW()`, [eventId]);
      if (!ended) conflict('Close bracket matches after the competition ends');
      if (!ended.generated) await generateCompetitionBrackets(db, eventId);
      const closed = await closeEndedCompetitionBrackets(db, eventId);
      return { status: 200, body: { id: eventId, closed } };
    }
    // Preserve issued scrambles and timings. Only the published aggregate gains timeout outcomes.
    const rows=await platformQuery<{id:string}>(db,`SELECT r.id::text FROM platform_event_registrations r JOIN platform_competition_sessions s ON s.id=r.competition_session_id WHERE r.event_id=$1::uuid AND r.status='confirmed' AND r.competition_attempts IS NULL AND s.ends_at<=NOW() FOR UPDATE OF r`,[eventId]);
    for(const row of rows){
      const attempts=await platformQuery(db,`SELECT a.centiseconds,CASE WHEN a.recorded_at IS NOT NULL THEN a.penalty WHEN a.issued_at IS NOT NULL THEN 'DNF' ELSE 'DNS' END AS penalty FROM generate_series(1,5) n LEFT JOIN platform_competition_attempts a ON a.registration_id=$1::uuid AND a.attempt_number=n ORDER BY n`,[row.id]);
      const validated=validateCompetitionAttempts(attempts);
      await platformQuery(db,`UPDATE platform_event_registrations SET competition_attempts=$2::jsonb,result_recorded_by=$3,result_recorded_at=NOW(),status='attended',competition_video_generation=gen_random_uuid() WHERE id=$1::uuid`,[row.id,validated,actor.userId]);
    }
    return {status:200,body:{id:eventId,closed:rows.length}};
  }));
});
platformCompetitionRoutes.post('/platform/competitions/:id/finalize',async(c)=>{
  const actor=await requirePlatformAdmin(c);const eventId=id(c);const body=await readJsonObject(c);
  return sendMutation(c,await withIdempotency(c,actor,`competition.finalize:${eventId}`,body,async(db)=>{
    const competition = await requireCompetitionManager(db,actor,eventId);
    const eligible=await platformQuery(db,`SELECT e.id FROM platform_events e WHERE e.id=$1::uuid AND e.ends_at<=NOW() AND e.status='published'
      AND NOT EXISTS(SELECT 1 FROM platform_competition_disputes d JOIN platform_event_registrations r ON r.id=d.registration_id WHERE r.event_id=e.id AND d.resolved_at IS NULL)`,[eventId]);
    if(!eligible.length)conflict('Finalization requires an ended competition with all disputes resolved');
    const incomplete = competition.competition_format === 'advancement'
      ? await platformQuery(db, `SELECT event_id FROM platform_competitions WHERE event_id=$1::uuid AND (
          brackets_generated_at IS NULL OR EXISTS (SELECT 1 FROM platform_competition_matches m WHERE m.event_id=$1::uuid AND m.status NOT IN ('completed','bye')))`, [eventId])
      : await platformQuery(db, `SELECT id FROM platform_event_registrations WHERE event_id=$1::uuid AND status='confirmed' AND competition_attempts IS NULL LIMIT 1`, [eventId]);
    if(incomplete.length)conflict('Close ended sessions and review their results before finalization');
    await platformQuery(db,`UPDATE platform_competitions SET finalized_at=NOW() WHERE event_id=$1::uuid`,[eventId]);
    await platformQuery(db,`UPDATE platform_events SET status='completed' WHERE id=$1::uuid`,[eventId]);
    return {status:200,body:{id:eventId,status:'completed'}};
  }));
});
