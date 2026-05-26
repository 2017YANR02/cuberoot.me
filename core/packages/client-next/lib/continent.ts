// Ported from packages/client/src/utils/continent.ts.
// ISO 3166-1 alpha-2 → 大洲 code (AF/AS/EU/NA/OC/SA).

export type ContinentCode = 'AF' | 'AS' | 'EU' | 'NA' | 'OC' | 'SA';

export const CONTINENT_CODES: readonly ContinentCode[] = ['AF', 'AS', 'EU', 'NA', 'OC', 'SA'];

export const CONTINENT_NAMES: Record<ContinentCode, { en: string; zh: string }> = {
  AF: { en: 'Africa',         zh: '非洲'   },
  AS: { en: 'Asia',           zh: '亚洲'   },
  EU: { en: 'Europe',         zh: '欧洲'   },
  NA: { en: 'North America',  zh: '北美洲' },
  OC: { en: 'Oceania',        zh: '大洋洲' },
  SA: { en: 'South America',  zh: '南美洲' },
};

export const CONTINENT_ORDER: ContinentCode[] = ['AS', 'EU', 'NA', 'SA', 'OC', 'AF'];

export const CONTINENT_TO_ISO2S: Record<ContinentCode, string[]> = {
  AF: 'DZ AO BJ BW BF BI CM CV CF TD KM CG CD CI DJ EG GQ ER ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD SZ TZ TG TN UG ZM ZW RE'.split(' '),
  AS: 'AF AM AZ BH BD BT BN KH CN CY GE IN ID IR IQ IL JP JO KZ KP KR KW KG LA LB MY MV MN MM NP OM PK PH QA SA SG LK SY TW TJ TH TL TR TM AE UZ VN YE HK MO PS'.split(' '),
  EU: 'AL AD AT BY BE BA BG HR CZ DK EE FI FR DE GR HU IS IE IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA'.split(' '),
  NA: 'AG BS BB BZ CA CR CU DM DO SV GD GT HT HN JM MX NI PA KN LC VC TT US PR'.split(' '),
  OC: 'AU FJ KI MH FM NR NZ PW PG WS SB TO TV VU NC PF'.split(' '),
  SA: 'AR BO BR CL CO EC GY PY PE SR UY VE'.split(' '),
};

export const ISO2_TO_CONTINENT: Record<string, ContinentCode> = (() => {
  const map: Record<string, ContinentCode> = {};
  for (const cont of CONTINENT_CODES) {
    for (const c of CONTINENT_TO_ISO2S[cont]) map[c] = cont;
  }
  return map;
})();

export function isContinentCode(t: string): t is ContinentCode {
  return t.length === 2 && t === t.toUpperCase() && (CONTINENT_CODES as readonly string[]).includes(t);
}

export function expandCountrySelection(tokens: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const t of tokens) {
    if (isContinentCode(t)) {
      for (const iso of CONTINENT_TO_ISO2S[t]) out.add(iso.toLowerCase());
    } else if (t) {
      out.add(t.toLowerCase());
    }
  }
  return out;
}

export function groupByContinent(iso2s: Iterable<string>): Array<{ continent: ContinentCode; iso2s: string[] }> {
  const buckets: Record<ContinentCode, string[]> = { AF: [], AS: [], EU: [], NA: [], OC: [], SA: [] };
  for (const raw of iso2s) {
    const upper = raw.toUpperCase();
    const cont = ISO2_TO_CONTINENT[upper];
    if (cont) buckets[cont].push(raw);
  }
  return CONTINENT_ORDER
    .filter(c => buckets[c].length > 0)
    .map(c => ({ continent: c, iso2s: buckets[c] }));
}
