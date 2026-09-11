import { createHash } from 'node:crypto';

/** S256 browser/native proof binding; the verifier never travels in a redirect URL. */
export function challengeFromVerifier(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
