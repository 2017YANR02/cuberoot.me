/** Both templates must be reviewed before release. No date or callback can open this gate. */
export const RENEWAL_TERMS_VERSION = '2026-10-14';
export const RENEWAL_TEMPLATES = {
  monthly_auto_renew: { id: '225492', cents: 2999, period: 'month' },
  yearly_auto_renew: { id: '225493', cents: 29900, period: 'year' },
} as const;
export type RenewalSlug = keyof typeof RENEWAL_TEMPLATES;
export function renewalReleased(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env.WECHAT_PAPAY_MONTHLY_APPROVED === '225492'
    && env.WECHAT_PAPAY_YEARLY_APPROVED === '225493'
    && env.WECHAT_PAPAY_H5_APPROVED === 'true'
    && env.WECHAT_PAPAY_RELEASE_ENABLED === 'true';
}
