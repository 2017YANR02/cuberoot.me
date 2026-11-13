/** Paid and redeemed course memberships use the same UTC calendar arithmetic. */
export function membershipPeriodBase(current: { status: string; valid_until: string | null } | undefined, now = new Date()): Date {
  return current?.status !== 'revoked' && current?.valid_until && new Date(current.valid_until) > now
    ? new Date(current.valid_until)
    : now;
}

export function addMembershipPeriod(base: Date, unit: string, count: number): string | null {
  if (unit === 'lifetime') return null;
  const result = new Date(base);
  if (unit === 'day') result.setUTCDate(result.getUTCDate() + count);
  else if (unit === 'month') result.setUTCMonth(result.getUTCMonth() + count);
  else result.setUTCFullYear(result.getUTCFullYear() + count);
  return result.toISOString();
}
