import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { count } from "drizzle-orm";
import {
  ArrowRight,
  BookOpen,
  ShoppingCart,
  Trophy,
  MessageSquare,
  GraduationCap,
  Search,
  Smartphone,
  Share2,
  Database,
  ShieldCheck,
  Send,
  HardDrive,
  CreditCard,
  Activity,
  Wallet,
  QrCode,
  BarChart3,
  Ticket,
  Globe,
  Layers,
  Zap,
  Server,
  Lock,
  Rocket,
  Users,
  Boxes,
  ScanLine,
  Crown,
  Timer,
  Route,
  ListChecks,
  NotebookPen,
  Award,
  Star,
  Coins,
  Flame,
  Bell,
  Heart,
  Sparkles,
  Gauge,
} from "lucide-react";
import { db, schema } from "@/db";
import { Section } from "@/components/Section";
import { Button } from "@/components/Button";
import { FeatureCard } from "@/components/FeatureCard";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/Badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "建设成果汇报 — 魔方开放社群",
  description:
    "用图文汇报魔方开放社群平台目前做了什么:前端用户能看到的体验,后端在背后支撑的能力,以及全部页面入口(含扫码落地、管理后台、讲师后台等站内导航摸不到的页面)。",
};

type Feature = { icon: LucideIcon; title: string; description: string };

const LOOP: { n: string; icon: LucideIcon; title: string; desc: string }[] = [
  { n: "01", icon: QrCode, title: "扫码 / 搜索进入", desc: "包裹卡二维码落地,或站内全文检索直达" },
  { n: "02", icon: Smartphone, title: "手机号登录", desc: "OTP 验证码登录,新用户带邀请码奖励" },
  { n: "03", icon: BookOpen, title: "浏览课程商品", desc: "课程 / 商城 / 赛事 / 资讯分区浏览" },
  { n: "04", icon: Ticket, title: "优惠下单", desc: "优惠券试算,生成订单待支付" },
  { n: "05", icon: CreditCard, title: "扫码支付", desc: "微信 / 支付宝 / Stripe,二维码轮询到账" },
  { n: "06", icon: GraduationCap, title: "解锁学习", desc: "单课购买或会员畅看,付费墙校验,视频防盗链" },
  { n: "07", icon: Activity, title: "进度续看", desc: "学习进度自动保存,断点继续" },
  { n: "08", icon: MessageSquare, title: "社群交流", desc: "圈子发帖、评论、点赞" },
  { n: "09", icon: Share2, title: "邀请裂变", desc: "专属邀请码拉新,双向发券" },
];

const FRONTEND: Feature[] = [
  { icon: Zap, title: "SSG + RSC 秒开", description: "Next 16 App Router,服务端组件直出,首屏快、SEO 友好。" },
  { icon: Lock, title: "课程付费墙 + 视频", description: "已购校验决定可看范围,试看课免费,视频经取流接口防盗链。" },
  { icon: Crown, title: "会员订阅畅看", description: "月 / 季 / 年会员,有效期内解锁全部付费课程,新课自动可看,续费时长自动叠加。" },
  { icon: Activity, title: "学习进度续看", description: "播放进度按节流自动落库,我的课程一键跳到最近学到的一节。" },
  { icon: Search, title: "全站中文搜索", description: "SQLite FTS5 全文检索,自定义 CJK 分词,课程/商品/赛事/资讯/帖子统一搜。" },
  { icon: MessageSquare, title: "社群圈子", description: "新手/竞速/盲拧/校园四个圈子,发帖评论点赞,Markdown 正文。" },
  { icon: Smartphone, title: "PWA 可安装离线", description: "手写 Service Worker 缓存策略,可装到桌面,断网有离线兜底页。" },
  { icon: Layers, title: "移动端适配", description: "窄屏折叠导航、触摸交互,图表表格面板全部窄屏可用。" },
  { icon: Share2, title: "分享卡 OG 图", description: "详情页动态生成 1200×630 OG 图,微信/Twitter 分享有大图。" },
];

