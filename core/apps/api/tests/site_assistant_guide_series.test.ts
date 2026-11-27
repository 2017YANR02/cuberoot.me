import { describe, expect, it } from 'vitest';
import { guideSeriesOperands } from '../src/utils/site_assistant_guide_series.js';
import { attendanceBucketAnswer, regionDaysAnswer } from '../src/utils/site_assistant_guide_attendance.js';
import { measuredGuideAnswer } from '../src/utils/site_assistant_guide_measurements.js';
import { guideGroupOperands } from '../src/utils/site_assistant_guide_groups.js';

describe('recomputed guide operands', () => {
  it('restores one result while keeping an appended DNF and the previous denominator', () => {
    const guide = {href:'/wca/about/success-rate', text:'含 DNF 和 valid；attempted < 3 直接不输出'};
    const turns = ['依次为有效、DNF、有效','第二轮更正为DNS','第四轮新增DNF','撤销第二轮的改动。'];
    expect(JSON.parse(guideSeriesOperands(turns, guide)!)).toMatchObject({
      previous:{attempted:3, solved:2}, current:{attempted:4, solved:2, eligible:true, percent:50},
    });
  });
  it('recomputes overlapping windows after an append and an undo', () => {
    const guide = {href:'/wca/about/average_of',text:'Mo3 不裁剪'};
    const turns = ['Mo3为8、10、12、14秒','第二把改成16秒','再接一把7秒','撤销第二把的改动'];
    const {current,previous} = JSON.parse(guideSeriesOperands(turns,guide)!);
    expect(current.windows).toEqual([10,12,11]);
    expect(previous.windows).toEqual([12,14,11]);
    expect(guideSeriesOperands([...turns,'另加两秒罚时'],guide)).toBeUndefined();
  });
  it('resorts after a transfer and handles insufficient or tied rounds', () => {
    const guide = {href:'/wca/about/best_round',text:'ORDER BY <best | average>'};
    const setup = '三阶甲的四个平均5、7、9、10秒，乙前三平均5、8、8秒。';
    const initial = JSON.parse(guideGroupOperands([setup],guide)!);
    expect(initial.current.leaders).toEqual(['甲','乙']);
    const moved = JSON.parse(guideGroupOperands([setup,'甲的9秒其实在乙，移到乙。'],guide)!);
    expect(moved.current.rounds.map((r: {sum:number}) => r.sum)).toEqual([22,21]);
    expect(guideGroupOperands([setup,'乙的8秒改为12秒。'],guide)).toBeUndefined();
  });
  it('only omits ineligible events and includes higher tiers in a distinct-event count', () => {
    const guide = {href:'/wca/about/longest_streak_of_competitions_in_own_country',text:'一场缺席 → 计数清零'};
    const setup = '本国连续办甲乙丙，我只去了甲、丙。';
    const result = JSON.parse(guideGroupOperands([setup,'找到乙的参赛记录','戊是下一场本国赛，我缺席','回退乙的补录'],guide)!);
    expect(result.current).toMatchObject({current:0, longest:1});
    const breadth = {href:'/wca/about/records_in_most_events',text:'WR 同时计入洲际和国家纪录'};
    const counts = JSON.parse(guideGroupOperands(['三阶有一条WR，四阶有两条NR。','四阶一条NR改为洲际纪录。'],breadth)!);
    expect(counts.current).toMatchObject({World:{count:1},Continental:{count:2},National:{count:2}});
  });
  it('does not drop another request when rendering a closed month or region calculation', () => {
    const month = {href:'/wca/about/most_attended_competitions_in_single_month',text:'start_date HAVING n >= 6'};
    const setup = '我五月在四场不同比赛有成绩，另有一场4月29日开赛、5月2日结束。';
    const edit = '开赛日是5月1日。两个自然月的数各改成什么？';
    expect(attendanceBucketAnswer([setup,edit],month)).toContain('5月 5 场');
    expect(attendanceBucketAnswer([setup,edit+'还要全国前五。'],month)).toBeUndefined();
    const region = {href:'/wca/about/competition_days_count_by_region',text:'end_date - start_date + 1'};
    const q = '甲地公开的两场是5月2日至5日、5月7日当天，乙地只办一场三天赛。各地场数和平均天数？';
    expect(regionDaysAnswer([q],region)).toContain('平均 2.5 天');
    expect(regionDaysAnswer([q.replace('5月2日','5月40日')],region)).toBeUndefined();
  });
  it('compares speeds to the immediately preceding version when undoing one input', () => {
    const guide = {href:'/wca/prediction-about',text:'步数 ÷ 手速 + 识别等额外时间'};
    const turns = ['甲30步每秒10步、识别0.8秒；乙36步每秒12步、识别0.5秒。',
      '乙的识别开销更正为0.7秒。','取消乙识别时间那步更改。哪一边更快，优势扩大了多少？'];
    expect(measuredGuideAnswer(turns,guide)).toContain('扩大0.2 秒');
    expect(measuredGuideAnswer([...turns.slice(0,-1),turns.at(-1)+'再给我一份计划。'],guide)).toBeUndefined();
  });
});
