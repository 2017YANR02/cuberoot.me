import { localizePlaceName } from './city_localize';
import { COUNTRY_EN, countryName } from './country-name';

const COUNTRY_ALIASES: Record<string, string> = {
  Andorra: 'AD', Andorran: 'AD', Bahrain: 'BH', Bangladesh: 'BD',
  Cambodia: 'KH', Canadian: 'CA', Croatian: 'HR', Cyprus: 'CY',
  Czech: 'CZ', Danish: 'DK', Dutch: 'NL', Egyptian: 'EG', Estonian: 'EE',
  Finnish: 'FI', French: 'FR', German: 'DE', Ghana: 'GH', Greek: 'GR',
  Guatemala: 'GT', Hungarian: 'HU', Indian: 'IN', Indonesian: 'ID',
  Irish: 'IE', Italian: 'IT', Japanese: 'JP', Korean: 'KR', Laos: 'LA',
  Latvian: 'LV', Malaysian: 'MY', Maltese: 'MT', Mexican: 'MX',
  Mongolia: 'MN', Mongolian: 'MN', Morocco: 'MA', Moroccan: 'MA',
  Nigeria: 'NG', Nigerian: 'NG', Norwegian: 'NO', Philippine: 'PH',
  Polish: 'PL', Romanian: 'RO', Serbian: 'RS', Slovak: 'SK', Spanish: 'ES',
  Swedish: 'SE', 'Costa Rican': 'CR', 'United Kingdom': 'GB', 'United States': 'US',
};

// The catalog uses these place names without the surrounding city/country field.
const PLACES_BY_COUNTRY: Record<string, string[]> = {
  AU: ['Australian Capital Territory', 'New South Wales', 'Northern Territory', 'Perth', 'Queensland',
    'South Australia', 'Sydney', 'Tasmania', 'Victoria', 'Western Australia'],
  BY: ['Minsk'],
  CA: ['British Columbia', 'Ontario'],
  CN: ['Fujian', 'Guangzhou'],
  CO: ['Bogotá'],
  EC: ['Guayaquil'],
  GR: ['Athens'],
  IN: ['Bengaluru', 'Karnataka', 'Maharashtra', 'Raipur', 'Telangana'],
  KR: ['Busan', 'Cheonan', 'Seoul', 'Suwon'],
  RU: ['Saint Petersburg'],
  US: ['Alabama', 'Arizona', 'Arkansas', 'Austin', 'Colorado', 'Connecticut', 'Davis',
    'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
    'Long Island City', 'Los Angeles', 'Louisiana', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
    'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'North Carolina', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Reno', 'Santa Clara', 'Texas', 'Urbandale', 'Utah', 'Virginia',
    'Wisconsin'],
  VN: ['Hanoi'],
};

const PLACE_ALIASES: Record<string, string> = {
  ACT: 'Australian Capital Territory', BC: 'British Columbia', NSW: 'New South Wales',
  NT: 'Northern Territory', QLD: 'Queensland', SA: 'South Australia', TAS: 'Tasmania',
  VIC: 'Victoria', WA: 'Western Australia', SPB: 'Saint Petersburg',
  Bangalore: 'Bengaluru', 'Ha Noi': 'Hanoi',
};

