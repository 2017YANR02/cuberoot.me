import { ArrowUpRight, BookOpen, ChartNoAxesColumnIncreasing, ChevronDown, Code2, RotateCcw, ScanSearch, Timer, Users } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { VisualCube } from '@/components/VisualCube';
import { CREATOR_AUDIENCE } from '@/lib/creator-profile';
import { tr } from '@/i18n/tr';

const XC_URL = 'https://apps.apple.com/cn/app/id6758835520';

// Keep bilingual copy outside the table's JSX source frames. Next's development
// error highlighter can panic when truncating long lines containing UTF-8 text.
const COMPETITORS = [
  {
    name: 'XC大师',
    url: XC_URL,
    focus: {
      zh: '智能魔方练习、阶段分析、公式训练与联网对战；商店介绍为免费。',
      en: 'Smart-cube practice, stage analysis, algorithm training and online battles; listed as free.',
    },
    implication: {
      zh: '不能靠重复免费功能收费，需要交付更完整的学习与服务价值。',
      en: 'Paid value must extend beyond duplicating free features.',
    },
  },
  {
    name: 'AI_CFOP',
    url: 'https://aicfop.com/',
    focus: {
      zh: '智能魔方训练、复盘、统计与 AI 分析，官网列出多端。',
      en: 'Smart-cube training, reconstruction, statistics and AI analysis across multiple platforms.',
    },
    implication: {
      zh: 'AI 和多端本身不能构成独占优势，获客与长期使用同样重要。',
      en: 'AI and platform coverage alone are not exclusive advantages; acquisition and retention matter.',
    },
  },
  {
    name: 'CubeRoot',
    url: null,
    focus: {
      zh: '已有教程、公式、计时、复盘与数据工具；创始人自媒体合计约 50 万关注。',
      en: 'Existing lessons, algorithms, timing, reconstruction and data tools; founder reports about 500,000 aggregate follows.',
    },
    implication: {
      zh: '优先验证“内容引导 → 实际训练 → 反复使用 → 进阶服务”。',
      en: 'First validate content-led discovery, practice, repeat use and advanced services.',
    },
  },
];

const ADVANTAGES = [
  { Icon: Users, title: { zh: '内容触达', en: 'Distribution' }, tagline: { zh: '约 50 万关注的推广基础', en: 'An audience of ~500K aggregate follows' }, body: { zh: '通过自己的专题内容接触训练用户，直接获得使用反馈。实际获客优势按到访、练习和留存核算。', en: 'Reach practitioners through focused content and gather feedback directly. Measure acquisition advantages through visits, practice and retention.' } },
  { Icon: BookOpen, title: { zh: '专业教学', en: 'Teaching' }, tagline: { zh: '把分析变成下一步怎么练', en: 'Turn analysis into the next practice step' }, body: { zh: '参赛、课程、公式库与著作积累，帮助把专业问题转换成用户能够理解、完成的训练方法。', en: 'Competition, courses, algorithms and authorship help turn specialist issues into understandable, achievable practice.' } },
  { Icon: Code2, title: { zh: '原创技术', en: 'Original work' }, tagline: { zh: '可体验的求解与训练工具', en: 'Inspectable solvers and training tools' }, body: { zh: '求解、状态可视化、复盘与数据工具承接具体练习。持续维护算法正确性与稳定交付，AI 辅助研发。', en: 'Solving, visualisation, reconstruction and data tools support practice, with maintained correctness and reliable delivery. AI assists development.' } },
  { Icon: ChartNoAxesColumnIncreasing, title: { zh: '长期服务', en: 'Lasting service' }, tagline: { zh: '教师社群与机构需求的连接', en: 'A teacher community connected to educator needs' }, body: { zh: '创始人运营约 500 人的魔方老师群，并与部分机构洽谈合作。教学反馈、试用和服务经验可逐步积累；社群成员与洽谈对象不等于签约客户。', en: 'The founder runs a teacher group of about 500 members and is in discussions with some institutions. Feedback, trials and service experience can accumulate; group members and leads are not signed customers.' } },
];

