import { resolveAssistantYears } from './site_assistant_time';
/** Public summaries shared by page rendering, search and AI evidence. */
export const WC_2027_ANNOUNCEMENT = {
  id: 'announcement:wc-2027',
  year: 2027,
  href: '/wca/wc-2027',
  title: { zh: '2027 年 WCA 世锦赛：举办城市公告', en: 'WCA World Championship 2027: Host City Announcement' },
  summary: { zh: 'WC 2027 将在瑞典乌普萨拉举办。本页转述 WCA 2025 年 7 月官方公告。', en: 'WC 2027 will be held in Uppsala, Sweden. A summary of the WCA host-city announcement from July 2025.' },
  aliases: ['WC 2027', 'WC2027', 'WCA 2027', 'WCA World Championship 2027', '2027 World Championship', '2027年世锦赛', '2027世锦赛', '2027魔方世锦赛', '2027年魔方世锦赛', '2027世界魔方锦标赛', '2027年世界魔方锦标赛'],
  sourceUrl: 'https://www.worldcubeassociation.org/posts/wca-world-championship-2027-host-city-announcement-july-2025',
  applicationUrl: 'https://drive.google.com/file/d/1O4pnhDBxCHoYhPZIoPC0CgnP7HrE5NbD/view?usp=sharing',
  sourceMonth: '2025-07',
  paragraphs: [
    { zh: 'WCA 董事会与重大锦标赛团队（WMCT）宣布，2027 年 WCA 世界魔方锦标赛将在瑞典乌普萨拉（Uppsala）举办。', en: 'The WCA Board and Major Championships Team (WMCT) selected Uppsala, Sweden, to host the 2027 WCA World Championship.' },
    { zh: '瑞典地区组织 SveKub 将与 WMCT 合作筹备。赛事将决出全部 17 个 WCA 官方项目的世界冠军。', en: 'Swedish regional organization SveKub will work with WMCT. The championship will crown world champions in all 17 official WCA events.' },
    { zh: '这是世锦赛继 2017 年巴黎之后再次回到欧洲；2025 年赛事在西雅图举办。瑞典是此次申办的唯一申请方。', en: 'Following Seattle 2025, the event returns to Europe for the first time since Paris 2017. Sweden was the only applicant.' },
    { zh: '原公告未公布具体比赛日期、场馆或报名安排。后续安排请以 WCA 官方更新为准。', en: 'This announcement did not specify competition dates, the venue or registration arrangements. Refer to later WCA updates for those details.' },
  ],
} as const;

export const SITE_ANNOUNCEMENTS = [WC_2027_ANNOUNCEMENT];
export function findSiteAnnouncements(query: string, referenceYear?: number) {
  const normalize = (text:string) => text.toLowerCase().replace(/[\s-]+/g,'');
  const text=normalize(query);
  const championship=/(?:世锦赛|世界(?:魔方)?锦标赛|\bWC\s*(?=\d|\b)|world\s+(?:cube\s+|rubik'?s?\s+cube\s+)?championships?)/i.test(query);
  const years=new Set(resolveAssistantYears(query,referenceYear));
  return SITE_ANNOUNCEMENTS.filter(announcement=>announcement.aliases.some(alias=>text.includes(normalize(alias))) || championship && years.has(announcement.year));
}
