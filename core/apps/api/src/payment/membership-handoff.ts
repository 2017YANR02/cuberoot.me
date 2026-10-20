import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../utils/session.js';
import { RENEWAL_TEMPLATES, RENEWAL_TERMS_VERSION, type RenewalSlug } from './membership-renewal-policy.js';

// Domain separation prevents a handoff token from being accepted as an account session.
const key = createHmac('sha256', JWT_SECRET).update('membership-mini-handoff-v1').digest();
export function issueMembershipHandoff(owner: string, slug: string): string {
  if (!Object.hasOwn(RENEWAL_TEMPLATES, slug)) throw new Error('invalid renewal plan');
  return jwt.sign({ owner, slug, termsVersion: RENEWAL_TERMS_VERSION }, key,
    { algorithm: 'HS256', audience: 'membership-mini', expiresIn: '10m' });
}
export function readMembershipHandoff(token: unknown, owner: string) {
  if (typeof token !== 'string' || token.length > 2048) throw new Error('invalid handoff');
  const value = jwt.verify(token, key, { algorithms: ['HS256'], audience: 'membership-mini' });
  if (typeof value === 'string' || value.owner !== owner || typeof value.slug !== 'string'
    || !Object.hasOwn(RENEWAL_TEMPLATES, value.slug) || value.termsVersion !== RENEWAL_TERMS_VERSION) throw new Error('handoff account mismatch');
  const slug = value.slug as RenewalSlug;
  return { planSlug: slug, priceCents: RENEWAL_TEMPLATES[slug].cents,
    period: RENEWAL_TEMPLATES[slug].period, termsVersion: RENEWAL_TERMS_VERSION };
}
