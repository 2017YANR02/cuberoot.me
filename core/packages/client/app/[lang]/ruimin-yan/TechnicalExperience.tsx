import AppLink from '@/components/AppLink';
import { tr } from '@/i18n/tr';

const ACHIEVEMENTS = [
  {
    outcome: {
      zh: '将三阶求解器的阶段分析耗时降低 58%。',
      en: 'Reduced 3×3 stage-analysis runtime by 58%.',
    },
    detail: {
      zh: '为 Rust 原生分析器引入 61.38 GiB 剪枝表，将每千条打乱的暖缓存基准中位耗时从 2.08 秒降至 0.88 秒，93,000 个距离值与基线一致。',
      en: 'Introduced a 61.38 GiB pruning table in the native Rust analyzer, cutting median warm-cache runtime for 1,000 scrambles from 2.08 s to 0.88 s. All 93,000 distance values matched the baseline.',
    },
    href: '/dev/solvers',
    link: { zh: '求解器基准', en: 'Solver benchmark' },
  },
  {
    outcome: {
      zh: '将 Web 与 API 解耦，构建五端共享的应用架构。',
      en: 'Decoupled the web app and API and built a shared architecture for five platforms.',
    },
    detail: {
      zh: '拆分 Next.js、Hono/PostgreSQL API 和离线计算任务的部署边界。将业务逻辑与 React 界面复用于 iOS、Android、鸿蒙、macOS 和 Windows，蓝牙等系统能力由各端宿主适配。',
      en: 'Separated deployment of the Next.js web app, Hono/PostgreSQL API, and offline compute jobs. Shared a React product layer across iOS, Android, HarmonyOS, macOS, and Windows, with platform adapters for Bluetooth and other native capabilities.',
    },
    href: '/dev/architecture',
    link: { zh: '系统架构', en: 'System architecture' },
  },
  {
    outcome: {
      zh: '搭建 WCA 比赛数据与打乱分析管道。',
      en: 'Built data pipelines for WCA results and scramble analysis.',
    },
    detail: {
      zh: '用 TypeScript 和 SQL 增量更新排名、纪录和比赛趋势。通过断点续跑与内存预算运行长时间求解任务，将真实比赛打乱转化为可查询的阶段最短步数分布。',
      en: 'Built incremental TypeScript and SQL jobs for rankings, records, and competition trends. Used checkpointing and memory budgets to turn long-running solver jobs on real competition scrambles into queryable distributions of optimal stage lengths.',
    },
    href: '/scramble/stats',
    link: { zh: '打乱统计', en: 'Scramble statistics' },
  },
  {
    outcome: {
      zh: '打通智能魔方从动作采集到计时和复盘的链路。',
      en: 'Connected smart-cube move capture to timing and solve reconstruction.',
    },
    detail: {
      zh: '将多品牌 BLE 协议接入统一的动作与状态模型，供浏览器和原生应用复用。将动作序列关联到计时与比赛成绩，支持 3D 实况、逐步回放和同打乱对照。',
      en: 'Unified multiple BLE protocols into a shared move and state model for browsers and native apps. Linked move sequences to timing and competition results to support live 3D visualization, step-by-step replay, and same-scramble comparisons.',
    },
    href: '/recon-about',
    link: { zh: '复盘系统', en: 'Reconstruction system' },
  },
  {
    outcome: {
      zh: '推导并验证 583,284 个三阶 LSLL 等价类。',
      en: 'Derived and verified 583,284 equivalence classes for 3×3 LSLL.',
    },
    detail: {
      zh: '用群作用和 Burnside 引理完成计数，逐类枚举复核，并将规范化后的局面用于末槽与顶层公式的检索和训练。',
      en: 'Counted last-slot-plus-last-layer cases using group actions and Burnside’s lemma, verified the counts by enumeration, and used canonical states for algorithm lookup and training.',
    },
    href: '/math/lsll',
    link: { zh: '数学推导', en: 'Mathematical derivation' },
  },
];

export default function TechnicalExperience() {
  return (
    <section className="ruimin-technical" aria-labelledby="ruimin-technical-heading">
      <div className="ruimin-section-label">
        <h2 id="ruimin-technical-heading">{tr({ zh: '技术经历', en: 'Engineering Experience' })}</h2>
      </div>
      <div>
        <h3 className="ruimin-technical-role">
          {tr({ zh: '魔方根（CubeRoot）· 创始人', en: 'CubeRoot · Founder' })}
        </h3>
        <p className="ruimin-technical-summary">
          {tr({
            zh: '负责魔方求解引擎、比赛数据平台与跨端训练产品的研发和交付。',
            en: 'Lead development and delivery of puzzle-solving engines, competition data systems, and cross-platform training tools.',
          })}
        </p>
        <ul className="ruimin-technical-projects">
          {ACHIEVEMENTS.map(({ outcome, detail, href, link }) => (
            <li key={href}>
              <strong>{tr(outcome)}</strong>{' '}
              {tr(detail)}{' '}
              <AppLink href={href}>{tr(link)}</AppLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
