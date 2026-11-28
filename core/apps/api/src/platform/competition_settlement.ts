import type { PlatformActor } from './auth.js';
import { platformQuery, type PlatformDb } from './db.js';
import { competitionManagerAccess } from './competitions.js';
import { notFound } from './errors.js';

interface SettlementAmounts extends Record<string, unknown> {
  organizerAmountMinor: string;
  eligible: boolean;
}

/** Competition orders contain one registration, so order-wide refunds cannot be counted across items. */
const COMPETITION_SETTLEMENT_REGISTRATION_JOINS = `
    LEFT JOIN platform_order_items i ON i.id=r.order_item_id LEFT JOIN platform_orders ord ON ord.id=i.order_id
    LEFT JOIN LATERAL (SELECT COALESCE(SUM(f.amount_minor),0) AS refunded FROM platform_refunds f WHERE f.order_id=i.order_id AND (f.order_item_id IS NULL OR f.order_item_id=i.id) AND f.status IN ('succeeded','chargeback')) refunds ON true
    LEFT JOIN LATERAL (SELECT CASE WHEN ord.status IN ('paid','partially_fulfilled','fulfilled','partially_refunded','refunded','chargeback') THEN GREATEST(i.line_total_amount_minor-refunds.refunded,0)::numeric ELSE 0::numeric END AS net,refunds.refunded AS refunded) m ON true`;
const ORGANIZER_PROCEEDS = 'SUM(m.net-FLOOR(m.net*c.commission_bps/10000))';

interface OverviewRow extends Record<string, unknown> {
  id: string;
  titleZh: string;
  titleEn: string;
  organizationName: string;
  status: string;
  registered: number;
  netCollectedMinor: string;
  refundedMinor: string;
  organizerAmountMinor: string | null;
  competitionCount: number;
  totalRegistered: number;
  totalNetCollectedMinor: string;
  totalRefundedMinor: string;
  totalOrganizerAmountMinor: string | null;
}

export async function competitionHostOverview(db: PlatformDb, actor: PlatformActor) {
  const rows = await platformQuery<OverviewRow>(db, `
    WITH activity AS (
      SELECT e.id, e.title_zh, e.title_en, e.updated_at, org.name AS organization_name,
        CASE WHEN e.status='draft' THEN c.review_status
          WHEN e.status='published' AND e.ends_at<=NOW() THEN 'provisional_results' ELSE e.status END AS status,
        COUNT(DISTINCT r.user_id) FILTER (WHERE r.status IN ('confirmed','attended')) AS registered,
        COALESCE(SUM(m.net),0) AS net_collected, COALESCE(SUM(m.refunded),0) AS refunded,
        CASE WHEN c.commission_bps IS NULL AND SUM(m.net)>0 THEN NULL
          ELSE COALESCE(${ORGANIZER_PROCEEDS},0) END AS organizer_amount
      FROM platform_competitions c JOIN platform_events e ON e.id=c.event_id
      JOIN organizations org ON org.id=c.organization_id AND org.status='active'
      LEFT JOIN platform_event_registrations r ON r.event_id=c.event_id
      ${COMPETITION_SETTLEMENT_REGISTRATION_JOINS}
      WHERE NOT c.is_test AND ${competitionManagerAccess('$1','$2')}
      GROUP BY c.event_id,e.id,org.id
    )
    SELECT id::text, title_zh AS "titleZh", title_en AS "titleEn", organization_name AS "organizationName",status,
      registered::int, net_collected::text AS "netCollectedMinor", refunded::text AS "refundedMinor",
      organizer_amount::text AS "organizerAmountMinor", (COUNT(*) OVER ())::int AS "competitionCount",
      (SUM(registered) OVER ())::int AS "totalRegistered", (SUM(net_collected) OVER ())::text AS "totalNetCollectedMinor",
      (SUM(refunded) OVER ())::text AS "totalRefundedMinor",
      CASE WHEN COUNT(*) OVER ()=COUNT(organizer_amount) OVER ()
        THEN (SUM(organizer_amount) OVER ())::text END AS "totalOrganizerAmountMinor"
    FROM activity ORDER BY updated_at DESC,id LIMIT 20
  `, [actor.userId, actor.isAdmin]);
  const first = rows[0];
  return {
    currency: 'CNY',
    competitionCount: first?.competitionCount ?? 0,
    totals: {
      registered: first?.totalRegistered ?? 0,
      netCollectedMinor: first?.totalNetCollectedMinor ?? '0',
      refundedMinor: first?.totalRefundedMinor ?? '0',
      organizerAmountMinor: first ? first.totalOrganizerAmountMinor : '0',
    },
    competitions: rows.map(({ id, titleZh, titleEn, organizationName, status, registered, netCollectedMinor, refundedMinor, organizerAmountMinor }) =>
      ({ id, titleZh, titleEn, organizationName, status, registered, netCollectedMinor, refundedMinor, organizerAmountMinor })),
  };
}

