import { ArrowUpRight, BookOpen, ChartNoAxesColumnIncreasing, Code2, Users } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { CREATOR_AUDIENCE } from '@/lib/creator-profile';
import { tr } from '@/i18n/tr';
import '@/components/sticky-table.css';

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

export default function InvestorStory() {
  return <>
    <section className="overview-section overview-wrap" aria-labelledby="overview-market-title">
      <p className="overview-kicker">{tr({ zh: '01 / 先理解这个需求', en: '01 / Understand the need' })}</p>
      <h2 id="overview-market-title">{tr({ zh: '学会还原之后，\n还有一条持续进步的路。', en: 'The first solve is a beginning.\nProgress takes practice.' })}</h2>
      <p className="overview-intro">{tr({ zh: '可以把它理解为一种需要练习和反馈的技能：教程告诉人怎么做，训练记录让人看到变化，复盘帮助人找到下一步该练什么。CubeRoot 希望把这几件事连接起来，让学习之后的练习更有方向。', en: 'Think of cubing as a skill that needs practice and feedback. Lessons explain what to do, records reveal change, and solve analysis helps people choose what to practise next. CubeRoot aims to connect these steps.' })}</p>
      <ol className="overview-learning-path">{[
        { title: { zh: '第一次还原', en: 'First solve' }, body: { zh: '需要讲得明白的教程', en: 'Clear explanations' } },
        { title: { zh: '练得更稳定', en: 'Consistent practice' }, body: { zh: '需要记录与练习方法', en: 'Records and practice methods' } },
        { title: { zh: '找到薄弱环节', en: 'Find weak points' }, body: { zh: '需要分析与具体反馈', en: 'Analysis and useful feedback' } },
        { title: { zh: '长期学习与参赛', en: 'Keep learning' }, body: { zh: '需要老师、资料与赛事信息', en: 'Teachers, resources and events' } },
      ].map((item, index) => <li key={item.title.en}><span>0{index + 1}</span><h3>{tr(item.title)}</h3><p>{tr(item.body)}</p></li>)}</ol>
      <div className="overview-industry-note"><strong>1,864</strong><p>{tr({ zh: '2025 年 WCA 世界锦标赛的参赛人数。魔方已经有跨地区的赛事与公开成绩体系，相关产品也覆盖教程、计时、训练和分析。这个数字说明赛事规模，不代表本站用户或付费市场。', en: 'Competitors at the 2025 WCA World Championship. Cubing has international events, public results and products spanning lessons, timing and analysis. This describes one event, not CubeRoot users or the paying market.' })} <a href="https://www.worldcubeassociation.org/competitions/WC2025" target="_blank" rel="noopener noreferrer">{tr({ zh: 'WCA 官方来源 ↗', en: 'Official WCA source ↗' })}</a></p></div>
    </section>

    <section className="overview-section overview-wrap" aria-labelledby="overview-competition-title">
      <p className="overview-kicker">{tr({ zh: '02 / 正面回答竞争', en: '02 / Address competition' })}</p>
      <h2 id="overview-competition-title">{tr({ zh: '有竞品。\n所以必须有清楚的切入点。', en: 'There are competitors.\nWe need a clear starting point.' })}</h2>
      <p className="overview-intro">{tr({ zh: 'XC大师与 AI_CFOP 已经提供训练与分析能力。AI、计时和公式也不是任何一家独占的功能。CubeRoot 要验证的竞争路径，是把已有内容受众、教学经验与可使用的工具结合起来，服务从学会还原到持续训练的人。', en: 'XC Master and AI_CFOP already offer training and analysis. AI, timing and algorithms are not exclusive to one provider. CubeRoot’s competitive thesis is to combine an existing audience, teaching experience and usable tools for people progressing from their first solves to sustained practice.' })}</p>
      <div className="sticky-scroll sticky-scroll-mobile overview-budget-scroll"><table className="sticky-thead overview-budget overview-competitors"><thead><tr><th scope="col">{tr({ zh: '产品', en: 'Product' })}</th><th scope="col">{tr({ zh: '公开介绍的重点', en: 'Publicly described focus' })}</th><th scope="col">{tr({ zh: '对 CubeRoot 的启示', en: 'What this means for CubeRoot' })}</th></tr></thead><tbody>
        {COMPETITORS.map(({ name, url, focus, implication }) => (
          <tr key={name}>
            <th scope="row">
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {name} {'↗'}
                </a>
              ) : name}
            </th>
            <td>{tr(focus)}</td>
            <td>{tr(implication)}</td>
          </tr>
        ))}
      </tbody></table></div>
      <p className="overview-small">{tr({ zh: '竞品内容按 2026-10-02 官方网站或商店介绍整理，未做性能优劣测试；不以粉丝数推断其用户规模或收入。', en: 'Competitor descriptions use official sites or listings checked on 2026-10-02, not comparative performance tests. Social following does not establish their user base or revenue.' })}</p>
      <p className="overview-small">{tr({ zh: '市场也已有：', en: 'The wider ecosystem includes: ' })}<a href="https://www.cubeskills.com/" target="_blank" rel="noopener noreferrer">CubeSkills</a> / <a href="https://jperm.net/" target="_blank" rel="noopener noreferrer">J Perm</a>{tr({ zh: '（教程），', en: ' (lessons), ' })}<a href="https://cstimer.net/" target="_blank" rel="noopener noreferrer">csTimer</a>{tr({ zh: '（计时），', en: ' (timing), ' })}<a href="https://cubingapp.com/" target="_blank" rel="noopener noreferrer">CubingApp</a>{tr({ zh: '（数据），', en: ' (data), ' })}<a href="https://cubestation.com/zh/" target="_blank" rel="noopener noreferrer">GAN CubeStation</a>{tr({ zh: '（智能训练）。这些产品说明供给已经存在，付费需求仍需单独验证。', en: ' (smart training). Existing supply does not by itself establish paying demand.' })}</p>
    </section>

    <section className="overview-section overview-wrap" aria-labelledby="overview-advantage-title">
      <p className="overview-kicker">{tr({ zh: '03 / 优势与壁垒', en: '03 / Advantages & defensibility' })}</p>
      <h2 id="overview-advantage-title">{tr({ zh: '从内容走到产品，\n把触达变成长期关系。', en: 'From content to product.\nFrom discovery to lasting use.' })}</h2>
      <div className="overview-audience-proof"><strong>{tr({ zh: '约 50 万', en: '~500K' })}</strong><div><p>{tr(CREATOR_AUDIENCE.summary)}</p><span>{tr({ zh: '本人 2026 年 10 月确认；平台间未去重，不等于活跃用户、触达量或付费客户。', en: 'Owner-confirmed in October 2026; not deduplicated, and not active users, reach or paying customers.' })}</span></div></div>
      <div className="overview-advantage-grid">{[
        { Icon: Users, title: { zh: '已有内容触达基础', en: 'An existing audience' }, body: { zh: '可以通过自己的专题内容邀请试用者，直接获得训练问题和使用反馈；能否降低获客成本，要按真实到访、激活与留存核算。', en: 'Use focused content to recruit testers and collect feedback. Any acquisition-cost advantage must be measured through real visits, activation and retention.' }, proof: { zh: '验证：内容带来多少实际练习者', en: 'Check: actual practitioners recruited' } },
        { Icon: BookOpen, title: { zh: '教学与行业理解', en: 'Teaching & domain knowledge' }, body: { zh: '参赛、课程设计、公式库与著作积累，帮助把“哪里做得慢”解释成“下一步怎么练”，而不只给用户一个分数。', en: 'Competition, course design, algorithm work and authorship help turn analysis into understandable next practice steps.' }, proof: { zh: '验证：用户是否理解并完成练习', en: 'Check: understood and completed practice' } },
        { Icon: Code2, title: { zh: '可体验的技术积累', en: 'Usable technical work' }, body: { zh: '已有求解、状态可视化、复盘和数据工具，可承接内容中的具体练习。AI 提高开发效率，算法正确性与稳定交付仍需持续维护。', en: 'Solvers, visualisation, reconstruction and data tools can support exercises introduced in content. AI helps development; correctness and reliability still require work.' }, proof: { zh: '验证：能否稳定完成真实任务', en: 'Check: reliable completion of real tasks' } },
        { Icon: ChartNoAxesColumnIncreasing, title: { zh: '逐步累积的服务经验', en: 'Service experience built over time' }, body: { zh: '未来壁垒来自持续有效的教学内容、用户复练习惯、授权范围内的训练反馈与机构工作流程。公开 WCA 数据和通用 AI 不称为独占资产。', en: 'Potential defensibility comes from effective content, practice habits, appropriately authorised feedback and educator workflows—not exclusive ownership of public WCA data or general AI.' }, proof: { zh: '验证：重复使用、反馈质量与机构续用', en: 'Check: repeat use, feedback and educator retention' } },
      ].map(({ Icon, title, body, proof }) => <article data-site-surface="panel" key={title.en}><Icon size={26} aria-hidden /><h3>{tr(title)}</h3><p>{tr(body)}</p><span>{tr(proof)}</span></article>)}</div>
      <p className="overview-intro">{tr({ zh: '目前具备的是这几项能力的组合优势。接下来要用真实留存与服务效果，把优势逐步变成壁垒；不能仅凭功能数量或粉丝数量断言竞争已经结束。', en: 'Today’s advantage is the combination of these capabilities. Real retention and service outcomes must turn that starting point into defensibility.' })}</p>
      <AppLink href="/achievements" prefetch={false} className="overview-text-link">{tr({ zh: '查看已做出的原创工作', en: 'Inspect the original work' })}<ArrowUpRight size={16} aria-hidden /></AppLink>
    </section>
  </>;
}