export default function InvestorStory() {
  return <>
    <section id="bp-market" className="overview-section overview-wrap" aria-labelledby="overview-market-title">
      <p className="overview-kicker">{tr({ zh: '01 / 行业与高频需求', en: '01 / The recurring need' })}</p>
      <h2 id="overview-market-title">{tr({ zh: '每一次还原，\n都是下一次进步的起点。', en: 'Every solve is a starting point\nfor the next improvement.' })}</h2>
      <div className="bp-practice-stage" data-site-surface="panel">
        <div className="bp-practice-center"><VisualCube view="iso" algorithm="R U R' U'" size={210} local alt={tr({ zh: '魔方练习闭环的中心状态', en: 'A cube at the centre of a practice loop' })} /><strong>{tr({ zh: '持续练习', en: 'CONTINUED PRACTICE' })}</strong><span>{tr({ zh: '计时器 + 训练器', en: 'Timer + trainer' })}</span></div>
        <ol className="bp-practice-steps">{[
          { Icon: Timer, title: { zh: '练习与计时', en: 'Practise & time' }, body: { zh: '完成还原，记录表现', en: 'Solve and record performance' } },
          { Icon: ChartNoAxesColumnIncreasing, title: { zh: '记录与比较', en: 'Record & compare' }, body: { zh: '积累数据，看见变化', en: 'Build history and see changes' } },
          { Icon: ScanSearch, title: { zh: '复盘与反馈', en: 'Reflect & learn' }, body: { zh: '研究解法，发现薄弱环节', en: 'Study solutions and weak points' } },
          { Icon: RotateCcw, title: { zh: '再次练习', en: 'Practise again' }, body: { zh: '针对问题，持续训练', en: 'Address weaknesses over time' } },
        ].map(({ Icon, title, body }, index) => <li key={title.en}><span className="bp-icon"><Icon size={23} aria-hidden /></span><div><span className="bp-step-label">0{index + 1}</span><h3>{tr(title)}</h3><p>{tr(body)}</p></div></li>)}</ol>
      </div>
      <details className="bp-detail"><summary>{tr({ zh: '为什么这是长期需求？', en: 'Why is this a recurring need?' })}<ChevronDown size={18} aria-hidden /></summary><div className="bp-detail-body"><p>{tr({ zh: '对持续训练的选手，魔方是一项长期练习的竞技技能。选手反复还原、记录时间、研究解法和练习公式，争取更快、更稳定的成绩。计时器与训练器承接高频使用，教学、复盘和专业服务为练习提供方向。魔方根连接从学习到长期训练的任务。', en: 'Active competitors repeatedly solve, time, study solutions and practise algorithms for speed and consistency. Timers and trainers support frequent use, while lessons, reconstruction and specialist services guide the next steps. CubeRoot connects learning and lasting practice.' })}</p></div></details>
      <div className="overview-industry-note"><strong>1,864</strong><div><span className="bp-step-label">WCA 2025</span><p>{tr({ zh: '世界锦标赛参赛人数，体现跨地区赛事基础；不代表本站用户或付费市场。', en: 'World Championship competitors, illustrating international activity rather than site users or the paying market.' })} <a href="https://www.worldcubeassociation.org/competitions/WC2025" target="_blank" rel="noopener noreferrer">{tr({ zh: '官方来源 ↗', en: 'Official source ↗' })}</a></p></div></div>
    </section>

    <section id="bp-competition" className="overview-section overview-wrap" aria-labelledby="overview-competition-title">
      <p className="overview-kicker">{tr({ zh: '02 / 竞争与定位', en: '02 / Competition & positioning' })}</p>
      <h2 id="overview-competition-title">{tr({ zh: '内容、工具与服务，\n共同构成切入点。', en: 'Content, tools and service.\nA combined starting point.' })}</h2>
      <div className="bp-rival-grid">{COMPETITORS.map(({ name, url, focus, implication }, index) => <article data-site-surface="panel" className={url ? 'bp-rival' : 'bp-rival bp-rival-own'} key={name}>
        <span className="bp-rival-mark" aria-hidden>{['XC', 'AI', '根'][index]}</span>
        <h3>{name === 'CubeRoot' ? tr({ zh: '魔方根', en: 'CubeRoot' }) : name}</h3>
        <p>{tr(focus)}</p>
        {url && <a href={url} target="_blank" rel="noopener noreferrer" className="overview-text-link">{tr({ zh: '查看官方介绍', en: 'Official introduction' })}<ArrowUpRight size={15} aria-hidden /></a>}
        <details className="bp-rival-detail"><summary>{tr({ zh: '竞争判断', en: 'Competitive implications' })}<ChevronDown size={15} aria-hidden /></summary><p>{tr(implication)}</p></details>
      </article>)}</div>
      <p className="bp-conclusion">{tr({ zh: '已有内容触达 → 高频训练工具 → 专业会员服务。竞争重点是长期选择与交付质量。', en: 'Existing distribution → frequent training tools → specialist membership. Compete on lasting choice and delivery quality.' })}</p>
      <details className="bp-detail"><summary>{tr({ zh: '竞争逻辑与资料来源', en: 'Competition rationale & sources' })}<ChevronDown size={18} aria-hidden /></summary><div className="bp-detail-body"><p>{tr({ zh: 'XC大师与 AI_CFOP 已经提供训练与分析能力，市场也有成熟的免费计时器和教程。魔方根把内容触达、专业教学和日常工具结合起来：约 50 万关注提供推广渠道，计时器与训练器承接持续练习，个人与企业会员承接专业帮助和教学服务。', en: 'Existing competitors provide training and analysis alongside mature free timers and lessons. CubeRoot combines distribution, teaching and daily tools: an audience supports promotion, tools support practice, and memberships support specialist and educator services.' })}</p><p>{tr({ zh: '竞品按 2026-10-02 官方网站或商店介绍整理，未做性能优劣测试，不以关注数推断其用户或收入。生态还包括 CubeSkills、J Perm、csTimer、CubingApp 和 GAN CubeStation，分别覆盖教程、计时、数据与智能训练。', en: 'Descriptions use official sites or listings checked on 2026-10-02, not performance comparisons or follower-based revenue estimates. The ecosystem also includes CubeSkills, J Perm, csTimer, CubingApp and GAN CubeStation.' })}</p><div className="bp-source-links">{[['https://www.cubeskills.com/','CubeSkills'],['https://jperm.net/','J Perm'],['https://cstimer.net/','csTimer'],['https://cubingapp.com/','CubingApp'],['https://cubestation.com/zh/','GAN CubeStation']].map(([href,label])=><a href={href} key={href} target="_blank" rel="noopener noreferrer">{label}<ArrowUpRight size={14} aria-hidden /></a>)}</div></div></details>
    </section>

    <section id="bp-advantages" className="overview-section overview-wrap" aria-labelledby="overview-advantage-title">
      <p className="overview-kicker">{tr({ zh: '03 / 优势与壁垒', en: '03 / Advantages & defensibility' })}</p>
      <h2 id="overview-advantage-title">{tr({ zh: '从内容触达，\n走到长期关系。', en: 'From content discovery\nto lasting relationships.' })}</h2>
      <div className="bp-moat-grid">{ADVANTAGES.map(({ Icon, title, tagline, body }, index) => <article data-site-surface="panel" key={title.en}><span className="bp-moat-index">0{index+1}</span><span className="bp-icon"><Icon size={30} strokeWidth={1.4} aria-hidden /></span><h3>{tr(title)}</h3><p>{tr(tagline)}</p><details><summary>{tr({ zh: '优势依据', en: 'Supporting work' })}<ChevronDown size={15} aria-hidden /></summary><p>{tr(body)}</p></details></article>)}</div>
      <p className="overview-small">{tr(CREATOR_AUDIENCE.summary)}{tr({ zh: '，本人 2026 年 10 月确认，平台间未去重。组合优势通过真实使用与服务效果逐步积累为壁垒。', en: ', owner-confirmed in October 2026 and not deduplicated. Retention and useful delivery must turn the combined starting point into defensibility.' })}</p>
      <AppLink href="/achievements" prefetch={false} className="overview-text-link">{tr({ zh: '查看已做出的原创工作', en: 'Inspect the original work' })}<ArrowUpRight size={16} aria-hidden /></AppLink>
    </section>
  </>;
}