const CUBE_LEARN: Feature[] = [
  { icon: Timer, title: "魔方计时器", description: "前端生成 WCA 标准打乱(三阶 / 二阶 / 四阶 / 金字塔等),空格或长按起停,ao5 / ao12 / 最佳成绩自动统计,未登录也能练。" },
  { icon: Trophy, title: "三榜排行", description: "速拧榜 / 学习榜 / 积分榜,周 / 月 / 总三档切换,速拧需满 5 次防刷,真实激励竞争。" },
  { icon: Boxes, title: "算法字典", description: "内置 39 条公式(21 PLL + OLL + F2L),自绘 2D 棋盘示意每一步,支持搜索与分类筛选。" },
  { icon: Route, title: "学习路径", description: "把零散课程打包成进阶路线,跨课计算完成度,一张路线图带学员从入门走到进阶。" },
  { icon: ListChecks, title: "章节测验", description: "看完视频即测,答案不下发客户端、服务端判分讲解,满分自动发积分。" },
  { icon: NotebookPen, title: "时间戳笔记", description: "边看边记一笔,点笔记跳回视频那一秒,我的笔记页统一回顾。" },
  { icon: Award, title: "结课证书", description: "100% 完课自动发证,唯一编码可验证,附 1200×630 可分享证书图。" },
  { icon: Star, title: "课程评价", description: "已购学员打星评价,评分分布可视化,聚合回写课程评分。" },
];

const ENGAGE: Feature[] = [
  { icon: Coins, title: "积分体系", description: "购物 / 完课 / 发帖 / 评价 / 签到 / 满分测验自动发分,同来源幂等去重,流水账可追溯。" },
  { icon: Award, title: "成就徽章", description: "多档成就目录,达成条件自动解锁,徽章墙展示成长轨迹。" },
  { icon: Flame, title: "连续打卡", description: "学习 / 计时自动打卡,GitHub 风格热力图加连续天数,养成每日习惯。" },
  { icon: Bell, title: "站内通知", description: "被评论 / 被赞 / 被 @ 实时入站,顶栏铃铛红点,通知中心集中查看。" },
  { icon: Heart, title: "通用收藏", description: "课程 / 商品 / 赛事 / 资讯 / 帖子一键收藏,我的收藏与愿望单分区管理。" },
  { icon: Crown, title: "会员专享价", description: "商品可设会员价或仅会员可购,下单服务端按会员身份计价并拦截越权。" },
];

const BACKEND: Feature[] = [
  { icon: Database, title: "SQLite + Drizzle", description: "better-sqlite3 + Drizzle ORM 类型安全数据层,迁移与种子脚本齐全。" },
  { icon: ShieldCheck, title: "双端鉴权", description: "管理端 HMAC-SHA256 session,用户端手机号 OTP,proxy 路由守门。" },
  { icon: Send, title: "短信多 Provider", description: "console / 阿里云 / 腾讯云,手写 V3 签名零 SDK 依赖,缺配置自动降级。" },
  { icon: HardDrive, title: "存储多 Provider", description: "本地 / R2 / S3 / OSS / COS,手写 SigV4 / OSS / COS 签名,上传带真实进度。" },
  { icon: CreditCard, title: "支付多 Provider", description: "微信 V3 Native / 支付宝电脑网站 / Stripe Checkout,回调统一,可退款对账。" },
  { icon: Search, title: "FTS5 全文检索", description: "5 张虚拟表 + 15 触发器自动同步,CJK 自定义分词函数 cube_seg。" },
  { icon: BarChart3, title: "可观测日志", description: "错误日志兜底 + 慢请求(>500ms)埋点,后台分 Tab 查看。" },
  { icon: Wallet, title: "讲师结算分账", description: "70% 分成按月一键生成结算单,后台标记打款留凭证,讲师可查到账状态。" },
  { icon: Boxes, title: "赛事名额防超卖", description: "付款自动占名额,满员 / 已结束下单即拦,退款自动释放,名额计数实时准确。" },
  { icon: Coins, title: "积分流水账", description: "point_ledger 单一流水,同来源幂等去重,余额即求和,六类行为统一收口发分。" },
  { icon: Gauge, title: "运营数据看板", description: "后台首页单查聚合 KPI 加 7 天趋势,埋点漏斗 / GMV / Top 事件纯 SVG 自绘,无图表库。" },
];

