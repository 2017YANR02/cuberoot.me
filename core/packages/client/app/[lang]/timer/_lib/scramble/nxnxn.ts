import { scramble222 as generate222 } from '@cuberoot/shared/timer/seeded/nxnxn';
import { get222Mode } from '@/lib/scramble-222-mode';
export { scramble333, scramble444, scramble555, scramble666, scramble777 } from '@cuberoot/shared/timer/seeded/nxnxn';
export function scramble222(rng: () => number): string { return generate222(rng, get222Mode()); }
