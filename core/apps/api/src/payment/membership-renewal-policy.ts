/** Both templates must be reviewed before release. No date or callback can open this gate. */
export const RENEWAL_TERMS_VERSION = '2026-10-14';
export const RENEWAL_TEMPLATES = {
  monthly_auto_renew: { id: '225492', cents: 2999, period: 'month' },
  yearly_auto_renew: { id: '225493', cents: 29900, period: 'year' },
  enterprise_monthly_auto_renew: { get id() { return process.env.WECHAT_PAPAY_ENTERPRISE_MONTHLY_PLAN_ID ?? ''; }, cents: 29900, period: 'month' },
} as const;
export type RenewalSlug = keyof typeof RENEWAL_TEMPLATES;
export function renewalChannel(env: Readonly<Record<string, string | undefined>> = process.env): 'h5' | 'miniprogram' {
  return env.WECHAT_PAPAY_SIGNING_CHANNEL === 'miniprogram' ? 'miniprogram' : 'h5';
}
export function renewalReleased(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env.WECHAT_PAPAY_MONTHLY_APPROVED === '225492'
    && env.WECHAT_PAPAY_YEARLY_APPROVED === '225493'
    && (renewalChannel(env) === 'miniprogram'
      ? env.WECHAT_PAPAY_MINI_RELEASED === 'wx1f92ba91b7e42015'
        && env.WECHAT_PAPAY_APPID === 'wx1f92ba91b7e42015'
        && env.WECHAT_MINI_APP_ID === env.WECHAT_PAPAY_APPID
        && Boolean(env.WECHAT_MINI_APP_SECRET)
      : env.WECHAT_PAPAY_H5_APPROVED === 'true')
    && env.WECHAT_PAPAY_RELEASE_ENABLED === 'true';
}

/** A private, time-limited acceptance lane. Never makes the public gate true. */
export function renewalPilotAllowed(owner: string | undefined, env: Readonly<Record<string, string | undefined>> = process.env, now = Date.now()): boolean {
  const until = Date.parse(env.WECHAT_PAPAY_PILOT_UNTIL ?? '');
  return Boolean(owner && owner === env.WECHAT_PAPAY_PILOT_OWNER
    && env.WECHAT_PAPAY_PILOT_ENABLED === 'true'
    && Number.isFinite(until) && until > now && until - now <= 7 * 86400000
    && renewalChannel(env) === 'miniprogram'
    && env.WECHAT_PAPAY_MONTHLY_APPROVED === '225492' && env.WECHAT_PAPAY_YEARLY_APPROVED === '225493'
    && env.WECHAT_PAPAY_APPID === 'wx1f92ba91b7e42015'
    && env.WECHAT_MINI_APP_ID === env.WECHAT_PAPAY_APPID && env.WECHAT_MINI_APP_SECRET);
}
export function renewalEnrollmentAllowed(owner: string, env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return renewalReleased(env) || renewalPilotAllowed(owner, env);
}
export function renewalDebitAllowed(owner: string, cycle: number, env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  if (renewalReleased(env)) return env.WECHAT_PAPAY_DEBIT_ENABLED === 'true';
  // Pilot payments are real and opt-in; never schedule another period in this lane.
  return cycle === 0 && renewalPilotAllowed(owner, env) && env.WECHAT_PAPAY_PILOT_DEBIT_ENABLED === 'true';
}

/** Enterprise approval is independent; never reuse a personal template for a higher amount. */
export function renewalPlanConfigured(slug: string, env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  if (!Object.hasOwn(RENEWAL_TEMPLATES, slug)) return false;
  if (!slug.startsWith('enterprise_')) return true;
  const id = env.WECHAT_PAPAY_ENTERPRISE_MONTHLY_PLAN_ID ?? '';
  return /^\d{1,28}$/.test(id) && !['225492', '225493'].includes(id)
    && env.WECHAT_PAPAY_ENTERPRISE_MONTHLY_APPROVED === id;
}
