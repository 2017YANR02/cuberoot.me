import Link from "next/link";
import {
  BookOpen,
  Radio,
  MapPin,
  ShoppingCart,
  Trophy,
  MessageSquare,
  Zap,
  Layers,
  Users,
  Database,
  TrendingUp,
  BarChart3,
  Target,
  Gem,
  ArrowRight,
} from "lucide-react";
import { Section } from "@/components/Section";
import { Button } from "@/components/Button";
import { FeatureCard } from "@/components/FeatureCard";
import { StatCard } from "@/components/StatCard";

const BUSINESS = [
  { icon: BookOpen, title: "魔方全体系教学", description: "从入门到 CFOP、盲拧、ZBLL 等高阶玩法的系统化课程,全方位提升玩家实力。" },
  { icon: Radio, title: "线上直播授课", description: "采用实时互动直播形式,提供沉浸式、高互动性的在线教学体验,打破时空限制。" },
  { icon: MapPin, title: "线下家教对接", description: "搭建全国性线下家教网络,精准匹配学员与本地专业教练,提供面对面指导。" },
  { icon: ShoppingCart, title: "魔方器材周边", description: "官方商城直供,精选高品质专业魔方、竞速配件及原创文创周边,满足玩家多元需求。" },
  { icon: Trophy, title: "赛事发布与承办", description: "打造自有品牌赛事 IP,同时专业承接各类商业推广赛、校园争霸赛及社群交流赛。" },
  { icon: MessageSquare, title: "高阶玩家技术交流", description: "构建高活跃度线上社群,汇聚全国顶尖高手,定期举办技术研讨,推动玩法创新。" },
];

const ADVANTAGES = [
  { icon: Zap, title: "流量优势", description: "独创 NFC + 二维码 + 电商包裹 + 直播多渠道精准引流,获客成本远低于行业平均水平。" },
  { icon: BookOpen, title: "内容优势", description: "构建从入门到高阶全覆盖的主流魔方解法体系,内容专业度高且更新迭代快。" },
  { icon: Layers, title: "模式优势", description: "采用创新讲师分成 + 轻资产运营模式,保持零固定人力成本同时快速整合师资。" },
  { icon: Target, title: "闭环优势", description: "打通内容 + 教学 + 商城 + 赛事 + 家教 + 社群六大业务板块,实现全链路闭环。" },
];

const PAIN_POINTS: { pain: string; cure: string }[] = [
  { pain: "学习碎片化:教程零散、缺乏体系,自学效率极低", cure: "系统化教学:从入门到竞技高阶的完整课程体系" },
  { pain: "服务不闭环:教学、购物、赛事、交流环节完全割裂", cure: "一站式平台:整合教学、商城、赛事报名与社群交流" },
  { pain: "优质师资稀缺:专业教练分散,缺统一管理与认证", cure: "讲师合作平台:统一入驻、专业管理和透明分成体系" },
  { pain: "赛事信息闭塞:信息不透明,缺少专业承办与商业包装", cure: "专业赛事运营:统一发布、承办并进行商业化包装与推广" },
  { pain: "流量获取单一:行业依赖传统获客方式,效率低且成本高", cure: "创新流量入口:电商包裹植入、NFC 卡片等方式精准获客" },
];

const MILESTONES = [
  { phase: "01 短期", time: "1–3 个月", title: "基础搭建与冷启动", description: "完成平台技术与运营框架的全面搭建,落地包裹卡精准引流,启动常态化直播矩阵,快速完成首批种子用户的积累与初步运营沉淀。" },
  { phase: "02 中期", time: "6–12 个月", title: "业务拓展与模式验证", description: "打磨并上线高阶魔方课程体系,建立标准化赛事运营能力并常态化承接各类赛事,持续扩大专业讲师团队规模,完成主要城市线下家教服务网络的初步覆盖。" },
  { phase: "03 长期", time: "长期", title: "品牌塑造与生态闭环", description: "树立行业标杆,打造国内头部魔方社群品牌;将成功的单城市模式进行标准化全国复制;整合上下游资源,构建教学-赛事-社交-周边完整的商业生态闭环。" },
];

