import { sqliteTable, text, integer, real, index, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core";

export type CourseLevel = "入门" | "进阶" | "高阶" | "竞速";
export type CourseFormat = "录播系统课" | "线上直播" | "一对一私教" | "线下家教";
export type ProductCategory = "竞速魔方" | "配件" | "周边" | "异形";
export type EventType = "WCA 官方赛" | "城市开放赛" | "线上挑战赛" | "社群交流赛";
export type EventStatus = "报名中" | "即将开放" | "已结束";
export type NewsCategory = "公告" | "赛事" | "教学" | "行业";
export type UserRole = "user" | "instructor" | "admin";
export type OrderType = "course" | "product" | "event" | "membership";
export type OrderStatus = "pending" | "paid" | "cancelled" | "refunded";
export type MembershipStatus = "active" | "expired" | "cancelled";
export type PayoutStatus = "pending" | "paid";
export type PaymentLogKind =
  | "callback"
  | "refund"
  | "manual_paid"
  | "manual_cancel";
export type PaymentMethod =
  | "mock_wechat"
  | "mock_alipay"
  | "stripe"
  | "wechat"
  | "alipay";
export type ApplicationStatus = "pending" | "approved" | "rejected";
export type CircleId = "newbie" | "speed" | "blind" | "campus";
export type CouponDiscountType = "fixed" | "percent";
export type CouponAppliesTo = "course" | "product" | "event" | "any";

export const courses = sqliteTable(
  "courses",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull(),
    level: text("level").$type<CourseLevel>().notNull(),
    format: text("format").$type<CourseFormat>().notNull(),
    instructor: text("instructor").notNull(),
    instructorId: text("instructor_id"),
    durationHours: integer("duration_hours").notNull(),
    lessons: integer("lessons").notNull(),
    price: integer("price").notNull(),
    studentsEnrolled: integer("students_enrolled").notNull(),
    rating: real("rating").notNull(),
    highlights: text("highlights", { mode: "json" }).$type<string[]>().notNull(),
    outline: text("outline", { mode: "json" })
      .$type<{ week: string; topic: string }[]>()
      .notNull(),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
    videoUrl: text("video_url"),
    coverUrl: text("cover_url"),
    nextLiveAt: integer("next_live_at"),
  },
  (t) => [index("courses_instructor_idx").on(t.instructorId)],
);

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").$type<ProductCategory>().notNull(),
  brand: text("brand").notNull(),
  price: integer("price").notNull(),
  originalPrice: integer("original_price"),
  rating: real("rating").notNull(),
  reviews: integer("reviews").notNull(),
  description: text("description").notNull(),
  features: text("features", { mode: "json" }).$type<string[]>().notNull(),
  inStock: integer("in_stock", { mode: "boolean" }).notNull(),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").$type<EventType>().notNull(),
  status: text("status").$type<EventStatus>().notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  city: text("city").notNull(),
  venue: text("venue").notNull(),
  capacity: integer("capacity").notNull(),
  registered: integer("registered").notNull(),
  fee: integer("fee").notNull(),
  events: text("events", { mode: "json" }).$type<string[]>().notNull(),
  description: text("description").notNull(),
});

export const news = sqliteTable("news", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  category: text("category").$type<NewsCategory>().notNull(),
  excerpt: text("excerpt").notNull(),
  body: text("body"),
});

export const instructors = sqliteTable(
  "instructors",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    title: text("title").notNull(),
    city: text("city").notNull(),
    specialty: text("specialty", { mode: "json" }).$type<string[]>().notNull(),
    studentsTaught: integer("students_taught").notNull(),
    yearsTeaching: integer("years_teaching").notNull(),
    bestRecord: text("best_record").notNull(),
    bio: text("bio").notNull(),
    userId: text("user_id"),
  },
  (t) => [index("instructors_user_idx").on(t.userId)],
);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    phone: text("phone").notNull().unique(),
    nickname: text("nickname").notNull(),
    avatar: text("avatar"),
    role: text("role").$type<UserRole>().notNull().default("user"),
    instructorId: text("instructor_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("users_phone_idx").on(t.phone),
    index("users_instructor_idx").on(t.instructorId),
  ],
);

export const otpCodes = sqliteTable(
  "otp_codes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    phone: text("phone").notNull(),
    code: text("code").notNull(),
    expiresAt: integer("expires_at").notNull(),
    consumedAt: integer("consumed_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("otp_codes_phone_idx").on(t.phone)],
);

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").$type<OrderType>().notNull(),
    refId: text("ref_id").notNull(),
    refTitle: text("ref_title").notNull(),
    qty: integer("qty").notNull().default(1),
    amount: integer("amount").notNull(),
    discount: integer("discount").notNull().default(0),
    couponCode: text("coupon_code"),
    status: text("status").$type<OrderStatus>().notNull().default("pending"),
    paymentMethod: text("payment_method").$type<PaymentMethod>(),
    providerId: text("provider_id"),
    paymentRaw: text("payment_raw", { mode: "json" }).$type<unknown>(),
    createdAt: integer("created_at").notNull(),
    paidAt: integer("paid_at"),
    refundedAt: integer("refunded_at"),
    refundAmount: integer("refund_amount"),
  },
  (t) => [
    index("orders_user_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
  ],
);

