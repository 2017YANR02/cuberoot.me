// WCA 比赛城市名本地化(/zh 显示中文)。单一入口 localizeCity / localizeCityName。
// 分层:大中华区(CN/HK/MO/TW)逐段查 CN_PLACE_ZH;其它国家逐段查生成的全球字典
// (PLACE_CITY_ZH 城市段 + PLACE_ADMIN_ZH 行政区段,key=`${ISO2}:${normSeg}`,来源见
// scripts/gen-place-zh.mjs:GeoNames exonym + OpenCC + LLM 兜底);两路都再回退手维护 CITY_ZH;最后原文。

import { CN_PLACE_ZH } from '@/lib/data/cn-region';
import { PLACE_CITY_ZH, PLACE_ADMIN_ZH } from '@/lib/data/place-zh';

// 手维护补充表(覆盖层 / 无 iso2 调用时的兜底 / 台湾等 CN_PLACE_ZH 未覆盖处)。
const CITY_ZH: Record<string, string> = {
  'Beijing': '北京', 'Shanghai': '上海', 'Tianjin': '天津', 'Chongqing': '重庆',
  'Hong Kong': '香港', 'Macau': '澳门', 'Macao': '澳门',
  'Anyang': '安阳', 'Baoji': '宝鸡', 'Changchun': '长春', 'ChangChun': '长春',
  'Changsha': '长沙', 'Changzhou': '常州', 'Chaozhou': '潮州', 'Chengdu': '成都',
  'Chifeng': '赤峰', 'Dalian': '大连', 'Dandong': '丹东', 'Dongguan': '东莞',
  'Ezhou': '鄂州', 'Foshan': '佛山', 'Fushun': '抚顺', 'Fuzhou': '福州',
  'Guangzhou': '广州', 'Guilin': '桂林', 'Guiyang': '贵阳', 'Haikou': '海口',
  'Hangzhou': '杭州', 'Harbin': '哈尔滨', 'Hefei': '合肥', 'Hengyang': '衡阳', 'Huanggang': '黄冈',
  'Heze': '菏泽', 'Hohhot': '呼和浩特', 'Huaibei': '淮北', 'Huizhou': '惠州',
  'Huzhou': '湖州', 'Jiangmen': '江门', 'Jiaozuo': '焦作', 'Jiaxing': '嘉兴',
  'Jieyang': '揭阳', 'Jinan': '济南', 'Jinhua': '金华', 'Jiujiang': '九江',
  'Kaifeng': '开封', 'Kunming': '昆明', 'Lanzhou': '兰州', 'Leshan': '乐山', 'Lhasa': '拉萨',
  'Linfen': '临汾', 'Linyi': '临沂', 'Lishui': '丽水', 'Liuzhou': '柳州',
  'Longyan': '龙岩', 'Luoyang': '洛阳', 'Maoming': '茂名', 'Meizhou': '梅州',
  'Mianyang': '绵阳', 'Mudanjiang': '牡丹江', 'Nanchang': '南昌', 'Nanjing': '南京',
  'Nanning': '南宁', 'Nantong': '南通', 'Ningbo': '宁波', 'Ordos': '鄂尔多斯',
  'Qianjiang': '潜江', 'Qingdao': '青岛', 'Qinhuangdao': '秦皇岛', 'Qinzhou': '钦州',
  'Quanzhou': '泉州', 'Sanya': '三亚', 'Shantou': '汕头', 'Shaoxing': '绍兴',
  'Shenyang': '沈阳', 'Shenzhen': '深圳', 'Shijiazhuang': '石家庄', 'Suzhou': '苏州',
  'Taiyuan': '太原', 'Taizhou': '台州', 'Tangshan': '唐山', 'Urumqi': '乌鲁木齐',
  'Weifang': '潍坊', 'Weihai': '威海', 'Wenzhou': '温州', 'Wuhan': '武汉',
  'Wuhu': '芜湖', 'Wuxi': '无锡', "Xi'an": '西安', 'Xian': '西安',
  'Xiamen': '厦门', 'Xianyang': '咸阳', 'Xinxiang': '新乡', 'Xining': '西宁',
  'Xuchang': '许昌', 'Xuzhou': '徐州', 'Yancheng': '盐城', 'Yangjiang': '阳江',
  'Yangzhou': '扬州', 'Yantai': '烟台', 'Yichang': '宜昌', 'Yinchuan': '银川',
  'Yingkou': '营口', 'Zhangzhou': '漳州', 'Zhanjiang': '湛江', 'Zhengzhou': '郑州',
  'Zhenjiang': '镇江', 'Zhongshan': '中山', 'Zhuhai': '珠海', 'Zibo': '淄博',
  'Zunyi': '遵义',
  'Multiple Cities': '多地', 'Multiple cities': '多地', 'Multiple cities in China': '中国多地',
  'Chia-yi': '嘉义', 'Chiayi': '嘉义', 'Hsinchu': '新竹', 'Hualien': '花莲',
  'Kaohsiung': '高雄', 'Lienchiang': '连江', 'New Taipei': '新北', 'Penghu': '澎湖',
  'Pingtung': '屏东', 'Taichung': '台中', 'Tainan': '台南', 'Taipei': '台北',
  'Taitung': '台东', 'Taoyuan': '桃园', 'Yilan': '宜兰', 'Yunlin': '云林',
  'Tokyo': '东京', 'Osaka': '大阪', 'Kyoto': '京都', 'Nagoya': '名古屋',
  'Yokohama': '横滨', 'Sapporo': '札幌', 'Fukuoka': '福冈', 'Kobe': '神户',
  'Seoul': '首尔', 'Busan': '釜山', 'Incheon': '仁川',
  'Singapore': '新加坡', 'Bangkok': '曼谷', 'Kuala Lumpur': '吉隆坡',
  'New York': '纽约', 'Los Angeles': '洛杉矶', 'San Francisco': '旧金山',
  'Chicago': '芝加哥', 'Boston': '波士顿', 'Seattle': '西雅图',
  'London': '伦敦', 'Paris': '巴黎', 'Berlin': '柏林', 'Munich': '慕尼黑',
  'Rome': '罗马', 'Madrid': '马德里', 'Barcelona': '巴塞罗那',
  'Amsterdam': '阿姆斯特丹', 'Brussels': '布鲁塞尔', 'Vienna': '维也纳',
  'Moscow': '莫斯科', 'Sydney': '悉尼', 'Melbourne': '墨尔本',
  'Toronto': '多伦多', 'Vancouver': '温哥华', 'Montreal': '蒙特利尔',
  'São Paulo': '圣保罗', 'Sao Paulo': '圣保罗',
  'Las Vegas': '拉斯维加斯', 'Lake Buena Vista': '布埃纳维斯塔湖',
  'Düsseldorf': '杜塞尔多夫', 'Dusseldorf': '杜塞尔多夫', 'Budapest': '布达佩斯',
};