export async function competitionSettlement(db: PlatformDb, eventId: string) {
  const [row] = await platformQuery<SettlementAmounts>(db, `SELECT c.commission_bps AS "commissionBps",c.settlement_days AS "settlementDays",c.settlement_anchor AS "settlementAnchor",
    c.finalized_at AS "finalizedAt",(CASE WHEN c.settlement_anchor='finalized' THEN c.finalized_at ELSE e.ends_at END + make_interval(days=>c.settlement_days)) AS "eligibleAt",
    COALESCE(SUM(m.net),0)::text AS "netCollectedMinor",
    COALESCE(SUM(FLOOR(m.net*c.commission_bps/10000)),0)::text AS "platformFeeMinor",
    COALESCE(${ORGANIZER_PROCEEDS},0)::text AS "organizerAmountMinor",
    COALESCE(SUM(m.refunded),0)::text AS "refundedMinor",
    (c.finalized_at IS NOT NULL AND c.commission_bps IS NOT NULL AND c.settlement_days IS NOT NULL AND c.settlement_anchor IS NOT NULL
      AND NOW()>=(CASE WHEN c.settlement_anchor='finalized' THEN c.finalized_at ELSE e.ends_at END + make_interval(days=>c.settlement_days))
      AND NOT EXISTS(SELECT 1 FROM platform_competition_disputes d JOIN platform_event_registrations dr ON dr.id=d.registration_id WHERE dr.event_id=c.event_id AND d.resolved_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM platform_refunds f JOIN platform_order_items oi ON oi.order_id=f.order_id JOIN platform_event_registrations fr ON fr.order_item_id=oi.id WHERE fr.event_id=c.event_id AND f.status IN ('requested','pending'))) AS eligible
    FROM platform_competitions c JOIN platform_events e ON e.id=c.event_id LEFT JOIN platform_event_registrations r ON r.event_id=c.event_id
    ${COMPETITION_SETTLEMENT_REGISTRATION_JOINS}
    WHERE c.event_id=$1::uuid AND NOT c.is_test GROUP BY c.event_id,e.ends_at`, [eventId]);
  if (!row) notFound('Competition');
  const transfers = await platformQuery(db, `SELECT id::text,entry_type AS "entryType",amount_minor::text AS "amountMinor",transferred_at AS "transferredAt",created_at AS "createdAt",statement_snapshot AS "statementSnapshot"
    FROM platform_competition_settlement_ledger WHERE event_id=$1::uuid ORDER BY entry_number`, [eventId]);
  const transferred = transfers.reduce((total, entry) => total + (entry.entryType === 'payout' ? BigInt(String(entry.amountMinor)) : entry.entryType === 'recovery' ? -BigInt(String(entry.amountMinor)) : 0n), 0n);
  const remaining = BigInt(String(row.organizerAmountMinor)) - transferred;
  return { ...row, currency: 'CNY', transferredMinor: transferred.toString(), outstandingMinor: remaining.toString(),
    reconciliationRequired: remaining < 0n,
    transferStatus: remaining < 0n ? 'reconciliation_required' : transfers.length > 0 && remaining === 0n ? 'recorded' : 'not_initiated', transfers };
}

/** Caller holds the competition row lock. Append a new financial snapshot after a refund. */
export async function reconcileCompetitionSettlement(db: PlatformDb, eventId: string, actor: PlatformActor): Promise<void> {
  const current = await competitionSettlement(db, eventId);
  const latest = current.transfers.at(-1);
  if (!latest) return;
  const prior = latest.statementSnapshot as Record<string, unknown>;
  if (String(prior.organizerAmountMinor) === String(current.organizerAmountMinor)) return;
  const { transfers: _transfers, ...snapshot } = current;
  const [entry] = await platformQuery(db, `INSERT INTO platform_competition_settlement_ledger(event_id,entry_type,amount_minor,statement_snapshot,actor_user_id,actor_key)
    VALUES($1::uuid,'adjustment',0,$2::jsonb,$3,$4) RETURNING id::text`, [eventId,snapshot,actor.userId,actor.ownerKey]);
  await platformQuery(db, `INSERT INTO platform_audit_events(actor_user_id,actor_key,action,resource_type,resource_id,outcome,metadata)
    VALUES($1,$2,'competition.settlement.refund_adjustment','competition_settlement',$3,'allowed',$4::jsonb)`,
    [actor.userId,actor.ownerKey,entry.id,{eventId,previousAmountMinor:prior.organizerAmountMinor,...snapshot}]);
}