export default function HomePage() {
  return (
    <>
      <Hero />

      <Section
        eyebrow="项目定位"
        title="国内领先的一站式魔方垂直综合服务平台"
        subtitle="致力于打造集精准流量、系统教学、教培、商城、赛事、高阶交流于一体的开放式兴趣社群,成为魔方爱好者的首选聚集地和成长家园。"
        align="center"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <ValueCard icon={Users} title="对用户" text="整合碎片化资源,提供一站式、高品质的学习与交流体验。" />
          <ValueCard icon={Layers} title="对行业" text="解决资源分散、服务不闭环、师资稀缺等痛点,树立行业标杆。" />
          <ValueCard icon={MessageSquare} title="对伙伴" text="为教练提供轻资产合作平台,为品牌方提供精准营销渠道。" />
        </div>
      </Section>

      <Section
        tone="soft"
        eyebrow="核心业务矩阵"
        title="覆盖用户全生命周期需求的多元化业务生态"
        subtitle="我们构建了 6 大核心业务板块,从内容、教学到商品、赛事、社群,实现全链路闭环。"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BUSINESS.map((b) => (
            <FeatureCard key={b.title} icon={b.icon} title={b.title} description={b.description} />
          ))}
        </div>
      </Section>

      <Section eyebrow="行业洞察" title="行业痛点即是我们的机会">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[14px] border border-line bg-white p-6">
            <div className="text-[15px] font-semibold text-ink mb-4 flex items-center gap-2">
              <Target size={18} className="text-brand" /> 行业现存痛点
            </div>
            <ul className="space-y-3">
              {PAIN_POINTS.map((p) => (
                <li key={p.pain} className="text-[14px] leading-6 text-ink-2">{p.pain}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-[14px] bg-brand p-6 text-white">
            <div className="text-[15px] font-semibold mb-4 flex items-center gap-2">
              <Zap size={18} /> 我们的解决方案
            </div>
            <ul className="space-y-3">
              {PAIN_POINTS.map((p) => (
                <li key={p.cure} className="text-[14px] leading-6 text-white/90">{p.cure}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section
        tone="soft"
        eyebrow="市场机遇"
        title="一个高速增长的蓝海赛道"
        subtitle="魔方已从传统玩具升级为融合竞技、培训和社交的综合性赛道,市场空间巨大、增长潜力无限。"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard icon={Database} label="整体市场规模 (TAM)" value="65–70 亿元" hint="预计到 2025 年中国魔方全产业链规模" />
          <StatCard icon={TrendingUp} label="行业年均增速 (CAGR)" value="12% – 15%" hint="行业长期保持稳健增长态势" />
          <StatCard icon={BarChart3} label="核心板块增速" value="20% +" hint="教培、竞速竞技等细分领域表现尤为突出" />
        </div>
        <div className="mt-6 rounded-[14px] bg-brand p-6 text-white">
          <div className="flex items-start gap-3">
            <Gem size={20} className="shrink-0 mt-0.5" />
            <p className="text-[14px] leading-6">
              <span className="font-semibold mr-1">核心洞察:</span>
              市场已从传统玩具升级为综合赛道,赛道空白明显。凭借独特的商业模式与先发优势,我们将快速占领市场,成为行业领跑者。
            </p>
          </div>
        </div>
      </Section>

      <Section eyebrow="核心竞争力" title="为什么是我们">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ADVANTAGES.map((a) => (
            <FeatureCard key={a.title} icon={a.icon} title={a.title} description={a.description} />
          ))}
        </div>
      </Section>

      <Section tone="soft" eyebrow="发展路径" title="三阶段里程碑">
        <div className="grid gap-4 md:grid-cols-3">
          {MILESTONES.map((m) => (
            <div key={m.phase} className="rounded-[14px] border border-line bg-white p-6">
              <div className="border-t-2 border-brand -mt-6 -mx-6 mb-5" />
              <div className="text-[13px] text-brand font-medium">{m.phase}</div>
              <div className="text-[15px] text-ink-2 mt-1 mb-3">{m.time} · {m.title}</div>
              <p className="text-[14px] leading-6 text-ink-3">{m.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <CTA />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, rgba(42,93,244,0.10), transparent 70%), linear-gradient(180deg, #F5F8FF 0%, #FFFFFF 100%)",
        }}
      />
      <div className="container-page py-20 md:py-28 grid gap-10 md:grid-cols-[1.1fr_0.9fr] items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-[12px] font-medium text-brand-dark mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            一站式魔方垂直综合服务平台
          </div>
          <h1 className="text-[34px] md:text-[52px] font-semibold leading-[1.1] text-ink">
            汇聚热爱 · 连接你我<br />
            <span className="text-brand">共同进步</span>
          </h1>
          <p className="mt-5 text-[15px] md:text-[17px] leading-7 text-ink-2 max-w-xl">
            从入门教学到高阶 CFOP / 盲拧 / ZBLL,从赛事承办到讲师入驻,
            打造完整的"教学-赛事-社交-周边"商业生态闭环。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/courses" size="lg">
              开始学习 <ArrowRight size={16} />
            </Button>
            <Button href="/about" variant="secondary" size="lg">了解项目</Button>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
            <HeroStat value="65–70亿" label="行业规模" />
            <HeroStat value="1.8亿" label="潜在学员" />
            <HeroStat value="6 大" label="业务板块" />
          </div>
        </div>

        <div className="relative">
          <CubeArt />
        </div>
      </div>
    </section>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-[20px] md:text-[24px] font-semibold text-ink">{value}</div>
      <div className="text-[12px] text-ink-3 mt-1">{label}</div>
    </div>
  );
}

function ValueCard({ icon: Icon, title, text }: { icon: typeof Users; title: string; text: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-white p-6">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand">
        <Icon size={18} />
      </div>
      <div className="text-[15px] font-semibold text-ink mb-2">{title}</div>
      <p className="text-[13px] leading-6 text-ink-3">{text}</p>
    </div>
  );
}

function CubeArt() {
  return (
    <div className="aspect-square w-full max-w-[480px] mx-auto rounded-[20px] bg-white border border-line p-8 grid place-items-center">
      <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden>
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3D6FF7" />
            <stop offset="100%" stopColor="#2A5DF4" />
          </linearGradient>
        </defs>
        <g transform="translate(100 100)">
          <polygon points="0,-60 52,-30 52,30 0,60 -52,30 -52,-30" fill="#EAF0FE" stroke="#2A5DF4" strokeWidth="1.5" />
          <polygon points="0,-60 52,-30 0,0 -52,-30" fill="url(#g1)" />
          <polygon points="52,-30 52,30 0,60 0,0" fill="#2A5DF4" opacity="0.85" />
          <polygon points="-52,-30 0,0 0,60 -52,30" fill="#2A5DF4" opacity="0.6" />
          <line x1="0" y1="0" x2="0" y2="60" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
          <line x1="-26" y1="-15" x2="26" y2="-15" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
          <line x1="26" y1="-15" x2="26" y2="45" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
          <line x1="-26" y1="-15" x2="-26" y2="45" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
        </g>
      </svg>
    </div>
  );
}

function CTA() {
  return (
    <section className="py-20 md:py-24">
      <div className="container-page">
        <div className="rounded-[20px] bg-brand text-white p-10 md:p-14 overflow-hidden relative">
          <div aria-hidden className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10" />
          <div aria-hidden className="absolute -right-24 bottom-0 h-64 w-64 rounded-full bg-white/5" />
          <div className="relative max-w-2xl">
            <div className="text-[13px] uppercase tracking-widest opacity-80 mb-3">Join the Community</div>
            <h2 className="text-[28px] md:text-[36px] font-semibold leading-tight">
              加入魔方开放社群,与全国玩家共同进步
            </h2>
            <p className="mt-3 text-white/85 text-[15px] leading-7">
              不论你是入门新手、竞速选手、还是潜在合作伙伴,我们都准备好了一站式的服务和支持。
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/courses"
                className="rounded-md bg-white text-brand px-5 py-2.5 text-[14px] font-medium hover:bg-white/90 transition"
              >
                浏览课程
              </Link>
              <Link
                href="/instructors/apply"
                className="rounded-md border border-white/40 px-5 py-2.5 text-[14px] font-medium hover:bg-white/10 transition"
              >
                讲师入驻
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
