const RAW: Record<string, string> = {
  'argentina': 'AR', 'australia': 'AU', 'austria': 'AT', 'belgium': 'BE',
  'belarus': 'BY', 'bolivia': 'BO', 'brazil': 'BR', 'bulgaria': 'BG',
  'canada': 'CA', 'chile': 'CL', 'china': 'CN', 'chinese taipei': 'TW',
  'colombia': 'CO', 'costa rica': 'CR', 'croatia': 'HR', 'cuba': 'CU',
  'cyprus': 'CY', 'czech republic': 'CZ', 'czechia': 'CZ', 'denmark': 'DK',
  'dominican republic': 'DO', 'ecuador': 'EC', 'egypt': 'EG', 'estonia': 'EE',
  'finland': 'FI', 'france': 'FR', 'georgia': 'GE', 'germany': 'DE',
  'greece': 'GR', 'guatemala': 'GT', 'hong kong': 'HK', 'hong kong, china': 'HK',
  'hungary': 'HU', 'iceland': 'IS', 'india': 'IN', 'indonesia': 'ID',
  'iran': 'IR', 'ireland': 'IE', 'israel': 'IL', 'italy': 'IT',
  'japan': 'JP', 'jordan': 'JO', 'kazakhstan': 'KZ', 'kenya': 'KE',
  'korea': 'KR', 'south korea': 'KR', 'republic of korea': 'KR',
  'kuwait': 'KW', 'latvia': 'LV',
  'lebanon': 'LB', 'lithuania': 'LT', 'luxembourg': 'LU', 'macau': 'MO',
  'macao': 'MO', 'macau, china': 'MO', 'malaysia': 'MY', 'malta': 'MT',
  'mexico': 'MX', 'moldova': 'MD', 'mongolia': 'MN', 'morocco': 'MA',
  'nepal': 'NP', 'netherlands': 'NL', 'new zealand': 'NZ', 'nicaragua': 'NI',
  'nigeria': 'NG', 'norway': 'NO', 'pakistan': 'PK', 'panama': 'PA',
  'paraguay': 'PY', 'peru': 'PE', 'philippines': 'PH', 'poland': 'PL',
  'portugal': 'PT', 'puerto rico': 'PR', 'qatar': 'QA', 'romania': 'RO',
  'russia': 'RU', 'russian federation': 'RU', 'saudi arabia': 'SA',
  'serbia': 'RS', 'singapore': 'SG', 'slovakia': 'SK', 'slovenia': 'SI',
  'south africa': 'ZA', 'spain': 'ES', 'sri lanka': 'LK', 'sweden': 'SE',
  'switzerland': 'CH', 'taiwan': 'TW', 'thailand': 'TH', 'turkey': 'TR',
  'tunisia': 'TN', 'ukraine': 'UA', 'united arab emirates': 'AE', 'uae': 'AE',
  'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB',
  'united states': 'US', 'usa': 'US', 'united states of america': 'US',
  'uruguay': 'UY', 'venezuela': 'VE', 'vietnam': 'VN', 'viet nam': 'VN',
  // Common typos / aliases
  'unites states': 'US', 'the netherlands': 'NL', 'phillippines': 'PH',
  'philipines': 'PH', 'taipei': 'TW',
};

export function countryToIso2(name: string): string | null {
  if (!name) return null;
  const key = name.trim().toLowerCase().replace(/\s+/g, ' ');
  return RAW[key] ?? null;
}
