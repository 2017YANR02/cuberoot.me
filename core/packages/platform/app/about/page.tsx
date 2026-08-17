import { User, BarChart3, Code2, Target, ShieldCheck, Sparkles } from "lucide-react";
import { Section } from "@/components/Section";
import { Button } from "@/components/Button";

export const metadata = { title: "关于我们 — 魔方开放社群" };

const FOUNDERS = [
  {
    icon: User,
    role: "合伙人 A · CEO",
    title: "项目总负责人",
    bullets: [
      "负责整体战略、融资、对外合作及团队管理。",
      "拥有丰富的项目操盘和运营管理经验,统筹全局。",
    ],
  },
  {
    icon: BarChart3,
    role: "合伙人 B · COO",
    title: "流量与资金负责人",
    bullets: [
      "负责电商流量落地、资金支持及供应链资源整合。",
      "拥有强大的电商资源和雄厚的资金实力,保障项目高效运转。",
    ],
  },
  {
    icon: Code2,
    role: "合伙人 C · CTO/CPO",
    title: "技术与内容负责人",
    bullets: [
      "负责魔方技术体系搭建、平台系统开发及专业教学内容生产。",
      "资深魔方玩家,拥有深厚的技术背景和全栈开发能力。",
    ],
  },
];

const VALUES = [
  { icon: Target, title: "用户优先", desc: "以学员的学习体验和成长为最终衡量标准。" },
  { icon: ShieldCheck, title: "专业可靠", desc: "课程内容、赛事承办、商品品质三条线坚持高门槛。" },
  { icon: Sparkles, title: "开放生态", desc: "对讲师、玩家、商家全部开放,共建魔方综合生态。" },
];

export default function AboutPage() {
  return (
    <>
      <Section
        eyebrow="关于我们"
        title="一站式魔方垂直综合服务平台"
        subtitle="魔方开放社群致力于打造集精准流量、系统教学、教培、商城、赛事、高阶交流于一体的开放式兴趣社群。"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-[14px] border border-line bg-white p-6">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-brand-soft text-brand">
                <v.icon size={18} />
              </div>
              <div className="text-[15px] font-semibold text-ink mb-2">{v.title}</div>
              <p className="text-[13px] leading-6 text-ink-3">{v.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="soft" eyebrow="核心团队" title="创始团队与责任分工">
        <div className="grid gap-5 md:grid-cols-3">
          {FOUNDERS.map((f) => (
            <div key={f.role} className="rounded-[14px] border border-line bg-white p-6">
              <div className="border-t-2 border-brand -mt-6 -mx-6 mb-5" />
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-brand-soft text-brand">
                <f.icon size={18} />
              </div>
              <div className="text-[16px] font-semibold text-ink">{f.role}</div>
              <div className="text-[13px] text-ink-3 mt-1 mb-4">{f.title}</div>
              <ul className="space-y-2 text-[13px] leading-6 text-ink-2">
                {f.bullets.map((b) => <li key={b}>· {b}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="发展规划" title="短期 · 中期 · 长期 三阶段">
        <div className="grid gap-4 md:grid-cols-3">
          <Stage phase="01" time="1–3 个月" title="基础搭建与冷启动" desc="完成平台技术与运营框架的全面搭建,落地包裹卡精准引流,启动常态化直播矩阵。" />
          <Stage phase="02" time="6–12 个月" title="业务拓展与模式验证" desc="高阶课程上线,标准化赛事运营,主要城市线下家教网络覆盖。" />
          <Stage phase="03" time="长期" title="品牌塑造与生态闭环" desc="树立行业标杆,全国复制成功的单城市模式,构建完整商业生态闭环。" />
        </div>
        <div className="mt-10 text-center">
          <Button href="/instructors/apply" size="lg">加入我们 · 讲师入驻</Button>
        </div>
      </Section>
    </>
  );
}

function Stage({ phase, time, title, desc }: { phase: string; time: string; title: string; desc: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-white p-6">
      <div className="text-[28px] font-semibold text-brand leading-none">{phase}</div>
      <div className="mt-3 text-[13px] text-ink-3">{time}</div>
      <div className="mt-1 text-[16px] font-semibold text-ink">{title}</div>
      <p className="mt-3 text-[13px] leading-6 text-ink-3">{desc}</p>
    </div>
  );
}