const GROWTH: Feature[] = [
  { icon: QrCode, title: "二维码 / 聚合码", description: "自绘融合魔方元素的二维码,活码随时改向,聚合落地页多链接,2×4cm 卡片打印。" },
  { icon: Activity, title: "自建埋点", description: "events_track 表 + /api/track,匿名 cookie,page_view / 下单 / 注册自动埋。" },
  { icon: Ticket, title: "优惠券 / 邀请码", description: "下单试算折扣,新用户邀请码注册双向发券,后台批量管理。" },
  { icon: Globe, title: "SEO 基建", description: "动态 sitemap / robots 拉库生成,详情页注入 openGraph + twitter 元信息。" },
];

const HIGHLIGHTS: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Boxes, title: "自成一体", desc: "不挂 GA / Sentry / Posthog,不依赖第三方 CDN,埋点搜索支付签名全自建。" },
  { icon: Server, title: "全栈 Server Actions", desc: "增删改走 Server Actions,无需手写 REST,表单直连数据层。" },
  { icon: ShieldCheck, title: "手写各家签名", desc: "短信 / 存储 / 微信支付 V3 全部手写签名,零厂商 SDK 体积负担。" },
  { icon: Search, title: "中文 FTS5 分词", desc: "unicode61 无法分 CJK,自定义 SQL 函数插空格 + 前缀通配,中文也能搜。" },
  { icon: Rocket, title: "一键部署", desc: "push main → CI 构建 + scp,systemd 反代,持久库部署目录外不被覆盖。" },
  { icon: Boxes, title: "魔方垂直自研", desc: "WCA 打乱、ao5 / ao12 统计、算法 2D 棋盘示意全部前端纯算法自绘,不挂第三方魔方库。" },
  { icon: Sparkles, title: "游戏化全自建", desc: "积分幂等流水、成就引擎、打卡热力图、站内通知全自建,不接第三方成长 / 通知系统。" },
];

const TODO: { title: string; desc: string }[] = [
  { title: "真实支付商户", desc: "接入微信 / 支付宝正式商户,替换当前 mock 通道。" },
  { title: "视频真实签名 URL", desc: "远端存储签发带时效的防盗链地址。" },
  { title: "短信真实通道", desc: "配置阿里云 / 腾讯云模板,替换 console 降级。" },
  { title: "专用短域名", desc: "二维码印刷地址绑定独立短域名(NEXT_PUBLIC_QR_BASE),印前定好不可改。" },
  { title: "录入课程章节", desc: "学习播放 / 章节测验 / 笔记 / 结课证书需后台先录入真实章节与视频才能完整体验。" },
  { title: "付费聚合码", desc: "聚合码链接级 gating 接现有付费墙(待群里定规则)。" },
];

type RouteLink = { href: string; label: string; ext?: boolean };
type RouteGroupData = {
  title: string;
  access: string;
  tone: "brand" | "neutral" | "warning" | "danger" | "muted";
  icon: LucideIcon;
  links: RouteLink[];
};