export const paymentLogs = sqliteTable(
  "payment_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: text("order_id").notNull(),
    providerId: text("provider_id").notNull(),
    kind: text("kind").$type<PaymentLogKind>().notNull(),
    payload: text("payload", { mode: "json" }).$type<unknown>(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("payment_logs_order_created_idx").on(t.orderId, t.createdAt),
  ],
);

export const instructorApplications = sqliteTable(
  "instructor_applications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    city: text("city").notNull(),
    wcaId: text("wca_id"),
    direction: text("direction", { mode: "json" }).$type<string[]>().notNull(),
    formats: text("formats", { mode: "json" }).$type<string[]>().notNull(),
    bio: text("bio").notNull(),
    status: text("status").$type<ApplicationStatus>().notNull().default("pending"),
    reviewNote: text("review_note"),
    createdAt: integer("created_at").notNull(),
    reviewedAt: integer("reviewed_at"),
  },
  (t) => [
    index("applications_status_idx").on(t.status),
    index("applications_phone_idx").on(t.phone),
  ],
);

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id").notNull(),
    circleId: text("circle_id").$type<CircleId>().notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    likes: integer("likes").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("posts_circle_idx").on(t.circleId),
    index("posts_author_idx").on(t.authorId),
    index("posts_created_idx").on(t.createdAt),
  ],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull(),
    authorId: text("author_id").notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("comments_post_idx").on(t.postId)],
);

