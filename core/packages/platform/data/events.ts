export type EventType = "WCA 官方赛" | "城市开放赛" | "线上挑战赛" | "社群交流赛";
export type EventStatus = "报名中" | "即将开放" | "已结束";

export type CubeEvent = {
  id: string;
  title: string;
  type: EventType;
  status: EventStatus;
  startDate: string;
  endDate?: string;
  city: string;
  venue: string;
  capacity: number;
  registered: number;
  fee: number;
  events: string[];
  description: string;
};

export const EVENTS: CubeEvent[] = [
  {
    id: "open-2026-shenzhen",
    title: "魔方开放社群 · 深圳挑战赛 2026",
    type: "城市开放赛",
    status: "报名中",
    startDate: "2026-07-12",
    endDate: "2026-07-13",
    city: "深圳",
    venue: "南山区文体中心",
    capacity: 180,
    registered: 132,
    fee: 120,
    events: ["3x3", "2x2", "4x4", "盲拧", "金字塔"],
    description: "面向粤港澳大湾区的开放赛事,设新人组与 PB 突破奖,赛事直播全程覆盖。",
  },
  {
    id: "online-summer-cup",
    title: "夏日线上联赛 2026",
    type: "线上挑战赛",
    status: "报名中",
    startDate: "2026-06-01",
    endDate: "2026-08-31",
    city: "线上",
    venue: "魔方开放社群直播间",
    capacity: 1000,
    registered: 612,
    fee: 0,
    events: ["3x3", "盲拧", "单手"],
    description: "三个月长线积分制,周周打榜,月度晋级,总决赛邀请赛制。",
  },
  {
    id: "campus-2026-beijing",
    title: "北京高校魔方争霸赛",
    type: "城市开放赛",
    status: "即将开放",
    startDate: "2026-09-20",
    city: "北京",
    venue: "高校巡回主场",
    capacity: 256,
    registered: 0,
    fee: 80,
    events: ["3x3", "团体接力", "新人组"],
    description: "10 所高校联合举办,新人友好,设最佳团体奖与最佳新人奖。",
  },
  {
    id: "wca-2026-chengdu",
    title: "WCA 成都春季赛 2026",
    type: "WCA 官方赛",
    status: "已结束",
    startDate: "2026-03-22",
    endDate: "2026-03-23",
    city: "成都",
    venue: "天府新区会展中心",
    capacity: 200,
    registered: 200,
    fee: 150,
    events: ["3x3", "2x2", "4x4", "5x5", "盲拧", "单手", "金字塔"],
    description: "成都春季 WCA 官方认证赛事,平台承办的首场 WCA 全 7 项赛事。",
  },
  {
    id: "club-2026-shanghai",
    title: "上海社群月度交流赛",
    type: "社群交流赛",
    status: "报名中",
    startDate: "2026-06-15",
    city: "上海",
    venue: "静安区社群线下空间",
    capacity: 60,
    registered: 41,
    fee: 30,
    events: ["3x3", "盲拧体验"],
    description: "每月一次的线下交流局,新老玩家共同参与,设技术分享环节。",
  },
];

export function findEvent(id: string): CubeEvent | undefined {
  return EVENTS.find((e) => e.id === id);
}
