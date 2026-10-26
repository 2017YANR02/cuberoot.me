// Web data adapter over the runtime-neutral competition-name rules shared with Mobile.
import {
  localizeCompName as localizeSharedCompName,
  resolveCompName as resolveSharedCompName,
  stripCompYear,
  stripWcaPrefix,
  type LocalizeCompOpts as SharedLocalizeCompOpts,
} from '@cuberoot/shared/comp-localize';
import { compNameEnFromZh, compNameZh } from './country-flags';
import { localizeCity } from './city-localize';
import type { CompInfo, CubingZhMeta } from './comp-wcif';

/** Use the complete Chinese venue when available; otherwise retain WCA location data. */
export function resolveCompLocation(
  info: Pick<CompInfo, 'city' | 'country_iso2' | 'venue_address'> | null | undefined,
  cubingZh: Pick<CubingZhMeta, 'location'> | null | undefined,
  isZh: boolean,
) {
  const localizedAddress = isZh ? cubingZh?.location || '' : '';
  const address = localizedAddress || info?.venue_address || '';
  const city = localizeCity(info?.city || '', isZh, info?.country_iso2);
  return {
    address,
    hasLocalizedAddress: !!localizedAddress,
    text: localizedAddress || [city, address].filter(Boolean).join(' · '),
  };
}

export { stripCompYear, stripWcaPrefix };

export interface LocalizeCompOpts {
  upcomingNameZhById?: ReadonlyMap<string, string> | null;
  explicitNameZh?: string | null;
  date?: string | null;
}

function withWebResolvers(opts?: LocalizeCompOpts): SharedLocalizeCompOpts {
  return {
    ...opts,
    resolveNameEnFromZh: compNameEnFromZh,
    resolveNameZh: compNameZh,
  };
}

export function resolveCompName(
  id: string,
  name: string,
  isZh: boolean,
  opts?: LocalizeCompOpts,
): string {
  return resolveSharedCompName(id, name, isZh, withWebResolvers(opts));
}

export function localizeCompName(
  id: string,
  name: string,
  isZh: boolean,
  opts?: LocalizeCompOpts,
): string {
  return localizeSharedCompName(id, name, isZh, withWebResolvers(opts));
}
