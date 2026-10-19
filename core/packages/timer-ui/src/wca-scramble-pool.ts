/** Browser defaults only. Queue, retry, filtering and persistence have one shared owner. */
import { createWcaScramblePool as createSharedPool, type WcaPoolDependencies as SharedDependencies } from '@cuberoot/shared/timer/wca-scramble-pool';
import { filterNon222BySteps } from './scramble/non222-steps';
export type { WcaSourceSpec, WcaScrambleMeta, WcaDispensedScramble } from '@cuberoot/shared/timer/wca-scramble-pool';
export type WcaPoolDependencies = Omit<SharedDependencies, 'fetcher'> & { fetcher?: SharedDependencies['fetcher'] };
export function createWcaScramblePool(deps: WcaPoolDependencies) {
  return createSharedPool({ ...deps, fetcher: deps.fetcher ?? ((...args) => fetch(...args)),
    storage: deps.storage ?? (() => typeof localStorage !== 'undefined' ? localStorage : null),
    filterNon222: deps.filterNon222 ?? filterNon222BySteps });
}
