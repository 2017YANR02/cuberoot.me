/**
 * WCA country names and ISO 3166-1 alpha-2 identifiers share one normalization
 * table across Web and native hosts. Rendering belongs in a React package; this
 * module deliberately stays runtime-neutral.
 */

export const WCA_COUNTRY_TO_ISO2: Readonly<Record<string, string>> = {
  'Multiple Countries': '',
  'Multiple Countries (World)': '', 'Multiple Countries (Africa)': '',
  'Multiple Countries (Americas)': '', 'Multiple Countries (North America)': '',
  'Multiple Countries (South America)': '', 'Multiple Countries (Asia)': '',
  'Multiple Countries (Europe)': '', 'Multiple Countries (Oceania)': '',
  'XK': 'xk',

  // Africa
  'Algeria': 'dz', 'Angola': 'ao', 'Benin': 'bj', 'Botswana': 'bw',
  'Burkina Faso': 'bf', 'Burundi': 'bi', 'Cabo Verde': 'cv', 'Cameroon': 'cm',
  'Central African Republic': 'cf', 'Chad': 'td', 'Comoros': 'km',
  'Congo': 'cg', "Côte d'Ivoire": 'ci', 'Cote d_Ivoire': 'ci', 'Democratic Republic of the Congo': 'cd',
  'Djibouti': 'dj', 'Egypt': 'eg', 'Equatorial Guinea': 'gq', 'Eritrea': 'er',
  'Eswatini': 'sz', 'Ethiopia': 'et', 'Gabon': 'ga', 'Gambia': 'gm',
  'Ghana': 'gh', 'Guinea': 'gn', 'Guinea-Bissau': 'gw', 'Ivory Coast': 'ci',
  'Kenya': 'ke', 'Lesotho': 'ls', 'Liberia': 'lr', 'Libya': 'ly',
  'Madagascar': 'mg', 'Malawi': 'mw', 'Mali': 'ml', 'Mauritania': 'mr',
  'Mauritius': 'mu', 'Morocco': 'ma', 'Mozambique': 'mz', 'Namibia': 'na',
  'Niger': 'ne', 'Nigeria': 'ng', 'Rwanda': 'rw',
  'São Tomé and Príncipe': 'st', 'Senegal': 'sn', 'Seychelles': 'sc',
  'Sierra Leone': 'sl', 'Somalia': 'so', 'South Africa': 'za', 'South Sudan': 'ss',
  'Sudan': 'sd', 'Tanzania': 'tz', 'Togo': 'tg', 'Tunisia': 'tn',
  'Uganda': 'ug', 'Zambia': 'zm', 'Zimbabwe': 'zw',

  // Americas
  'Antigua and Barbuda': 'ag', 'Argentina': 'ar', 'Bahamas': 'bs',
  'Barbados': 'bb', 'Belize': 'bz', 'Bolivia': 'bo', 'Brazil': 'br',
  'Canada': 'ca', 'Chile': 'cl', 'Colombia': 'co', 'Costa Rica': 'cr',
  'Cuba': 'cu', 'Dominica': 'dm', 'Dominican Republic': 'do', 'Ecuador': 'ec',
  'El Salvador': 'sv', 'Grenada': 'gd', 'Guatemala': 'gt', 'Guyana': 'gy',
  'Haiti': 'ht', 'Honduras': 'hn', 'Jamaica': 'jm', 'Mexico': 'mx',
  'Nicaragua': 'ni', 'Panama': 'pa', 'Paraguay': 'py', 'Peru': 'pe',
  'Saint Kitts and Nevis': 'kn', 'Saint Lucia': 'lc',
  'Saint Vincent and the Grenadines': 'vc', 'Suriname': 'sr',
  'Trinidad and Tobago': 'tt', 'United States': 'us', 'USA': 'us',
  'Uruguay': 'uy', 'Venezuela': 've',

  // Asia
  'Afghanistan': 'af', 'Armenia': 'am', 'Azerbaijan': 'az', 'Bahrain': 'bh',
  'Bangladesh': 'bd', 'Bhutan': 'bt', 'Brunei': 'bn', 'Cambodia': 'kh',
  'China': 'cn', 'Cyprus': 'cy', 'East Timor': 'tl', 'Georgia': 'ge',
  'Hong Kong': 'hk', 'Hong Kong, China': 'hk', 'India': 'in', 'Indonesia': 'id', 'Iran': 'ir',
  'Iraq': 'iq', 'Israel': 'il', 'Japan': 'jp', 'Jordan': 'jo',
  'Kazakhstan': 'kz', 'Korea': 'kr', 'Kuwait': 'kw', 'Kyrgyzstan': 'kg',
  'Laos': 'la', 'Lebanon': 'lb', 'Macau': 'mo', 'Macau, China': 'mo', 'Malaysia': 'my',
  'Maldives': 'mv', 'Mongolia': 'mn', 'Myanmar': 'mm', 'Nepal': 'np',
  'North Korea': 'kp', 'Oman': 'om', 'Pakistan': 'pk', 'Palestine': 'ps',
  'Philippines': 'ph', 'Qatar': 'qa', 'Saudi Arabia': 'sa', 'Singapore': 'sg',
  'South Korea': 'kr', 'Republic of Korea': 'kr',
  'Sri Lanka': 'lk', 'Syria': 'sy', 'Chinese Taipei': 'tw', 'Taiwan': 'tw',
  'Tajikistan': 'tj', 'Thailand': 'th', 'Timor-Leste': 'tl',
  'Turkey': 'tr', 'Turkmenistan': 'tm',
  'United Arab Emirates': 'ae', 'Uzbekistan': 'uz', 'Vietnam': 'vn', 'Yemen': 'ye',

  // Europe
  'Albania': 'al', 'Andorra': 'ad', 'Austria': 'at', 'Belarus': 'by',
  'Belgium': 'be', 'Bosnia and Herzegovina': 'ba', 'Bulgaria': 'bg',
  'Croatia': 'hr', 'Czech Republic': 'cz', 'Czechia': 'cz',
  'Denmark': 'dk', 'Estonia': 'ee', 'Finland': 'fi', 'France': 'fr',
  'Germany': 'de', 'Greece': 'gr', 'Hungary': 'hu', 'Iceland': 'is',
  'Ireland': 'ie', 'Italy': 'it', 'Kosovo': 'xk', 'Latvia': 'lv',
  'Liechtenstein': 'li', 'Lithuania': 'lt', 'Luxembourg': 'lu',
  'Malta': 'mt', 'Moldova': 'md', 'Monaco': 'mc', 'Montenegro': 'me',
  'Netherlands': 'nl', 'North Macedonia': 'mk', 'Norway': 'no',
  'Poland': 'pl', 'Portugal': 'pt', 'Romania': 'ro', 'Russia': 'ru',
  'San Marino': 'sm', 'Serbia': 'rs', 'Slovakia': 'sk', 'Slovenia': 'si',
  'Spain': 'es', 'Sweden': 'se', 'Switzerland': 'ch',
  'Ukraine': 'ua', 'United Kingdom': 'gb',

  // Oceania
  'Australia': 'au', 'Fiji': 'fj', 'Kiribati': 'ki',
  'Marshall Islands': 'mh', 'Micronesia': 'fm', 'Nauru': 'nr',
  'New Zealand': 'nz', 'Palau': 'pw', 'Papua New Guinea': 'pg',
  'Samoa': 'ws', 'Solomon Islands': 'sb', 'Tonga': 'to',
  'Tuvalu': 'tv', 'Vanuatu': 'vu',
};

const ISO2_RE = /^[a-z]{2}$/i;

/** Accept either a two-letter identifier or a canonical WCA country name. */
export function countryToIso2(countryOrIso2: string): string {
  const value = countryOrIso2.trim();
  if (ISO2_RE.test(value)) return value.toLowerCase();
  return WCA_COUNTRY_TO_ISO2[value] ?? '';
}

const ISO2_TO_CANONICAL_NAME: Readonly<Record<string, string>> = (() => {
  const out: Record<string, string> = {};
  for (const [name, iso2] of Object.entries(WCA_COUNTRY_TO_ISO2)) {
    if (iso2 && !(iso2 in out)) out[iso2] = name;
  }
  return out;
})();

export function iso2ToCountryName(iso2: string): string {
  const code = countryToIso2(iso2);
  return ISO2_TO_CANONICAL_NAME[code] ?? iso2.trim().toUpperCase();
}

export function canonicalCountryNamesByIso2(): Readonly<Record<string, string>> {
  return ISO2_TO_CANONICAL_NAME;
}
