import { ArrowUpRight, BookOpen, ChartNoAxesColumnIncreasing, ChevronDown, Code2, Users } from 'lucide-react';
import AppLink from '@/components/AppLink';
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
  { Icon: Users, href: '/contact', linkLabel: { zh: '查看创作者账号', en: 'View creator channels' }, title: { zh: '内容触达', en: 'Distribution' }, tagline: { zh: '约 50 万关注的推广基础', en: 'An audience of ~500K aggregate follows' }, body: { zh: '通过自己的专题内容接触训练用户，直接获得使用反馈。实际获客优势按到访、练习和留存核算。', en: 'Reach practitioners through focused content and gather feedback directly. Measure acquisition advantages through visits, practice and retention.' } },
  { Icon: BookOpen, href: '/about/ruimin#ruimin-profile-heading', linkLabel: { zh: '查看教学与著作经历', en: 'Read the teaching and author profile' }, title: { zh: '专业教学', en: 'Teaching' }, tagline: { zh: '把分析变成下一步怎么练', en: 'Turn analysis into the next practice step' }, body: { zh: '参赛、课程、公式库与著作积累，帮助把专业问题转换成用户能够理解、完成的训练方法。', en: 'Competition, courses, algorithms and authorship help turn specialist issues into understandable, achievable practice.' } },
  { Icon: Code2, href: '/achievements', linkLabel: { zh: '体验原创成果', en: 'Explore original work' }, title: { zh: '原创技术与 AI 编程', en: 'Original work & AI coding' }, tagline: { zh: '缩短开发周期，加快产品迭代', en: 'Shorter development cycles, faster iteration' }, body: { zh: '创始人将魔方专业知识与 Codex 等 AI 编程工具结合，加快功能实现、问题排查与维护，缩短从需求到可用版本的周期。小团队因此能更快响应用户反馈，持续改进求解、训练与复盘工具；专业判断、算法校验与发布质量由团队负责。', en: 'The founder combines cubing expertise with AI coding tools such as Codex to speed up implementation, debugging and maintenance, shortening the path from a requirement to a usable release. This helps a small team respond to feedback and improve solving, training and reconstruction, while retaining responsibility for domain decisions, algorithm validation and release quality.' } },
  { Icon: ChartNoAxesColumnIncreasing, href: '/contact', linkLabel: { zh: '查看社群介绍', en: 'Explore the community directory' }, title: { zh: '长期服务', en: 'Lasting service' }, tagline: { zh: '教师社群与机构需求的连接', en: 'A teacher community connected to educator needs' }, body: { zh: '创始人运营约 500 人的魔方老师群，并与部分机构洽谈合作。通过教学反馈与试用，持续完善机构服务。', en: 'The founder runs a teacher group of about 500 members and is in discussions with some institutions. Teaching feedback and trials help improve educator services.' } },
];

export default function InvestorStory() {
  return <>
    <section id="bp-competition" className="overview-section overview-wrap" aria-labelledby="overview-competition-title">
      <p className="overview-kicker">{tr({ zh: '竞争与定位', en: 'Competition & positioning' })}</p>
      <h2 id="overview-competition-title">{tr({ zh: '内容、工具与服务，\n共同构成切入点。', en: 'Content, tools and service.\nA combined starting point.' })}</h2>
      <div className="bp-rival-grid">{COMPETITORS.map(({ name, url, focus, implication }, index) => <article data-site-surface="panel" className={url ? 'bp-rival' : 'bp-rival bp-rival-own'} key={name}>
        <span className="bp-rival-mark" aria-hidden>{['XC', 'AI', '根'][index]}</span>
        <h3>{name === 'CubeRoot' ? tr({ zh: '魔方根', en: 'CubeRoot' }) : name}</h3>
        <p>{tr(focus)}</p>
        {url && <a href={url} target="_blank" rel="noopener noreferrer" className="overview-text-link">{tr({ zh: '查看官方介绍', en: 'Official introduction' })}<ArrowUpRight size={15} aria-hidden /></a>}
        <details className="bp-rival-detail"><summary>{tr({ zh: '竞争判断', en: 'Competitive implications' })}<ChevronDown size={15} aria-hidden /></summary><p>{tr(implication)}</p></details>
      </article>)}</div>
      <p className="bp-conclusion">{tr({ zh: '已有内容触达 → 高频训练工具 → 专业会员服务。竞争重点是长期选择与交付质量。', en: 'Existing distribution → frequent training tools → specialist membership. Compete on lasting choice and delivery quality.' })}</p>
      <details className="bp-detail"><summary>{tr({ zh: '竞争逻辑与资料来源', en: 'Competition rationale & sources' })}<ChevronDown size={18} aria-hidden /></summary><div className="bp-detail-body"><p>{tr({ zh: 'XC大师与 AI_CFOP 已经提供训练与分析能力，市场也有成熟的免费计时器和教程。魔方根把内容触达、专业教学和日常工具结合起来：约 50 万关注提供推广渠道，计时器与训练器承接持续练习，个人与企业会员承接专业帮助和教学服务。', en: 'Existing competitors provide training and analysis alongside mature free timers and lessons. CubeRoot combines distribution, teaching and daily tools: an audience supports promotion, tools support practice, and memberships support specialist and educator services.' })}</p><p>{tr({ zh: '魔方工具生态还包括 CubeSkills、J Perm、csTimer、CubingApp 和 GAN CubeStation，分别覆盖教程、计时、数据与智能训练。', en: 'The cubing-tool ecosystem also includes CubeSkills, J Perm, csTimer, CubingApp and GAN CubeStation.' })}</p><div className="bp-source-links">{[['https://www.cubeskills.com/','CubeSkills'],['https://jperm.net/','J Perm'],['https://cstimer.net/','csTimer'],['https://cubingapp.com/','CubingApp'],['https://cubestation.com/zh/','GAN CubeStation']].map(([href,label])=><a href={href} key={href} target="_blank" rel="noopener noreferrer">{label}<ArrowUpRight size={14} aria-hidden /></a>)}</div></div></details>
    </section>

    <section id="bp-advantages" className="overview-section overview-wrap" aria-labelledby="overview-advantage-title">
      <p className="overview-kicker">{tr({ zh: '优势与壁垒', en: 'Advantages & defensibility' })}</p>
      <h2 id="overview-advantage-title">{tr({ zh: '从内容触达，\n走到长期关系。', en: 'From content discovery\nto lasting relationships.' })}</h2>
      <div className="bp-moat-grid">{ADVANTAGES.map(({ Icon, title, tagline, body, href, linkLabel }, index) => <article data-site-surface="panel" key={title.en}><span className="bp-moat-index">0{index+1}</span><span className="bp-icon"><Icon size={30} strokeWidth={1.4} aria-hidden /></span><h3>{tr(title)}</h3><p>{tr(tagline)}</p><AppLink href={href} prefetch={false} target="_blank" rel="noopener noreferrer" className="overview-text-link">{tr(linkLabel)}<ArrowUpRight size={16} aria-hidden /></AppLink><details><summary>{tr({ zh: '优势依据', en: 'Supporting work' })}<ChevronDown size={15} aria-hidden /></summary><p>{tr(body)}</p></details></article>)}</div>
      <AppLink href="/achievements" prefetch={false} className="overview-text-link">{tr({ zh: '查看已做出的原创工作', en: 'Inspect the original work' })}<ArrowUpRight size={16} aria-hidden /></AppLink>
    </section>
  </>;
}