const TITLE_TERMS: Record<string, string> = {
  Championship: '锦标赛', Championships: '锦标赛', 'Championship FMC': '最少步锦标赛',
  'Cube Championship': '锦标赛', 'Cubing Championship': '锦标赛', 'Puzzle Championship': '益智锦标赛',
  'Rubik’s Cube': '鲁比克', "Rubik's Cube": '鲁比克',
  "Rubik's Games": '鲁比克', 'Rubik’s Games': '鲁比克',
  "Rubik's": '鲁比克', 'Rubik’s': '鲁比克', MoYu: '魔域',
  WCA: '', Speedcubing: '速拧', 'Speed Cubing': '速拧',
  World: '世界', European: '欧洲', Asian: '亚洲', African: '非洲', Oceanic: '大洋洲',
  'North American': '北美', 'South American': '南美', Nordic: '北欧', Iberian: '伊比利亚',
  'Hong Kong': '香港', Taiwan: '台湾', Taiwanese: '台湾', Scottish: '苏格兰',
  Lisboa: '里斯本', Borneo: '婆罗洲', Celebes: '苏拉威西',
  Visayas: '维萨亚斯', Mindanao: '棉兰老岛', Luzon: '吕宋',
  'South Luzon': '南吕宋', 'North Luzon': '北吕宋', 'Central Luzon': '中吕宋',
  'West Visayas': '西维萨亚斯', 'Central Visayas': '中维萨亚斯',
  'Manila Metropolitan': '马尼拉都会区', 'South India': '南印度',
  'NZ North Island': '新西兰北岛', 'NZ South Island': '新西兰南岛',
  'Canadian Prairie': '加拿大草原地区', 'New England': '新英格兰', 'Rocky Mountain': '落基山',
  'Great Lakes': '五大湖', Heartland: '中部', 'Mid-Atlantic': '大西洋中部',
  'Tri-State': '三州', DFW: '达拉斯—沃思堡', 'LA Quiet': '路易斯安那州安静',
  'New York': '纽约', Washington: '华盛顿州',
  Southeast: '东南部', Northeast: '东北部', Northwest: '西北部', Southern: '南部', Western: '西部',
  National: '全国', Open: '公开', 'State Championship': '锦标赛',
  FMC: '最少步', 'Fewest Moves': '最少步', 'Multi-Blind': '多盲', Blindfolded: '盲拧',
  Quiet: '安静', 'Big and Quiet': '大阶与安静项目', Side: '副项', Elite: '精英',
  'Championship Mini': '迷你锦标赛', Qualifier: '资格赛', Fall: '秋季',
  Marathon: '马拉松', Sprint: '短程', 'Blind Off': '盲拧对决',
  'Welcome Back Mongolia': '蒙古回归', 'Pre-Championship Athens': '雅典锦标赛热身赛',
  '10th Anniversary': '十周年', '15th Anniversary': '十五周年', "China's": '中国',
};

const termsZh = new Map<string, string>();
for (const [iso2, name] of Object.entries(COUNTRY_EN)) {
  if (!iso2.startsWith('X')) termsZh.set(name.toLowerCase(), countryName(iso2, true));
}
for (const [name, iso2] of Object.entries(COUNTRY_ALIASES)) {
  termsZh.set(name.toLowerCase(), countryName(iso2, true));
}
for (const [iso2, names] of Object.entries(PLACES_BY_COUNTRY)) {
  for (const name of names) termsZh.set(name.toLowerCase(), localizePlaceName(name, iso2));
}
for (const [alias, name] of Object.entries(PLACE_ALIASES)) {
  const localized = termsZh.get(name.toLowerCase());
  if (localized) termsZh.set(alias.toLowerCase(), localized);
}
for (const [term, zh] of Object.entries(TITLE_TERMS)) termsZh.set(term.toLowerCase(), zh);

const titleTermsPattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${[...termsZh.keys()]
  .sort((a, b) => b.length - a.length)
  .map(term => term.replace(/[.*+?^$${}()|[\]\\]/g, '\\$&'))
  .join('|')})(?![\\p{L}\\p{N}])`, 'giu');

export const CHAMPIONSHIP_RE = /\bchampionships?\b/i;

export function localizeChampionshipNameZh(name: string): string {
  return name
    .replace(/^FMC (.+?) (Championships?\b)/i, '$1 FMC $2')
    .replace(titleTermsPattern, (_, boundary: string, term: string) => boundary + (termsZh.get(term.toLowerCase()) ?? term))
    .replace(/\s+/g, ' ')
    .replace(/([\u3400-\u9fff]) (?=[\u3400-\u9fff]|\d{4}$)/g, '$1')
    .trim();
}
