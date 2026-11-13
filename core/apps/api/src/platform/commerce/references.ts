import { createHash } from 'node:crypto';

export function hashReference(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
