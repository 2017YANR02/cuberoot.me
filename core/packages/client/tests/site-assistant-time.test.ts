import {describe,it,expect} from 'vitest';
import {resolveAssistantTime,resolveAssistantYears} from '@cuberoot/shared/site-assistant';

const now=new Date('2026-10-02T15:00:00Z');
describe('assistant calendar interpretation',()=>{
  it.each([
    ['前年','2024-01-01','2024-12-31'],['去年','2025-01-01','2025-12-31'],['今年','2026-01-01','2026-12-31'],
    ['明年','2027-01-01','2027-12-31'],['后年','2028-01-01','2028-12-31'],
    ['前天','2026-09-30','2026-09-30'],['昨天','2026-10-01','2026-10-01'],['今天','2026-10-02','2026-10-02'],
    ['明天','2026-10-03','2026-10-03'],['后天','2026-10-04','2026-10-04'],
    ['前一周','2026-09-21','2026-09-27'],['上周','2026-09-21','2026-09-27'],['这周','2026-09-28','2026-10-04'],['下周','2026-10-05','2026-10-11'],
    ['一周前','2026-09-25','2026-09-25'],['上个月','2026-09-01','2026-09-30'],['下个月','2026-11-01','2026-11-30'],
    ['year before last','2024-01-01','2024-12-31'],['next year','2027-01-01','2027-12-31'],
    ['day after tomorrow','2026-10-04','2026-10-04'],['next week','2026-10-05','2026-10-11'],
  ])('resolves %s from a fixed clock', (phrase,start,end)=>{
    expect(resolveAssistantTime(phrase,now,'America/Los_Angeles').periods).toEqual([{phrase,unit:expect.any(String),start,end}]);
  });
  it('uses visitor calendar year rather than the server UTC year',()=>{
    const boundary=new Date('2027-01-01T01:00:00Z');
    expect(resolveAssistantTime('明年',boundary,'America/Los_Angeles')).toMatchObject({today:'2026-12-31',normalizedQuestion:'2027'});
    expect(resolveAssistantTime('明年',boundary,'Asia/Shanghai')).toMatchObject({today:'2027-01-01',normalizedQuestion:'2028'});
  });
  it('handles leap days, year-crossing weeks and calendar days across DST',()=>{
    expect(resolveAssistantTime('明天',new Date('2024-02-28T12:00:00Z')).periods[0].start).toBe('2024-02-29');
    expect(resolveAssistantTime('下周',new Date('2026-12-27T12:00:00Z')).periods[0]).toMatchObject({start:'2026-12-28',end:'2027-01-03'});
    expect(resolveAssistantTime('明天',new Date('2026-03-08T09:30:00Z'),'America/Los_Angeles').periods[0].start).toBe('2026-03-09');
  });
  it('keeps multiple periods and replaces longest English expressions once',()=>{
    expect(resolveAssistantTime('去年和前年',now).normalizedQuestion).toBe('2025和2024');
    expect(resolveAssistantTime('day before yesterday',now).periods).toHaveLength(1);
    expect(resolveAssistantTime('year after next',now).normalizedQuestion).toBe('2028');
    expect(resolveAssistantYears('大前年和大后年',2026)).toEqual([2023,2029]);
    expect(resolveAssistantTime('上周二',now).periods).toEqual([]);
    expect(resolveAssistantTime('WC2025的前一周有哪些比赛',now)).toMatchObject({periods:[],unresolvedPhrases:['前一周']});
  });
});
