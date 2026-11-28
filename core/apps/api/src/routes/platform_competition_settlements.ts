import { createHash } from 'node:crypto';
import { requirePlatformActor, requirePlatformAdmin } from '../platform/auth.js';
import { competitionSettlement } from '../platform/competition_settlement.js';
import { requireCompetitionManager } from '../platform/competitions.js';
import { platformDb, platformQuery, sendMutation, withIdempotency } from '../platform/db.js';
import { badRequest, conflict } from '../platform/errors.js';
import { platformRouter, privateNoStore } from '../platform/http.js';
import { enumField, integerField, isoTimestampField, readJsonObject, stringField } from '../platform/validation.js';

export const platformCompetitionSettlementRoutes = platformRouter();
function eventId(raw: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) badRequest('Invalid competition id');
  return raw;
}

platformCompetitionSettlementRoutes.get('/platform/competitions/:id/settlement', async c => {
  privateNoStore(c);
  const actor = await requirePlatformActor(c);
  const id = eventId(c.req.param('id'));
  const competition = await requireCompetitionManager(platformDb(),actor,id,false);
  if (competition.is_test) return c.json({ settlement: null });
  return c.json({ settlement: await competitionSettlement(platformDb(),id) });
});

/** Record a transfer already completed externally. This endpoint never initiates a money transfer. */
platformCompetitionSettlementRoutes.post('/platform/competitions/:id/settlement-record', async c => {
  const actor = await requirePlatformAdmin(c);
  const id = eventId(c.req.param('id'));
  const body = await readJsonObject(c);
  const direction = enumField(body,'direction',['payout','recovery']) ?? 'payout';
  const amount = integerField(body,'amountMinor',{required:true,min:1})!;
  const reference = stringField(body,'providerReference',{required:true,max:240})!;
  const transferredAt = isoTimestampField(body,'transferredAt');
  if (!transferredAt || Date.parse(transferredAt)>Date.now()) badRequest('A completed transfer timestamp is required');
  const hash = createHash('sha256').update(reference).digest('hex');
  return sendMutation(c,await withIdempotency(c,actor,`competition.settlement.record:${id}`,body,async db => {
    const competition = await requireCompetitionManager(db,actor,id);
    if (competition.is_test) conflict('Test competitions do not have settlements');
    const statement = await competitionSettlement(db,id);
    const remaining = BigInt(statement.outstandingMinor);
    const expected = direction === 'payout' ? remaining : -remaining;
    if (expected<=0n || expected!==BigInt(amount)) conflict('Record exactly the current outstanding settlement or recovery amount');
    if (direction==='payout' && !statement.eligible) conflict('Finalization, settlement delay and all pending disputes or refunds must be complete');
    await platformQuery(db,`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,[`competition-transfer:${hash}`]);
    const existing = await platformQuery(db,`SELECT id FROM platform_competition_settlement_ledger WHERE provider_reference_hash=$1`,[hash]);
    if (existing.length) conflict('This transfer reference has already been recorded');
    const { transfers: _transfers,...snapshot } = statement;
    const [entry] = await platformQuery(db,`INSERT INTO platform_competition_settlement_ledger(event_id,entry_type,amount_minor,provider_reference_hash,transferred_at,statement_snapshot,actor_user_id,actor_key)
      VALUES($1::uuid,$2,$3,$4,$5,$6::jsonb,$7,$8) RETURNING id::text`,[id,direction,amount,hash,transferredAt,snapshot,actor.userId,actor.ownerKey]);
    await platformQuery(db,`INSERT INTO platform_audit_events(actor_user_id,actor_key,action,resource_type,resource_id,outcome,metadata)
      VALUES($1,$2,'competition.settlement.external_transfer_recorded','competition_settlement',$3,'allowed',$4::jsonb)`,[actor.userId,actor.ownerKey,entry.id,{eventId:id,direction,amountMinor:amount,providerReferenceHash:hash,transferredAt}]);
    return {status:201,body:{id:entry.id,settlement:await competitionSettlement(db,id)},resourceType:'competition_settlement',resourceId:String(entry.id)};
  }, db => requireCompetitionManager(db, actor, id)));
});

platformCompetitionSettlementRoutes.post('/platform/competitions/:id/settlement-terms', async c => {
  const actor = await requirePlatformAdmin(c);
  const id = eventId(c.req.param('id'));
  const body = await readJsonObject(c);
  const commissionBps = integerField(body, 'commissionBps', { required: true, min: 0, max: 10_000 })!;
  const settlementDays = integerField(body, 'settlementDays', { required: true, min: 0, max: 3650 })!;
  const settlementAnchor = enumField(body, 'settlementAnchor', ['ended', 'finalized'], { required: true })!;
  return sendMutation(c, await withIdempotency(c, actor, `competition.settlement.terms:${id}`, body, async db => {
    const competition = await requireCompetitionManager(db, actor, id);
    if (competition.is_test || !['published', 'completed'].includes(competition.status)) conflict('Settlement terms apply to a published paid competition');
    const rows = await platformQuery(db, `UPDATE platform_competitions c
      SET commission_bps=$2,settlement_days=$3,settlement_anchor=$4
      WHERE c.event_id=$1 AND (c.commission_bps IS NULL OR c.settlement_days IS NULL OR c.settlement_anchor IS NULL)
        AND EXISTS(SELECT 1 FROM platform_event_ticket_types t WHERE t.event_id=c.event_id AND t.amount_minor>0)
        AND NOT EXISTS(SELECT 1 FROM platform_competition_settlement_ledger l WHERE l.event_id=c.event_id)
      RETURNING c.event_id`, [id, commissionBps, settlementDays, settlementAnchor]);
    if (!rows.length) conflict('Terms are already configured or the competition has no paid tickets');
    await platformQuery(db, `INSERT INTO platform_audit_events(actor_user_id,actor_key,action,resource_type,resource_id,outcome,metadata)
      VALUES($1,$2,'competition.settlement.terms','competition',$3,'allowed',$4::jsonb)`,
    [actor.userId, actor.ownerKey, id, { commissionBps, settlementDays, settlementAnchor }]);
    return { status: 200, body: { settlement: await competitionSettlement(db, id) } };
  }, db => requireCompetitionManager(db, actor, id)));
});
