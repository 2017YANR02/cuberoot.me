import { ArrowUpRight, Bluetooth, BookOpen, ChartNoAxesColumnIncreasing, ChevronDown, Code2, Users } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { tr } from '@/i18n/tr';

const XC_URL = 'https://apps.apple.com/cn/app/id6758835520';

// Keep bilingual copy outside the table's JSX source frames. Next's development
// error highlighter can panic when truncating long lines containing UTF-8 text.
const COMPETITORS = [
  {
    name: { zh: 'GAN · 魔方星球', en: 'GAN · CubeStation' },
    mark: 'GAN',
    url: 'https://apps.apple.com/cn/app/id1524781423',
    focus: {
      zh: '围绕 GAN 智能硬件，提供课程、分步训练、数据分析、真人对战与线上赛事。',
      en: 'Courses, stage training, analysis, live battles and online events built around GAN smart hardware.',
    },
    implication: {
      zh: '硬件用户入口和赛事生态是其优势。魔方根从多品牌设备的共同训练需求切入，把自己的教学内容、工具与服务结合起来。',
      en: 'Its hardware customer base and event ecosystem are strengths. CubeRoot focuses on practice needs across supported brands, combining its own teaching content, tools and services.',
    },
  },
  {
    name: { zh: '魔域 · WCU CUBE', en: 'MoYu · WCU CUBE' },
    mark: 'WCU',
    url: 'https://wcucube.club/app',
    focus: {
      zh: '连接魔域智能魔方，覆盖计时、公式学习与排位赛；应用更新已加入 AI 助手和复盘分析。',
      en: 'Connects MoYu smart cubes for timing, algorithms and ranked matches; app updates add an AI assistant and reconstruction analysis.',
    },
    implication: {
      zh: '厂商也在增强 AI 与教学能力。魔方根需要用专业课程、持续训练体验和机构服务体现付费价值，单有 AI 功能不足以拉开差距。',
      en: 'Manufacturers are also expanding AI and teaching. CubeRoot must earn payment through specialist courses, sustained practice and educator services, beyond an AI feature alone.',
    },
  },
  {
    name: { zh: '奇艺魔方格 · Smart Player Pro', en: 'QiYi MoFangGe · Smart Player Pro' },
    mark: 'QY',
    url: 'https://apps.apple.com/us/app/smart-player-pro/id6444227033',
    focus: {
      zh: '奇艺智能魔方的配套应用，提供训练、成绩分析、在线对战与排行，也支持普通魔方计时。',
      en: 'A companion app for QiYi smart cubes, offering practice, performance analysis, online battles, rankings and conventional-cube timing.',
    },
    implication: {
      zh: '普通与智能魔方兼容已是共同方向。魔方根进一步连接课程、公式、求解和复盘，让老师与学员围绕具体训练问题使用同一套工具。',
      en: 'Conventional and smart-cube support is already a shared direction. CubeRoot connects courses, algorithms, solving and reconstruction around the practice needs of teachers and learners.',
    },
  },
  {
    name: { zh: 'XC大师', en: 'XC Master' },
    mark: 'XC',
    url: XC_URL,
    focus: {
      zh: '智能魔方练习、AI 分析、公式训练与跨品牌联网对战；商店介绍为免费。',
      en: 'Smart-cube practice, AI analysis, algorithm training and cross-brand online battles; listed as free.',
    },
    implication: {
      zh: '跨品牌连接也不是独有壁垒。魔方根需要把专业内容、训练工具与人工服务组合成值得持续付费的体验。',
      en: 'Cross-brand connectivity is not an exclusive moat either. CubeRoot needs to combine specialist content, practice tools and human support into an experience worth paying for.',
    },
  },
  {
    name: { zh: 'AI_CFOP', en: 'AI_CFOP' },
    mark: 'AI',
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
    name: { zh: '魔方根', en: 'CubeRoot' },
    mark: '根',
    url: null,
    focus: {
      zh: '普通魔方计时与多品牌智能三阶接入，结合教程、公式、求解和复盘；已有内容渠道与教师社群。',
      en: 'Conventional timing and multi-brand smart 3x3 support, with lessons, algorithms, solving and reconstruction, backed by creator and teacher communities.',
    },
    implication: {
      zh: '把训练需求转成课程、个人与机构订阅，并以持续使用、续费和服务质量积累优势。线上赛事作为下一步业务。',
      en: 'Turn practice needs into courses and individual and institutional subscriptions, building strength through continued use, renewals and service quality. Online events are the next planned business.',
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
      <h2 id="overview-competition-title">{tr({ zh: '智能硬件记录每一步。\n专业服务帮助下一步。', en: 'Smart hardware captures every move.\nExpert service helps with the next.' })}</h2>
      <div className="overview-review" data-site-surface="panel"><Bluetooth size={26} aria-hidden /><div>
        <h3>{tr({ zh: '智能魔方，让练习过程变成可分析的数据。', en: 'Smart cubes turn practice into data you can analyse.' })}</h3>
        <p>{tr({ zh: '魔方内置传感器，通过蓝牙记录转动和还原过程，帮助用户看清用时、步数与训练变化。GAN、魔域、奇艺都在布局智能硬件和配套应用，软件已成为训练与比赛的重要入口。魔方根的机会，是把这些数据与专业教学结合，帮助用户理解问题、继续练习。', en: 'Sensors and Bluetooth capture turns and solves, helping users understand times, move counts and changes in practice. GAN, MoYu and QiYi all offer smart hardware and companion apps, making software an important entry point for practice and competition. CubeRoot’s opportunity is to connect this data with specialist teaching that helps users understand problems and keep practising.' })}</p>
      </div></div>
      <div className="bp-rival-grid">{COMPETITORS.map(({ name, mark, url, focus, implication }) => <article data-site-surface="panel" className={url ? 'bp-rival' : 'bp-rival bp-rival-own'} key={name.en}>
        <span className="bp-rival-mark" aria-hidden>{mark}</span>
        <h3>{tr(name)}</h3>
        <p>{tr(focus)}</p>
        {url && <a href={url} target="_blank" rel="noopener noreferrer" className="overview-text-link">{tr({ zh: '查看官方介绍', en: 'Official introduction' })}<ArrowUpRight size={15} aria-hidden /></a>}
        {!url && <AppLink href="/timer" prefetch={false} className="overview-text-link">{tr({ zh: '体验魔方根计时器', en: 'Try the CubeRoot timer' })}<ArrowUpRight size={15} aria-hidden /></AppLink>}
        <details className="bp-rival-detail"><summary>{tr({ zh: '魔方根的切入点', en: 'CubeRoot’s approach' })}<ChevronDown size={15} aria-hidden /></summary><p>{tr(implication)}</p></details>
      </article>)}</div>
      <p className="bp-conclusion">{tr({ zh: '厂商拥有硬件渠道与赛事基础，独立工具也在快速迭代。魔方根把专业教学、跨品牌训练和已有内容渠道结合起来，用课程与持续服务创造商业价值。', en: 'Manufacturers bring hardware channels and event infrastructure; independent tools are also evolving. CubeRoot combines specialist teaching, cross-brand practice and existing distribution to create value through courses and continuing services.' })}</p>
      <details className="bp-detail"><summary>{tr({ zh: '已实现的智能魔方能力，以及如何形成收入', en: 'Current smart-cube capabilities and the path to revenue' })}<ChevronDown size={18} aria-hidden /></summary><div className="bp-detail-body">
        <div className="bp-detail-columns">
          <article><h3>{tr({ zh: '同一工具，接入多个品牌', en: 'Multiple brands, one practice tool' })}</h3><p>{tr({ zh: '计时器已接入 GAN、魔域、奇艺等品牌的部分智能三阶型号，支持转动记录、自动计时、三维状态和训练统计。具体连接能力取决于型号与浏览器蓝牙支持。', en: 'The timer integrates supported smart 3x3 models from GAN, MoYu, QiYi and other brands, with move recording, automatic timing, 3D state and practice statistics. Connectivity depends on the model and browser Bluetooth support.' })}</p><AppLink href="/timer" prefetch={false} className="overview-text-link">{tr({ zh: '打开计时器，查看蓝牙连接', en: 'Open the timer and Bluetooth connection' })}<ArrowUpRight size={15} aria-hidden /></AppLink></article>
          <article><h3>{tr({ zh: '从训练工具，走向进阶服务', en: 'From practice tools to specialist services' })}</h3><p>{tr({ zh: '个人围绕日常训练选择进阶会员和课程；机构围绕教学与课后练习选择订阅及课程服务。智能魔方让训练过程更容易记录和复盘，专业内容与服务交付决定用户是否愿意持续付费。', en: 'Individuals can choose advanced memberships and courses around daily practice; educators can choose subscriptions and course services for teaching and after-class work. Smart cubes make practice easier to record and review; content and service quality determine whether users continue to pay.' })}</p><div className="bp-source-links"><AppLink href="/membership" prefetch={false}>{tr({ zh: '个人与机构会员', en: 'Individual & institutional memberships' })}<ArrowUpRight size={14} aria-hidden /></AppLink><AppLink href="/courses" prefetch={false}>{tr({ zh: '课程内容', en: 'Courses' })}<ArrowUpRight size={14} aria-hidden /></AppLink></div></article>
        </div>
        <div className="bp-source-links"><a href="https://apps.apple.com/us/app/wcu-cube/id6499043308" target="_blank" rel="noopener noreferrer">{tr({ zh: 'WCU CUBE 功能与更新', en: 'WCU CUBE features & updates' })}<ArrowUpRight size={14} aria-hidden /></a><a href="https://www.qiyitoys.net/smartplayer/" target="_blank" rel="noopener noreferrer">{tr({ zh: '奇艺官方智能赛事', en: 'QiYi smart-cube events' })}<ArrowUpRight size={14} aria-hidden /></a><a href="https://regulations.topcubers.com/online_e/" target="_blank" rel="noopener noreferrer">{tr({ zh: '赛事方列出的设备与配套应用', en: 'Event organiser’s device & app guide' })}<ArrowUpRight size={14} aria-hidden /></a></div>
      </div></details>
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
