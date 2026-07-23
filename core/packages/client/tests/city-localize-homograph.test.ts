// 回归守卫:同拼音异地中国城市,/zh 下须靠比赛城市串里的省份段选对中文名与所属省份。
// 背景:cubingchina 拼音字典 CN_PLACE_ZH / CN_PLACE_PROVINCE 每个拼音只存一个,碰撞城市
// (台州/泰州、苏州/宿州…)另一个被静默丢弃;修复靠生成器额外产出 CN_PLACE_DISAMBIG,
// 消费端(city-localize 城市名、person-misc-region 去过的省份)拿省份段消歧。
// 碰撞清单数据驱动:scripts/gen-cn-region.mjs 扫 data.sql 自动收录,新碰撞重跑即入表。
import { describe, it, expect } from 'vitest';
import { localizeCityName } from '@/lib/cn-city-name';
import { buildRegionStats } from '@/components/persons/logic/person-misc-region';
import type { WcaCompetition } from '@/lib/wca-person-api';

// [城市串, 期望中文城市名, 期望「去过的省份」label]
const CASES: Array<[string, string, string]> = [
  ['Taizhou, Zhejiang', '台州, 浙江', '中国浙江'],
  ['Taizhou, Jiangsu', '泰州, 江苏', '中国江苏'],
  ['Suzhou, Jiangsu', '苏州, 江苏', '中国江苏'],
  ['Suzhou, Anhui', '宿州, 安徽', '中国安徽'],
  ['Fuzhou, Fujian', '福州, 福建', '中国福建'],
  ['Fuzhou, Jiangxi', '抚州, 江西', '中国江西'],
  ['Yulin, Guangxi', '玉林, 广西', '中国广西'],
  ['Yulin, Shaanxi', '榆林, 陕西', '中国陕西'],
  ['Yichun, Heilongjiang', '伊春, 黑龙江', '中国黑龙江'],
  ['Yichun, Jiangxi', '宜春, 江西', '中国江西'],
  ['Baoshan, Shanghai', '宝山, 上海', '中国上海'],
  ['Baoshan, Yunnan', '保山, 云南', '中国云南'],
  ['Qianjiang, Hubei', '潜江, 湖北', '中国湖北'],
  ['Qianjiang, Chongqing', '黔江, 重庆', '中国重庆'],
  ['Wuxi, Jiangsu', '无锡, 江苏', '中国江苏'],
  ['Wuxi, Chongqing', '巫溪, 重庆', '中国重庆'],
];

// 非碰撞普通城市:确保消歧逻辑没伤到常规译名。
const REGRESSION: Array<[string, string, string]> = [
  ['Hangzhou, Zhejiang', '杭州, 浙江', '中国浙江'],
  ['Shenzhen, Guangdong', '深圳, 广东', '中国广东'],
  ['Beijing', '北京', '中国北京'],
];

describe('CN 同拼音异地城市消歧(靠省份段)', () => {
  it.each([...CASES, ...REGRESSION])('%s → 城市名', (input, wantCity) => {
    expect(localizeCityName(input, 'CN', true)).toBe(wantCity);
  });

  it.each([...CASES, ...REGRESSION])('%s → 去过的省份', (input, _wantCity, wantProv) => {
    const comp = { city: input, country_iso2: 'CN' } as WcaCompetition;
    expect(buildRegionStats([comp], true)[0]?.label).toBe(wantProv);
  });
});
