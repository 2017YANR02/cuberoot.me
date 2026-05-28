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
  { n: "06", icon: GraduationCap, title: "解锁学习", desc: "付费墙校验,视频取流防盗链" },
  { n: "07", icon: Activity, title: "进度续看", desc: "学习进度自动保存,断点继续" },
  { n: "08", icon: MessageSquare, title: "社群交流", desc: "圈子发帖、评论、点赞" },
  { n: "09", icon: Share2, title: "邀请裂变", desc: "专属邀请码拉新,双向发券" },
];

const FRONTEND: Feature[] = [
  { icon: Zap, title: "SSG + RSC 秒开", description: "Next 16 App Router,服务端组件直出,首屏快、SEO 友好。" },
  { icon: Lock, title: "课程付费墙 + 视频", description: "已购校验决定可看范围,试看课免费,视频经取流接口防盗链。" },
  { icon: Activity, title: "学习进度续看", description: "播放进度按节流自动落库,我的课程一键跳到最近学到的一节。" },
  { icon: Search, title: "全站中文搜索", description: "SQLite FTS5 全文检索,自定义 CJK 分词,课程/商品/赛事/资讯/帖子统一搜。" },
  { icon: MessageSquare, title: "社群圈子", description: "新手/竞速/盲拧/校园四个圈子,发帖评论点赞,Markdown 正文。" },
  { icon: Smartphone, title: "PWA 可安装离线", description: "手写 Service Worker 缓存策略,可装到桌面,断网有离线兜底页。" },
  { icon: Layers, title: "移动端适配", description: "窄屏折叠导航、触摸交互,图表表格面板全部窄屏可用。" },
  { icon: Share2, title: "分享卡 OG 图", description: "详情页动态生成 1200×630 OG 图,微信/Twitter 分享有大图。" },
];

const BACKEND: Feature[] = [
  { icon: Database, title: "SQLite + Drizzle", description: "better-sqlite3 + Drizzle ORM 类型安全数据层,迁移与种子脚本齐全。" },
  { icon: ShieldCheck, title: "双端鉴权", description: "管理端 HMAC-SHA256 session,用户端手机号 OTP,proxy 路由守门。" },
  { icon: Send, title: "短信多 Provider", description: "console / 阿里云 / 腾讯云,手写 V3 签名零 SDK 依赖,缺配置自动降级。" },
  { icon: HardDrive, title: "存储多 Provider", description: "本地 / R2 / S3 / OSS / COS,手写 SigV4 / OSS / COS 签名,上传带真实进度。" },
  { icon: CreditCard, title: "支付多 Provider", description: "微信 V3 Native / 支付宝电脑网站 / Stripe Checkout,回调统一,可退款对账。" },
  { icon: Search, title: "FTS5 全文检索", description: "5 张虚拟表 + 15 触发器自动同步,CJK 自定义分词函数 cube_seg。" },
  { icon: BarChart3, title: "可观测日志", description: "错误日志兜底 + 慢请求(>500ms)埋点,后台分 Tab 查看。" },
  { icon: Wallet, title: "讲师分成结算", description: "讲师角色 + 课程归属,70% 固定分成月度汇总,后台审核入驻自动建号。" },
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
];

const TODO: { title: string; desc: string }[] = [
  { title: "真实支付商户", desc: "接入微信 / 支付宝正式商户,替换当前 mock 通道。" },
  { title: "视频真实签名 URL", desc: "远端存储签发带时效的防盗链地址。" },
  { title: "讲师结算落地", desc: "新增 instructor_payouts 表,把展示型收益变成可结算。" },
  { title: "短信真实通道", desc: "配置阿里云 / 腾讯云模板,替换 console 降级。" },
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
      { href: "/shop", label: "商城" },
      { href: "/events", label: "赛事" },
      { href: "/community", label: "社群" },
      { href: "/news", label: "资讯" },
      { href: "/instructors", label: "讲师" },
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
      { href: "/me/courses", label: "我的课程" },
      { href: "/me/invite", label: "我的邀请码" },
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
      { href: "/admin/courses", label: "课程管理" },
      { href: "/admin/products", label: "商品管理" },
      { href: "/admin/events", label: "赛事管理" },
      { href: "/admin/orders", label: "订单" },
      { href: "/admin/reconcile", label: "对账与流水" },
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
            从扫码进站、登录下单、解锁学习,到社群交流与邀请裂变,全程在一个站里跑通。下面汇报目前做了什么
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
