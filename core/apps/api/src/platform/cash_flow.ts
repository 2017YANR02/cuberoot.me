/** Shared receipt/refund semantics for business analytics and the admin dashboard.
 * Callers provide a `bounds(start_at, end_at)` CTE; amounts remain in minor units.
 */
export const ORDER_CASH_FLOW_SQL = `
  SELECT paid_at AS occurred_at, currency, total_amount_minor::numeric AS paid, 0::numeric AS refunded
  FROM platform_orders CROSS JOIN bounds WHERE paid_at >= bounds.start_at AND paid_at < bounds.end_at
  UNION ALL
  SELECT succeeded_at AS occurred_at, currency, 0::numeric AS paid, amount_minor::numeric AS refunded
  FROM platform_refunds CROSS JOIN bounds WHERE status = 'succeeded'
    AND succeeded_at >= bounds.start_at AND succeeded_at < bounds.end_at
`;