const ROUTE_GROUPS: RouteGroupData[] = [
  {
    title: "公开页面",
    access: "无需登录",
    tone: "neutral",
    icon: Globe,
    links: [
      { href: "/", label: "首页" },
      { href: "/courses", label: "课程" },
      { href: "/paths", label: "学习路径" },
      { href: "/membership", label: "会员订阅" },
      { href: "/shop", label: "商城" },
      { href: "/events", label: "赛事" },
      { href: "/community", label: "社群" },
      { href: "/news", label: "资讯" },
      { href: "/instructors", label: "讲师" },
      { href: "/timer", label: "计时器" },
      { href: "/leaderboard", label: "排行榜" },
      { href: "/algorithms", label: "算法字典" },
      { href: "/about", label: "关于" },
      { href: "/search?q=魔方", label: "搜索结果" },
    ],
  },
  {
    title: "用户中心",
    access: "需登录",
    tone: "warning",
    icon: Users,
    links: [
      { href: "/login", label: "登录" },
      { href: "/me", label: "个人中心" },
      { href: "/me/courses", label: "我的课程" },
      { href: "/me/badges", label: "我的徽章" },
      { href: "/me/notes", label: "我的笔记" },
      { href: "/me/favorites", label: "我的收藏" },
      { href: "/me/wishlist", label: "愿望单" },
      { href: "/me/membership", label: "我的会员" },
      { href: "/me/invite", label: "我的邀请码" },
      { href: "/notifications", label: "通知中心" },
      { href: "/community/posts/new", label: "发帖" },
      { href: "/orders", label: "我的订单" },
      { href: "/instructors/apply", label: "讲师入驻申请" },
    ],
  },
  {
    title: "扫码落地",
    access: "扫码进入 · 站内无导航",
    tone: "brand",
    icon: ScanLine,
    links: [
      { href: "/qr/demo-landing", label: "聚合落地页(示例)" },
      { href: "/api/qr/demo-landing/svg", label: "二维码图(手机可扫)", ext: true },
      { href: "/qr/demo-redirect?stay=1", label: "跳转码(示例,预览不跳转)" },
    ],
  },
  {
    title: "讲师后台",
    access: "需讲师角色",
    tone: "warning",
    icon: GraduationCap,
    links: [
      { href: "/instructor", label: "概览" },
      { href: "/instructor/courses", label: "我的课程" },
      { href: "/instructor/students", label: "学员" },
      { href: "/instructor/earnings", label: "收益" },
    ],
  },
  {
    title: "管理后台",
    access: "需登录 · 默认 admin123",
    tone: "danger",
    icon: Lock,
    links: [
      { href: "/admin/login", label: "后台登录" },
      { href: "/admin", label: "概览" },
      { href: "/admin/qr", label: "二维码 / 落地码" },
      { href: "/admin/qr/cards", label: "二维码卡片打印" },
      { href: "/admin/qr/prompts", label: "二维码提示词工坊" },
      { href: "/admin/qr/stats", label: "二维码扫码统计" },
      { href: "/admin/courses", label: "课程管理" },
      { href: "/admin/paths", label: "学习路径" },
      { href: "/admin/algorithms", label: "算法库" },
      { href: "/admin/products", label: "商品管理" },
      { href: "/admin/events", label: "赛事管理" },
      { href: "/admin/orders", label: "订单" },
      { href: "/admin/reconcile", label: "对账与流水" },
      { href: "/admin/instructor-payouts", label: "讲师结算" },
      { href: "/admin/coupons", label: "优惠券" },
      { href: "/admin/invites", label: "邀请码" },
      { href: "/admin/events-track", label: "埋点" },
      { href: "/admin/logs", label: "日志" },
      { href: "/admin/applications", label: "讲师申请" },
    ],
  },
  {
    title: "系统路由",
    access: "给机器 / PWA",
    tone: "muted",
    icon: Server,
    links: [
      { href: "/sitemap.xml", label: "站点地图", ext: true },
      { href: "/robots.txt", label: "爬虫规则", ext: true },
      { href: "/manifest.json", label: "PWA 清单", ext: true },
      { href: "/offline", label: "离线兜底页" },
      { href: "/og?title=魔方开放社群", label: "OG 分享图", ext: true },
      { href: "/icons/192", label: "应用图标 192", ext: true },
      { href: "/sw.js", label: "Service Worker", ext: true },
    ],
  },
];

