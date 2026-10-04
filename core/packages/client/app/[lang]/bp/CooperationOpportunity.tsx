import { ArrowUpRight, ChevronDown, ChartNoAxesColumnIncreasing, Handshake, Megaphone } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { tr } from '@/i18n/tr';

const OPTIONS = [
  {
    Icon: Megaphone,
    status: { zh: '当前重点 · 不涉及股权', en: 'Current focus · no equity' },
    title: { zh: '品牌与项目合作', en: 'Brand & project partnerships' },
    body: { zh: '围绕线上赛事、课程内容或明确的产品项目，约定合作费用与资源支持，让每笔投入对应具体交付。', en: 'Agree fees and resource support around online events, course content or a defined product project, with specific deliverables for each engagement.' },
    value: { zh: '可约定线上赛事冠名、品牌展示、联合内容、课程服务或项目成果演示；位置、数量、周期与验收方式事先明确。', en: 'Possible deliverables include online-event naming, brand placements, joint content, course services or project demonstrations. Agree placement, quantity, duration and acceptance criteria in advance.' },
    next: { zh: '先完成一次清楚、可复核的合作，再决定是否继续。', en: 'Complete and review a clearly scoped engagement before deciding whether to continue.' },
  },
  {
    Icon: Handshake,
    status: { zh: '根据合作成效拓展', en: 'Expand based on results' },
    title: { zh: '长期战略协作', en: 'Long-term strategic collaboration' },
    body: { zh: '在交付效果与双方目标一致的基础上，延伸到系列线上赛事、课程共建、机构服务或产品应用，共同投入各自擅长的资源。', en: 'Where delivery and shared goals align, extend collaboration to online-event series, course development, institutional services or product applications, with each party contributing its strengths.' },
    value: { zh: '合作方获得持续的品牌、内容或业务服务；魔方根获得相应费用、渠道或专业资源。按项目明确双方责任，并定期复核实际效果。', en: 'Partners receive continuing brand, content or business services; CubeRoot receives agreed fees, distribution or specialist resources. Define responsibilities per project and review actual outcomes regularly.' },
    next: { zh: '继续以业务交付为基础，合作范围与期限单独约定。', en: 'Keep delivery at the centre and agree scope and duration separately.' },
  },
  {
    Icon: ChartNoAxesColumnIncreasing,
    status: { zh: '未来可选 · 另行讨论', en: 'Future option · separate discussion' },
    title: { zh: '未来资本合作', en: 'Potential future investment' },
    body: { zh: '当产品、用户留存与收入模型更成熟，且双方都有意愿时，可以再讨论战略投资及更深层合作。', en: 'When the product, retention and revenue model are more mature, strategic investment may be discussed if both parties wish to explore it.' },
    value: { zh: '以届时的经营数据、资源价值和发展目标作为讨论依据；当前不预设估值、股权比例或投资安排。', en: 'Use the operating evidence, resource contribution and goals at that time as the basis for discussion. No valuation, equity percentage or investment arrangement is set now.' },
    next: { zh: '属于可选方向，不是前两类合作的必经阶段。', en: 'An optional direction, not a required next stage of business collaboration.' },
  },
] as const;

export const COOPERATION_INTRO = {
  zh: '我更希望先通过具体业务合作建立信任。现在可以围绕线上赛事、课程或产品项目，把双方投入、交付内容和复核方式说清楚。等产品与收入模型更成熟，如果双方都认可，再单独讨论资本层面的合作。',
  en: 'I would like to build trust through specific business engagements first. We can agree contributions, deliverables and review for an online event, course or product project. Once the product and revenue model are more mature, we can discuss investment separately if both parties are interested.',
};

export default function CooperationOpportunity() {
  return <section id="bp-cooperation" className="overview-section overview-wrap" aria-labelledby="bp-cooperation-title">
    <p className="overview-kicker">{tr({ zh: '合作机会', en: 'Partnership opportunities' })}</p>
    <h2 id="bp-cooperation-title">{tr({ zh: '先通过业务建立信任，\n再决定合作走多远。', en: 'Build trust through delivery.\nDecide together what comes next.' })}</h2>
    <p className="overview-intro">{tr({ zh: '当前希望获得有明确用途的合作费用与资源支持，用于产品研发、内容制作、线上赛事和用户服务。以具体合作项目为起点，让对方看得见交付、也能复核效果。', en: 'We seek scoped project fees and resources for product development, content, online events and user services. Start with a defined engagement whose deliverables and outcomes can be reviewed.' })}</p>
    <div className="bp-streams">{OPTIONS.map(({ Icon, status, title, body, value, next }) => <article key={title.en} data-site-surface="panel">
      <span className="bp-stream-status">{tr(status)}</span><Icon size={30} aria-hidden />
      <h3>{tr(title)}</h3><p>{tr(body)}</p>
      <details className="bp-cooperation-detail"><summary>{tr({ zh: '交付与推进方式', en: 'Delivery and next steps' })}<ChevronDown size={16} aria-hidden /></summary><dl className="overview-cost-list"><div><dt><strong>{tr({ zh: '合作价值与交付', en: 'Value & delivery' })}</strong><span>{tr(value)}</span></dt></div><div><dt><strong>{tr({ zh: '推进方式', en: 'How to proceed' })}</strong><span>{tr(next)}</span></dt></div></dl></details>
    </article>)}</div>
    <div className="overview-review" data-site-surface="panel"><Handshake size={26} aria-hidden /><div>
      <h3>{tr({ zh: '先明确一个项目，把交付与复核约定清楚。', en: 'Start with one project and agree delivery and review.' })}</h3>
      <p>{tr({ zh: '共同确认目标受众、合作内容、双方投入与周期；执行后提供成果和实际传播、参与或使用情况，再讨论下一步。品牌曝光、销售转化和用户增长按真实结果报告。', en: 'Agree the audience, scope, contributions and period. Report deliverables and actual reach, participation or usage before discussing next steps. Report brand exposure, sales conversion and growth from observed results.' })}</p>
      <p className="overview-small">{tr({ zh: '现阶段合作不涉及公司股权。未来资本合作须另行协商；当前合作不自动转换股权，也不预设优先投资权。', en: 'Current engagements do not involve company equity. Future investment requires a separate agreement; current engagements neither convert automatically into equity nor establish priority investment rights.' })}</p>
    </div></div>
    <AppLink href="/contact" prefetch={false} className="overview-primary">{tr({ zh: '联系颜瑞民，讨论具体项目', en: 'Contact Ruimin Yan about a project' })}<ArrowUpRight size={17} aria-hidden /></AppLink>
  </section>;
}
