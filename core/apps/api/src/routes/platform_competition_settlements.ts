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
  await requireCompetitionManager(platformDb(),actor,id);
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
    await requireCompetitionManager(db,actor,id);
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
  }));
});
