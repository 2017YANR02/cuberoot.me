/** Conservative static-library classification. Rules preserve the prior reviewed order. */
import { parse } from 'node:path';
import { nonempty } from './music-shared.js';

export interface ClassifiedRecord { relativePath: string; title?: string | null; artist?: string | null; album?: string | null; genre?: string | null }
export type CategoryId = 'film-tv-soundtrack' | 'sound-effects' | 'jazz' | 'piano-classical' | 'electronic' | 'ambient-instrumental' | 'pop-rock' | 'bgm-assets' | 'unclassified';
export interface Category { id: CategoryId; source: 'embedded-genre' | 'explicit-top-directory' | 'metadata-keywords' | 'none' }
export const TAXONOMY: Array<{ id: CategoryId; labelZh: string }> = [
  { id: 'piano-classical', labelZh: '钢琴与古典' }, { id: 'jazz', labelZh: '爵士' },
  { id: 'film-tv-soundtrack', labelZh: '影视原声' }, { id: 'electronic', labelZh: '电子' },
  { id: 'pop-rock', labelZh: '流行与摇滚' }, { id: 'bgm-assets', labelZh: 'BGM与素材' },
  { id: 'sound-effects', labelZh: '音效' }, { id: 'ambient-instrumental', labelZh: '轻音乐与纯音乐' },
  { id: 'unclassified', labelZh: '未分类' },
];
export function normalized(value: string | null | undefined): string {
  return (value ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}
export function conservativeArtist(record: ClassifiedRecord): string | undefined {
  const artist = nonempty(record.artist);
  return artist && !['unknown', 'unknown artist', '<unknown>', '未知艺术家', '未知歌手'].includes(artist.toLowerCase()) ? artist : undefined;
}
function trackNumberFree(value: string): string { return value.replace(/^\s*\d{1,3}\s*(?:[-._、．]\s*|\s+)/, ''); }
function artistPrefixFree(value: string, artist: string | undefined): string {
  const key = normalized(artist);
  if (!key) return value;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return value.replace(new RegExp(`^${escaped}\\s*(?:-|–|—|_|－)\\s*`), '');
}
export function exactLyricsTitleMatch(lyricsRelative: string, media: ClassifiedRecord): boolean {
  const artist = conservativeArtist(media);
  const lyricsStem = parse(lyricsRelative.replaceAll('\\', '/')).name;
  const lyricsKey = artistPrefixFree(normalized(trackNumberFree(lyricsStem)), artist);
  if (!lyricsKey) return false;
  const mediaStem = parse(media.relativePath.replaceAll('\\', '/')).name;
  return [nonempty(media.title), mediaStem].some(candidate => candidate && artistPrefixFree(normalized(trackNumberFree(candidate)), artist) === lyricsKey);
}

const genreRules: Array<[CategoryId, RegExp]> = [
  ['film-tv-soundtrack', /soundtrack|original\s+score|film\s+score|影视原声|电影原声|原声/i],
  ['sound-effects', /sound\s*effects?|\bsfx\b|音效/i],
  ['jazz', /jazz|爵士/i],
  ['piano-classical', /classical|piano|nocturne|古典|钢琴/i],
  ['electronic', /electronic|electronica|\bedm\b|trance|\bdance\b|house|dubstep|电音|电子/i],
  ['ambient-instrumental', /new\s+age|ambient|instrumental|轻音乐|纯音乐|舒缓/i],
  ['pop-rock', /\bpop\b|\brock\b|\bblues\b|流行|摇滚/i],
  ['bgm-assets', /\bbgm\b|background\s+music|cinematic|\bepic\b|royalty\s+free|音乐素材|素材/i],
];
const keywordRules: Array<[CategoryId, RegExp]> = [
  ['film-tv-soundtrack', /soundtrack|original\s+score|film\s+score|movie\s+score|影视原声|电影原声|原声带|配乐|hans\s+zimmer|汉斯.?季默|饥饿游戏.*插曲|just blue.*动物世界|fate stay night|always with me.*宫崎骏|my heart will go on.*titanic|世界杯主题曲|cctv.*动物世界片尾曲|霍比特人3.*插曲|henry jackman|金手指.*007|中国合伙人.*主题曲|he's a pirate|for your eyes only|the crave.*ennio morricone|la valse.*am[eé]lie|星球大战|风之甬道|久石让|超级马里奥|哪吒之魔童闹海.*电影角色曲/i],
  ['piano-classical', /classical|piano|symphony|concerto|sonata|nocturne|etude|prelude|chopin|mozart|beethoven|bach|debussy|liszt|rachmaninoff|vivaldi|tchaikovsky|古典|钢琴|交响|协奏曲|奏鸣曲|夜曲|练习曲|前奏曲|肖邦|莫扎特|贝多芬|巴赫|德彪西|李斯特|拉赫玛尼诺夫|维瓦尔第|柴可夫斯基|郎朗|理查德.?克莱德曼|richard\s+clayderman|李闰珉|tarrega|recuerdos de la alhambra|四小天鹅舞曲|马斯涅|maksim|schubert|josef hofmann|约翰施特劳斯|悲怆|robert schumann|李云迪|管风琴|王羽佳|stravinsky|simple gifts.*choirboys|wiener johann strauss|行星组曲|勃拉姆斯|hungarian dances|曼托瓦尼/i],
  ['electronic', /electronic|electronica|\bedm\b|deep\s+house|house\s+music|trance|dubstep|synthwave|techno|remix|电音|电子|shogun taira|advent - last mistake|bionic souls|david guetta|embody - lost & found|gabry ponte|hotel saint george|jim yosef|john de sohn|kamro|karkaz|klaas|lizot|tom swoon|groove coverage|loreen|\baqua\b|vinai|william black.*fairlane|cascada|universe in my head/i],
  ['ambient-instrumental', /ambient|instrumental|new\s+age|relax(?:ing|ation)?|轻音乐|纯音乐|舒缓|calm music.*sappheiros|secret garden|茉莉花.*萨克斯|flower dance.*dj.?okawari/i],
  ['pop-rock', /周杰伦|jay\s+chou|linkin\s+park|michael\s+jackson|迈克尔.?杰克逊|green\s+day|richard\s+marx|张韶涵|leona\s+lewis|\bm2m\b|汪峰|the\s+beatles|backstreet\s+boys|westlife|bon\s+jovi|\busher\b|charlotte lawrence|ed sheeran|bruno mars|ycccc|苟一一/i],
  ['bgm-assets', /carlos estella|epic happy inspiring orchestral|sergepavkinmusic|two steps from hell|thomas bergersen/i],
];
const popArtists = new Set(`talor swift|talyor swift|taylor swift|blue|carpenters|emilia|timbaland|coldplay|maria arredondo|tamas wells|sarah connor|水木年华|jason mraz|birdy|helene|rihanna|sting|amy diamond|jason donovan|费翔|atomic kitten|林肯公园|trademark|t.i|whitney houston|bastille|the workday release|gareth gates|michael learns to rock|g.e.m.邓紫棋|simple plan|robbie williams|muse|a-ha|leo sayer|eagles|simon & garfunkel|michael bolton|avril lavigne|bryan adams|shayne ward|fools garden|shirley bassey|许嵩|黄晓明&邓超&佟大为|eric clapton|blackmore's night|屠洪刚|the cranberries|beyond|jesse mccartney|britney spears|mariah carey|deutschland sucht den superstar`.split('|'));
export function conservativeCategory(record: ClassifiedRecord): Category {
  const genre = nonempty(record.genre)?.toLowerCase();
  if (genre) for (const [id, regex] of genreRules) if (regex.test(genre)) return { id, source: 'embedded-genre' };
  const parts = record.relativePath.split(/[\\/]/);
  const top = parts.length > 1 ? parts[0].trim() : '';
  if (top === 'Kenny G') return { id: 'jazz', source: 'explicit-top-directory' };
  if (top === 'piano') return { id: 'piano-classical', source: 'explicit-top-directory' };
  if (/^周杰伦.*钢琴伴奏$/.test(top)) return { id: 'pop-rock', source: 'explicit-top-directory' };
  if (/不能说的秘密.*原声/.test(top)) return { id: 'film-tv-soundtrack', source: 'explicit-top-directory' };
  if (['BGM', 'Savfk', 'epic', 'No Copyright Music', 'Royalty Free Music', '音乐素材', 'NCS'].includes(top)) return { id: 'bgm-assets', source: 'explicit-top-directory' };
  if (['电音', 'Alan Walker', 'MitiS', 'ILLENIUM', 'Avicii'].includes(top)) return { id: 'electronic', source: 'explicit-top-directory' };
  if (top === '音效') return { id: 'sound-effects', source: 'explicit-top-directory' };
  const artist = conservativeArtist(record);
  const text = normalized([record.title, artist, record.album, record.relativePath].filter(Boolean).join(' '));
  for (const [id, regex] of keywordRules.slice(0, 4)) if (regex.test(text)) return { id, source: 'metadata-keywords' };
  if (popArtists.has(normalized(artist)) || keywordRules[4][1].test(text)) return { id: 'pop-rock', source: 'metadata-keywords' };
  if (keywordRules[5][1].test(text)) return { id: 'bgm-assets', source: 'metadata-keywords' };
  return { id: 'unclassified', source: 'none' };
}
