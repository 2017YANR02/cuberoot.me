// Canonical competition-city localization is runtime-neutral and shared with Mobile.
import { localizeCity } from '@cuberoot/shared/city-localize';

/** Compact card labels put Chinese administrative areas before the city. */
export function compactCityLabel(city: string, isZh: boolean, iso2: string): string {
  if (!isZh) return city;
  const localized = localizeCity(city, true, iso2);
  if (iso2.toUpperCase() !== 'CN') return localized;
  return [...new Set(localized.split('，').reverse())].join('');
}

export {
  localizeCity,
  normalizeCityKey,
  resolveCnProvince,
} from '@cuberoot/shared/city-localize';
