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
  const rawAddress = localizedAddress || info?.venue_address || '';
  // Keep spaces in Latin venue names, but join Chinese address segments.
  const address = isZh && info?.country_iso2 === 'CN'
    ? rawAddress.replace(/([\u3400-\u9fff\d])\s+(?=[\u3400-\u9fff\d])/g, '$1')
    : rawAddress;
  const city = localizeCity(info?.city || '', isZh, info?.country_iso2);
  return {
    address,
    hasLocalizedAddress: !!localizedAddress,
    text: localizedAddress ? address : [city, address].filter(Boolean).join(' · '),
  };
}

/** Indoor directions remain in the displayed/copied address, not the map query. */
export function compMapAddress(address: string, isZh: boolean, countryIso2?: string) {
  if (!isZh || countryIso2 !== 'CN') return address;
  // A named hall after a venue is an indoor detail; retain standalone hall POIs.
  const venue = address.match(/^(.*?(?:酒店|宾馆|饭店|大厦|大楼|会议中心|会展中心|体育馆))\s*(?:[（(]?[^路街号]*[厅室]|[（(]?(?:地下|负)?[一二三四五六七八九十百零两\d]+[楼层]|[（(]?[BL]?\d+F)/i);
  if (venue) return venue[1];
  const floor = address.search(/(?:地下|负)?[一二三四五六七八九十百零两\d]+(?:楼|层)(?![村路街巷号栋座])|\b[BL]?\d+F\b/i);
  return floor > 0 ? address.slice(0, floor).replace(/[\s,，、（(]+$/, '') : address;
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
