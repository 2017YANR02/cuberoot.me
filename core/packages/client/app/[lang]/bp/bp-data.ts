// Sources and founder-confirmed planning inputs. Targets are not operating results.
export const MARKET_SOURCE = {
  url: 'https://paper.people.com.cn/rmrb/pc/content/202606/01/content_30160163.html',
  date: '2026-06-01',
};
export const ONLINE_EVENT_PLAN = { eventsPerMonth: 4, entriesPerEvent: 200, feeCny: 20 } as const;
export const EVENT_GROSS_PER_EVENT = ONLINE_EVENT_PLAN.entriesPerEvent * ONLINE_EVENT_PLAN.feeCny;
export const EVENT_GROSS_PER_MONTH = ONLINE_EVENT_PLAN.eventsPerMonth * EVENT_GROSS_PER_EVENT;