export const postLikes = sqliteTable(
  "post_likes",
  {
    postId: text("post_id").notNull(),
    userId: text("user_id").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);

export type Course = typeof courses.$inferSelect;
export type CourseInsert = typeof courses.$inferInsert;
export type Product = typeof products.$inferSelect;
export type ProductInsert = typeof products.$inferInsert;
export type CubeEvent = typeof events.$inferSelect;
export type CubeEventInsert = typeof events.$inferInsert;
export type NewsItem = typeof news.$inferSelect;
export type NewsItemInsert = typeof news.$inferInsert;
export type Instructor = typeof instructors.$inferSelect;
export type InstructorInsert = typeof instructors.$inferInsert;
export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
export type OtpCode = typeof otpCodes.$inferSelect;
export type OtpCodeInsert = typeof otpCodes.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type OrderInsert = typeof orders.$inferInsert;
export type InstructorApplication = typeof instructorApplications.$inferSelect;
export type InstructorApplicationInsert = typeof instructorApplications.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type PostInsert = typeof posts.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type CommentInsert = typeof comments.$inferInsert;
export type PostLike = typeof postLikes.$inferSelect;
export type PostLikeInsert = typeof postLikes.$inferInsert;

export const eventsTrack = sqliteTable(
  "events_track",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown> | null>(),
    userId: text("user_id"),
    anonId: text("anon_id"),
    url: text("url"),
    referer: text("referer"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("events_track_name_created_idx").on(t.name, t.createdAt)],
);

export const coupons = sqliteTable("coupons", {
  code: text("code").primaryKey(),
  discountType: text("discount_type").$type<CouponDiscountType>().notNull(),
  discountValue: integer("discount_value").notNull(),
  appliesTo: text("applies_to").$type<CouponAppliesTo>().notNull().default("any"),
  minAmount: integer("min_amount").notNull().default(0),
  maxUses: integer("max_uses").notNull().default(0),
  uses: integer("uses").notNull().default(0),
  expiresAt: integer("expires_at"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
});

export const inviteCodes = sqliteTable(
  "invite_codes",
  {
    code: text("code").primaryKey(),
    ownerId: text("owner_id").notNull(),
    uses: integer("uses").notNull().default(0),
    rewardCoupon: text("reward_coupon"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("invite_codes_owner_idx").on(t.ownerId)],
);

// 会员订阅:一条 active 行代表当前会员资格,续费时延长 expiresAt;退款按 orderId 撤销
export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    plan: text("plan").notNull(), // 计划 id:monthly / quarterly / yearly
    status: text("status").$type<MembershipStatus>().notNull().default("active"),
    startedAt: integer("started_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    orderId: text("order_id"), // 最近一次开通/续费的订单
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("memberships_user_idx").on(t.userId),
    index("memberships_expires_idx").on(t.expiresAt),
  ],
);

// 讲师结算分账:每讲师每月一张结算单(net 实收 + 固定分成),pending → paid 留打款凭证
export const instructorPayouts = sqliteTable(
  "instructor_payouts",
  {
    id: text("id").primaryKey(),
    instructorId: text("instructor_id").notNull(),
    period: text("period").notNull(), // 结算月份 "YYYY-MM"
    orderCount: integer("order_count").notNull().default(0),
    grossAmount: integer("gross_amount").notNull().default(0), // 当月实收(net,已扣优惠)
    shareRate: real("share_rate").notNull(), // 分成比例,如 0.7
    shareAmount: integer("share_amount").notNull(), // 应打款金额 = grossAmount × shareRate
    status: text("status").$type<PayoutStatus>().notNull().default("pending"),
    method: text("method"), // 打款方式:bank / wechat / alipay / manual
    reference: text("reference"), // 打款凭证号 / 流水
    note: text("note"),
    createdAt: integer("created_at").notNull(),
    paidAt: integer("paid_at"),
  },
  (t) => [
    uniqueIndex("instructor_payouts_inst_period_unique").on(
      t.instructorId,
      t.period,
    ),
    index("instructor_payouts_status_idx").on(t.status),
  ],
);

export type Membership = typeof memberships.$inferSelect;
export type MembershipInsert = typeof memberships.$inferInsert;
export type InstructorPayout = typeof instructorPayouts.$inferSelect;
export type InstructorPayoutInsert = typeof instructorPayouts.$inferInsert;

export type QrType = "redirect" | "landing";
export type QrLink = { label: string; href: string; note?: string };
// 卡片背面精选解法公式:名称(如 OLL 33)+ 记法 + 来源链接(主站 alg 工具)
export type QrAlg = { name?: string; moves: string; url?: string };
// 卡面可移动元素:正面语录 / 品牌名,背面文案 / 角标 / 二维码 / 公式区 / 正面图(平移+缩放)
export type CardEl = "quote" | "brand" | "backText" | "term" | "qr" | "alg" | "front";
// 各元素相对默认位的偏移(mm),编辑器拖动写入;DOM 卡与矢量母版共用。
// s = 缩放倍率(仅 front 用,默认 1;cover 铺满为基准,>1 放大 <1 缩小)
export type CardLayout = Partial<Record<CardEl, { x: number; y: number; s?: number }>>;

export const qrCodes = sqliteTable("qr_codes", {
  code: text("code").primaryKey(),
  label: text("label").notNull(),
  type: text("type").$type<QrType>().notNull().default("redirect"),
  target: text("target").notNull().default("/"),
  title: text("title"),
  intro: text("intro"),
  links: text("links", { mode: "json" }).$type<QrLink[]>(),
  term: text("term"),
  quote: text("quote"),
  frontArt: text("front_art"),
  alg: text("alg", { mode: "json" }).$type<QrAlg>(),
  layout: text("layout", { mode: "json" }).$type<CardLayout>(),
  scans: integer("scans").notNull().default(0),
  disabled: integer("disabled", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

export type EventsTrack = typeof eventsTrack.$inferSelect;
export type EventsTrackInsert = typeof eventsTrack.$inferInsert;
export type Coupon = typeof coupons.$inferSelect;
export type CouponInsert = typeof coupons.$inferInsert;
export type InviteCode = typeof inviteCodes.$inferSelect;
export type InviteCodeInsert = typeof inviteCodes.$inferInsert;
export type QrCode = typeof qrCodes.$inferSelect;
export type QrCodeInsert = typeof qrCodes.$inferInsert;
export type PaymentLog = typeof paymentLogs.$inferSelect;
export type PaymentLogInsert = typeof paymentLogs.$inferInsert;

export const lessons = sqliteTable(
  "lessons",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id").notNull(),
    idx: integer("idx").notNull(),
    title: text("title").notNull(),
    durationSec: integer("duration_sec"),
    videoKey: text("video_key"),
    videoUrl: text("video_url"),
    free: integer("free", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("lessons_course_idx").on(t.courseId, t.idx)],
);

export const learningProgress = sqliteTable(
  "learning_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    lessonId: text("lesson_id").notNull(),
    courseId: text("course_id").notNull(),
    positionSec: integer("position_sec").notNull().default(0),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("learning_progress_user_lesson_unique").on(t.userId, t.lessonId),
    index("learning_progress_user_course_idx").on(t.userId, t.courseId),
  ],
);

export type Lesson = typeof lessons.$inferSelect;
export type LessonInsert = typeof lessons.$inferInsert;
export type LearningProgress = typeof learningProgress.$inferSelect;
export type LearningProgressInsert = typeof learningProgress.$inferInsert;

export type LogLevel = "error" | "warn";

export const errorLogs = sqliteTable(
  "error_logs",
  {
    id: text("id").primaryKey(),
    ts: integer("ts").notNull(),
    level: text("level").$type<LogLevel>().notNull().default("error"),
    message: text("message").notNull(),
    stack: text("stack"),
    path: text("path"),
    userId: text("user_id"),
  },
  (t) => [index("error_logs_ts_idx").on(t.ts)],
);

export const requestLogs = sqliteTable(
  "request_logs",
  {
    id: text("id").primaryKey(),
    ts: integer("ts").notNull(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    status: integer("status").notNull(),
    durationMs: integer("duration_ms").notNull(),
    userId: text("user_id"),
  },
  (t) => [index("request_logs_ts_idx").on(t.ts)],
);

export type ErrorLog = typeof errorLogs.$inferSelect;
export type ErrorLogInsert = typeof errorLogs.$inferInsert;
export type RequestLog = typeof requestLogs.$inferSelect;
export type RequestLogInsert = typeof requestLogs.$inferInsert;