export default function ProgressPage() {
  const counts = {
    courses: db.select({ v: count() }).from(schema.courses).get()?.v ?? 0,
    products: db.select({ v: count() }).from(schema.products).get()?.v ?? 0,
    events: db.select({ v: count() }).from(schema.events).get()?.v ?? 0,
    news: db.select({ v: count() }).from(schema.news).get()?.v ?? 0,
    posts: db.select({ v: count() }).from(schema.posts).get()?.v ?? 0,
    instructors: db.select({ v: count() }).from(schema.instructors).get()?.v ?? 0,
  };

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 0%, rgba(42,93,244,0.10), transparent 70%), linear-gradient(180deg, #F5F8FF 0%, #FFFFFF 100%)",
          }}
        />
        <div className="container-page py-20 md:py-24">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-[12px] font-medium text-brand-dark mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            建设成果汇报
          </div>
          <h1 className="text-[32px] md:text-[52px] font-semibold leading-[1.1] text-ink max-w-4xl">
            我们把这个魔方社群门户
            <br />
            做成了一个<span className="text-brand">真能跑通的平台</span>
          </h1>
          <p className="mt-6 text-[15px] md:text-[18px] leading-8 text-ink-2 max-w-2xl">
            从扫码进站、登录下单、解锁学习,到练习计时、社群交流、成就打卡与邀请裂变,全程在一个站里跑通。下面汇报目前做了什么
            —— 前端用户能看到的体验,后端在背后支撑的能力,以及全部页面入口。
          </p>
          <div className="mt-10 grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard icon={BookOpen} label="在架课程" value={`${counts.courses}`} hint="系统课 / 直播 / 私教 / 家教" />
            <StatCard icon={ShoppingCart} label="商城 SKU" value={`${counts.products}`} hint="竞速魔方 / 配件 / 周边 / 异形" />
            <StatCard icon={Trophy} label="赛事" value={`${counts.events}`} hint="官方赛 / 城市赛 / 线上挑战" />
            <StatCard icon={MessageSquare} label="社群帖子" value={`${counts.posts}`} hint="四大圈子内容沉淀" />
          </div>
        </div>
      </section>

      {/* 业务闭环 */}
      <Section
        eyebrow="完整闭环"
        title="一个用户是怎么从扫码走到成交的"
        subtitle="这 9 步是平台已经实现的真实流程,每一步都有对应的页面、数据与服务在支撑。"
      >
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
          {LOOP.map((s) => (
            <div key={s.n} className="rounded-[14px] border border-line bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand">
                  <s.icon size={18} />
                </span>
                <span className="text-[20px] font-semibold text-brand/30 leading-none">{s.n}</span>
              </div>
              <div className="text-[15px] font-semibold text-ink mb-1">{s.title}</div>
              <p className="text-[12.5px] leading-5 text-ink-3">{s.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 前端 */}
      <Section
        tone="soft"
        eyebrow="前端 用户能看到、能用的"
        title="把每个环节都做成了好用的页面"
        subtitle="不登录也能浏览课程、商城、赛事、社群;登录后下单、学习、发帖、邀请一气呵成。"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FRONTEND.map((f) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
          ))}
        </div>
      </Section>

      {/* 魔方垂直 + 学习成长 */}
      <Section
        eyebrow="魔方垂直 练习与学习"
        title="不止卖课,更是能练、能学、能拿证的地方"
        subtitle="计时打乱、算法字典、进阶路径、章节测验、时间戳笔记到结课证书,围绕魔方学习的工具一应俱全。"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CUBE_LEARN.map((f) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
          ))}
        </div>
      </Section>

      {/* 游戏化与留存 */}
      <Section
        tone="soft"
        eyebrow="游戏化 让人愿意每天回来"
        title="积分、成就、打卡、通知,一套留存闭环"
        subtitle="行为有积分、成长有徽章、坚持有热力图、互动有通知,收藏与会员价把用户留下来。"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ENGAGE.map((f) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
          ))}
        </div>
      </Section>

      {/* 后端 */}
      <Section
        eyebrow="后端 看不见但在支撑的"
        title="不只是好看,而是真能承载交易"
        subtitle="鉴权、支付、短信、存储、检索、日志、分成,这些能力在背后默默运转。"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BACKEND.map((f) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
          ))}
        </div>
      </Section>

      {/* 增长 / 运营基建 */}
      <Section
        tone="soft"
        eyebrow="增长 运营基建"
        title="精准引流与运营的工具箱"
        subtitle="二维码聚合码、自建埋点、优惠券邀请码、SEO,获客与转化的基建全部自带。"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GROWTH.map((f) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
          ))}
        </div>
      </Section>

      {/* 关键亮点 */}
      <Section eyebrow="关键亮点" title="这套实现与众不同的地方">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="rounded-[14px] border border-line bg-white p-6 flex gap-4">
              <span className="shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-md bg-brand text-white">
                <h.icon size={20} />
              </span>
              <div>
                <div className="text-[16px] font-semibold text-ink mb-1.5">{h.title}</div>
                <p className="text-[13.5px] leading-6 text-ink-3">{h.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 全部页面入口 */}
      <Section
        tone="soft"
        eyebrow="全部页面入口"
        title="站内导航摸不到的页面,这里都能进"
        subtitle="扫码落地、管理后台、讲师后台、系统路由这些不在主导航里的页面,这里集中列出,方便验收与演示。"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-start">
          {ROUTE_GROUPS.map((g) => (
            <div key={g.title} className="rounded-[14px] border border-line bg-white p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                  <g.icon size={16} className="text-brand" />
                  {g.title}
                </div>
                <Badge tone={g.tone}>{g.access}</Badge>
              </div>
              <div className="flex flex-col">
                {g.links.map((l) => (
                  <RouteRow key={l.href} link={l} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-[12.5px] leading-6 text-ink-3">
          扫码落地页为 noindex,真实场景由印在卡片上的二维码进入;管理后台默认密码 admin123,讲师后台需 instructor 角色;系统路由是给搜索引擎与 PWA 用的非页面资源。
        </p>
      </Section>

      {/* 下一步 */}
      <Section
        eyebrow="下一步"
        title="从能跑通,到能上规模"
        subtitle="当前支付 / 短信等外部系统多为内置模拟实现,流程已跑通,下一步把它们接成真实服务。"
      >
        <div className="rounded-[16px] border border-line bg-white p-6 md:p-7">
          <ul className="grid gap-4 sm:grid-cols-2">
            {TODO.map((t) => (
              <li key={t.title} className="flex gap-3">
                <Badge tone="warning">现为模拟 / 待办</Badge>
                <div>
                  <div className="text-[14.5px] font-semibold text-ink">{t.title}</div>
                  <p className="text-[13px] leading-6 text-ink-3 mt-0.5">{t.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* CTA */}
      <section className="py-20 md:py-24">
        <div className="container-page">
          <div className="rounded-[20px] bg-brand text-white p-10 md:p-14 overflow-hidden relative">
            <div aria-hidden className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10" />
            <div aria-hidden className="absolute -right-24 bottom-0 h-64 w-64 rounded-full bg-white/5" />
            <div className="relative max-w-2xl">
              <div className="text-[12px] uppercase tracking-widest opacity-80 mb-3">现在就能体验</div>
              <h2 className="text-[26px] md:text-[36px] font-semibold leading-tight">
                以上都不是概念稿,点开即可亲自跑一遍
              </h2>
              <p className="mt-3 text-white/85 text-[15px] leading-7">
                平台已在线运行,数据会真实保存。建议从课程或扫码落地页开始,体验一次完整流程。
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button href="/" variant="secondary" size="lg" className="bg-white text-brand border-white hover:bg-white/90 hover:text-brand">
                  回到首页 <ArrowRight size={16} />
                </Button>
                <Button href="/qr/demo-landing" variant="ghost" size="lg" className="text-white hover:bg-white/10">
                  看扫码落地页
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function RouteRow({ link }: { link: RouteLink }) {
  const cls =
    "group flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-[13px] text-ink-2 hover:bg-bg-soft hover:text-brand transition";
  const body = (
    <>
      <span className="truncate">{link.label}</span>
      <span className="shrink-0 font-mono text-[11.5px] text-ink-3 group-hover:text-brand/70">
        {link.href}
      </span>
    </>
  );
  return link.ext ? (
    <a href={link.href} target="_blank" rel="noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <Link href={link.href} className={cls}>
      {body}
    </Link>
  );
}