const GREATER_CN = new Set(['CN', 'HK', 'MO', 'TW']);

// 段归一化(去音标 + 小写 + 去非字母数字),必须与 gen-place-zh.mjs 的 norm 完全一致。
function normSeg(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}
// 大中华区旧表(CN_PLACE_ZH)的 key 归一化(无去音标,拼音无音标)。
const cnNorm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

export function normalizeCityKey(city: string): string {
  let s = city.split(/,\s*/)[0].trim();
  const paren = s.match(/\(([^)]+)\)\s*$/);
  if (paren && /[A-Za-z]/.test(paren[1])) return paren[1].trim();
  s = s.replace(/\s+\d+$/, '');
  s = s.replace(/\s+City$/i, '');
  return s.trim();
}

// 单段译:第 1 段=城市,其余=行政区。生成字典(按国家 scope)优先,再回退手维护表。
function translateSeg(seg: string, idx: number, I: string): string {
  const k = `${I}:${normSeg(seg)}`;
  const gen = idx === 0 ? PLACE_CITY_ZH[k] : (PLACE_ADMIN_ZH[k] ?? PLACE_CITY_ZH[k]);
  return gen ?? CITY_ZH[normalizeCityKey(seg)] ?? seg;
}

// 中文模式下把整个城市串逐段译成简体(逗号分隔)。
function localizePlaceZh(city: string, iso2?: string | null): string {
  const segs = city.split(',').map((s) => s.trim()).filter(Boolean);
  if (!segs.length) return city;
  const I = (iso2 || '').toUpperCase();
  if (GREATER_CN.has(I)) {
    // 大中华区:CN_PLACE_ZH(cubingchina 全量)优先,缺则回退生成字典 / 手维护(覆盖台湾等)。
    return segs.map((seg, idx) => CN_PLACE_ZH[cnNorm(seg)] ?? translateSeg(seg, idx, I)).join(', ');
  }
  return segs.map((seg, idx) => translateSeg(seg, idx, I)).join(', ');
}

/** 比赛城市名本地化。isZh=false 返回英文(已知城市规整去后缀);isZh=true 全段译中文。
 *  传 iso2 才能用全球字典(按国家 scope);不传仍可命中手维护表与大中华区无 scope 段。 */
export function localizeCity(city: string, isZh: boolean, iso2?: string | null): string {
  if (!city) return '';
  if (!isZh) {
    const key = normalizeCityKey(city);
    return CITY_ZH[key] ? key : city;
  }
  return localizePlaceZh(city, iso2);
}
