// 比赛城市「对外展示」:用户填的城市可能是中文(非 WCA 比赛自填)。
//   /zh:原样显示中文。
//   /en:中文城市名转拼音(WCA 习惯:首字母大写,音节间遇 a/o/e 起首插 ' 分隔,如 Xi'an / Hai'an);
//        已是拉丁字母的原样返回。
// NOTE: pinyin-pro 体积不小,本模块只给 recon 详情页 import,别从首页 / 卡片引入。
import { pinyin } from 'pinyin-pro';

const CJK_RE = /[㐀-鿿豈-﫿]/;

export function cityToPinyin(city: string): string {
  const syl = pinyin(city, { toneType: 'none', type: 'array', nonZh: 'consecutive' }) as string[];
  let s = '';
  for (let i = 0; i < syl.length; i++) {
    if (i > 0 && /^[aoe]/i.test(syl[i])) s += "'";
    s += syl[i];
  }
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : city;
}

export function displayCity(city: string | undefined | null, isZh: boolean): string {
  if (!city) return '';
  if (isZh) return city;
  return CJK_RE.test(city) ? cityToPinyin(city) : city;
}
