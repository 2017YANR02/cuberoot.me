/**
 * 全站 URL search-param 的唯一定义源。
 *
 * 服务端页面用 `loadXxx(searchParams)` 解析(替代手写 `Number(page) || 1`),
 * 客户端交互组件(ListSearch / SearchPageForm)用同一份 parser 喂给
 * `useQueryState` / `useQueryStates`,server / client 共享一套类型与默认值。
 *
 * 写链接(分页 / Tab)用对应的 `serializeXxx` 拼 querystring,不再手拼字符串。
 *
 * 不在此处:纯导航(router.push)、登录后重定向、埋点取原始 querystring、
 * 以及 /api/qr/* 这类带自定义校验(数值钳制 / hex 正则)的图像生成接口 —— 那些
 * 不是"页面状态",继续用 next/navigation 与 request.nextUrl.searchParams。
 */
import {
  createLoader,
  createSerializer,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

/* ---------- 列表页:关键词 + 页码(课程 / 资讯 / 赛事 / 商城)---------- */
export const listSearchParams = {
  q: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
};
export const loadListSearchParams = createLoader(listSearchParams);
export const serializeListSearchParams = createSerializer(listSearchParams);

// 商城在 list 基础上多一个分类筛选(「全部」= 无 category 参数)
export const PRODUCT_CATEGORIES = ["竞速魔方", "异形", "配件", "周边"] as const;
export const shopListParams = {
  ...listSearchParams,
  category: parseAsStringLiteral(PRODUCT_CATEGORIES),
};
export const loadShopListParams = createLoader(shopListParams);

/* ---------- 站内搜索 /search:仅关键词 ---------- */
export const searchQueryParams = {
  q: parseAsString.withDefault(""),
};
export const loadSearchQuery = createLoader(searchQueryParams);

/* ---------- 仅页码(讲师学员等)---------- */
export const pageParams = {
  page: parseAsInteger.withDefault(1),
};
export const loadPageParams = createLoader(pageParams);
export const serializePageParams = createSerializer(pageParams);

/* ---------- 讲师列表:按专长标签筛选(「全部」= 无 specialty 参数)---------- */
// 专长是讲师自填的自由文案,不是固定枚举,用普通字符串 parser。
export const instructorListParams = {
  specialty: parseAsString,
};
export const loadInstructorListParams = createLoader(instructorListParams);
export const serializeInstructorListParams = createSerializer(
  instructorListParams,
);

/* ---------- admin 日志:Tab + 页码 ---------- */
export const LOG_TABS = ["errors", "slow"] as const;
export type LogTab = (typeof LOG_TABS)[number];
export const logsParams = {
  tab: parseAsStringLiteral(LOG_TABS).withDefault("errors"),
  page: parseAsInteger.withDefault(1),
};
export const loadLogsParams = createLoader(logsParams);
export const serializeLogsParams = createSerializer(logsParams);

/* ---------- 社群发帖:初始圈子 + 校验提示 ---------- */
export const CIRCLES = ["newbie", "speed", "blind", "campus"] as const;
export const newPostParams = {
  circle: parseAsStringLiteral(CIRCLES).withDefault("newbie"),
  error: parseAsString,
};
export const loadNewPostParams = createLoader(newPostParams);

/* ---------- 排行榜:榜单类型 + 时间范围 + 魔方项目 ---------- */
export const LEADERBOARD_BOARDS = ["speed", "study", "points"] as const;
export type LeaderboardBoard = (typeof LEADERBOARD_BOARDS)[number];
export const LEADERBOARD_PERIODS = ["week", "month", "all"] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];
export const leaderboardParams = {
  board: parseAsStringLiteral(LEADERBOARD_BOARDS).withDefault("speed"),
  period: parseAsStringLiteral(LEADERBOARD_PERIODS).withDefault("week"),
  event: parseAsString.withDefault("333"), // 速拧榜按魔方项目
};
export const loadLeaderboardParams = createLoader(leaderboardParams);
export const serializeLeaderboardParams = createSerializer(leaderboardParams);

/* ---------- 圈子详情:排序(最新 / 热门)+ 页码 ---------- */
export const CIRCLE_SORTS = ["latest", "hot"] as const;
export type CircleSort = (typeof CIRCLE_SORTS)[number];
export const circleParams = {
  sort: parseAsStringLiteral(CIRCLE_SORTS).withDefault("latest"),
  page: parseAsInteger.withDefault(1),
};
export const loadCircleParams = createLoader(circleParams);
export const serializeCircleParams = createSerializer(circleParams);

/* ---------- 订单支付流(去掉 `as ProviderId` 强转)---------- */
export const PROVIDER_IDS = [
  "mock_wechat",
  "mock_alipay",
  "stripe",
  "wechat",
  "alipay",
] as const;
export const orderFlowParams = {
  stripe_session_id: parseAsString,
  pay: parseAsStringLiteral(["qrcode"] as const),
  provider: parseAsStringLiteral(PROVIDER_IDS),
};
export const loadOrderFlowParams = createLoader(orderFlowParams);

/* ---------- 登录:重定向目标 + 邀请码预填 ---------- */
export const loginParams = {
  next: parseAsString.withDefault("/"),
  invite: parseAsString.withDefault(""),
};
export const loadLoginParams = createLoader(loginParams);

// admin 后台登录:重定向目标(默认 /admin)+ 密码错误标记
export const adminLoginParams = {
  next: parseAsString.withDefault("/admin"),
  error: parseAsString,
};
export const loadAdminLoginParams = createLoader(adminLoginParams);

/* ---------- 一次性提示 / 操作参数 ---------- */
export const orderNoticeParams = {
  error: parseAsString,
  refunded: parseAsString,
  id: parseAsString,
};
export const loadOrderNotice = createLoader(orderNoticeParams);

// 仅 `?error=...`(admin 二维码 / 邀请码 / 优惠券 / 赛事详情下单)
export const errorNoticeParams = { error: parseAsString };
export const loadErrorNotice = createLoader(errorNoticeParams);

// `?saved=1` + 改 code 失败回显 `?codeErr=exists|invalid`(admin 二维码编辑)
export const savedNoticeParams = { saved: parseAsString, codeErr: parseAsString };
export const loadSavedNotice = createLoader(savedNoticeParams);

// 二维码卡片打印:`?codes=a,b`
export const qrCardsParams = { codes: parseAsString };
export const loadQrCardsParams = createLoader(qrCardsParams);

// 落地页预览:`?stay=1`
export const qrLandingParams = { stay: parseAsString };
export const loadQrLandingParams = createLoader(qrLandingParams);
