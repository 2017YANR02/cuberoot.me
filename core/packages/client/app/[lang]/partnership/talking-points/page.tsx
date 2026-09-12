import { ArrowUpRight, LockKeyhole, MessageCircle, Check } from 'lucide-react';
import AppLink from '@/components/AppLink';
import AppearanceToggle from '@/components/AppearanceToggle';
import '../partnership.css';
import './talking-points.css';

// Chinese-only meeting material, explicitly requested by the owner.
const angles = [
  {
    title: '从选手家长的真实经历聊起',
    context: '适合刚开始聊天时。先了解对方关心什么，再介绍对应的产品。',
    ask: '您陪孩子玩魔方，觉得最费心的是什么？是找训练资料、了解比赛、找老师，还是不知道怎么判断练习有没有进步？',
    say: '我做 CubeRoot，就是希望把这些事情变得方便一点。现在已经有计时、公式、比赛和统计等入口。我可以给您看其中跟您刚才说的问题最相关的部分。',
    prepare: '准备两三个能现场打开的功能。先听完，再演示，不把所有功能一次讲完。',
  },
  {
    title: '让他看见已经做出来的产品',
    context: '适合对方问“你现在做到哪一步了”。用实际产品建立信任。',
    ask: '我给您演示两个具体功能，您帮我看看，从选手和家长的角度，这样的工具有没有用？',
    say: '这件事我已经自己做到了现在这个阶段，您可以直接看产品。接下来我希望把已有工具做得更稳定，再验证个人和机构真正愿意付费的服务。资金会对应具体的开发、维护和运营工作。',
    prepare: '带上真实使用反馈、活跃数据和实际支出。有数据就说明口径，没有数据就说明还在验证。',
  },
  {
    title: '聊聊他希望为魔方圈留下什么',
    context: '适合对方确实热爱魔方、关注圈子发展时。不要预设他一定愿意资助。',
    ask: '您觉得魔方圈现在最缺哪一类支持？除了比赛和选手赞助，您会不会考虑支持大家日常使用的工具和平台？',
    say: '如果您认可，我希望您能支持其中一个明确项目，比如把一项工具完善并维护一段时间。我们先把服务对象、开放范围和阶段目标谈清楚，我负责执行，也定期汇报进展。',
    prepare: '明确哪些服务免费、哪些计划收费。网站有商业化计划，要坦诚说明，不能让对方误认为这是纯公益项目。',
  },
  {
    title: '如果他经营企业，聊品牌赞助',
    context: '适合对方有品牌推广需求时。赞助可以不给股权，但需要兑现商业交付。',
    ask: '您企业现在有没有接触魔方爱好者、家长或培训机构的需求？您更看重品牌展示、内容合作，还是具体活动？',
    say: '如果您希望这份支持也给企业带来曝光，我们可以做一份赞助方案，把展示位置、合作期限和交付内容写清楚。网站展示、内容和直播合作，都可以在实际能力范围内讨论。',
    prepare: '只承诺能交付的展示与内容。没有真实流量和直播成绩，就不承诺曝光量、销售额或获客效果。',
  },
  {
    title: '让他了解你怎样把事情做出来',
    context: '适合对方对创作者本人、执行力和长期投入更感兴趣时。',
    ask: '您看这种长期项目时，最关心负责人的哪一点？是持续投入、交付速度，还是对这个行业的理解？',
    say: '我自己负责开发和维护，也用 AI 工具提高效率。我可以给您看最近实际完成了哪些东西，以及接下来三个月准备推进什么。遇到问题，我也会如实说明。',
    prepare: '准备一个真实案例：用户提出了什么问题，你怎么解决、用了多久、收到什么反馈。用案例说明 AI 的作用。',
  },
  {
    title: '把一笔支持，落到明确的用途',
    context: '适合对方开始问“需要多少钱、拿去做什么”。先有预算，再提出金额。',
    ask: '如果方向符合您的兴趣，您更愿意支持一个明确项目，还是支持一段时间的开发与运营？',
    say: '我希望争取一笔有明确用途的支持。金额按实际预算确定，里面会列出开发劳动报酬、服务器、内容和运营等支出，也会列出阶段目标。我们可以讨论分阶段拨付，让每一阶段都有清楚的安排。',
    prepare: '不要只说“网站烧钱”。准备金额、期限、用途、阶段成果、汇报方式，以及停止合作时未使用资金的处理办法。',
  },
];

const questions = [
  ['这笔钱给你，我能得到什么？', '如果是项目资助，您支持的是这个项目的发展，不涉及股权，也不承诺财务回报。如果您希望有品牌展示、内容或直播方面的权益，我们就按商业赞助讨论，把交付写清楚。'],
  ['为什么不给股权？', '我现在希望保持独立经营，所以这次提出的是项目资助或赞助合作。如果您只考虑股权投资，我理解，这与我本次希望的合作方式不同，我们可以先坦诚地把这个区别说清楚。'],
  ['网站以后赚钱了呢？', '网站有商业化计划，包括个人和机构订阅。如果这次约定的是不带股权和分红的资助，网站以后盈利也不会自动产生分红权利。这一点我希望您在决定前就清楚。'],
  ['你能保证做成全球最大吗？', '这是我的长期愿景，现在不能保证排名或结果。我能做的是把下一阶段的工作和资源需求说明白，认真执行，并用实际产品、使用反馈和经营数据汇报。'],
  ['需要几十万，有什么依据？', '我会用预算说明，而不是先定一个大数。计划周期内的支出，加必要投入和缓冲，再减去现有可用资金与保守预计回款，才是需要争取的支持金额。预算没有核实前，我不把几十万当成正式报价。'],
  ['项目没做下去，这笔钱怎么办？', '这要在合作前约定清楚。项目资助不承诺还本或投资收益，但约定用途、阶段条件和交付仍然需要履行。未使用的资金、已发生的支出和终止后的处理，我们会写明。'],
  ['我现在不想出钱，但可以介绍人。', '也很感谢。如果方便，我希望认识有真实需求的老师、机构或潜在赞助方。您可以先看项目资料，觉得合适再介绍，不需要替我承诺效果。'],
  ['我考虑一下。', '当然，您不用现在决定。我把产品介绍和核实后的预算发给您。您看过之后，如果还有兴趣，我们再约一次专门聊具体安排。'],
];

export default function TalkingPointsPage() {
  return <main className="partnership-page talking-page" lang="zh-Hans">
    <header className="partner-nav partner-wrap">
      <AppLink href="/" className="partner-brand" prefetch={false}>CubeRoot</AppLink>
      <span className="partner-private"><LockKeyhole size={12} aria-hidden />会谈提纲 · 管理员专属</span>
      <AppearanceToggle />
    </header>
    <div className="talking-wrap">
      <section className="talking-hero">
        <p className="partner-eyebrow">把想做的事，认真说清楚。</p>
        <h1>一场交流。<br /><span>一个共同向前的可能。</span></h1>
        <p className="partner-body">从介绍产品，到提出支持请求。这里整理了完整的交流顺序、六个切入点，以及可以直接参考的话术。按现场情况选择，用自己的语气表达。</p>
        <AppLink className="partner-button" href="/partnership" prefetch={false}>展示项目宣传页<ArrowUpRight size={16} aria-hidden /></AppLink>
        <p className="talking-note">本次诉求：项目资助或赞助合作，不出让股权，不承诺还本、分红或投资收益。对方有权独立决定，没有话术能保证获得资助。</p>
      </section>

      <nav className="talking-toc" aria-label="会谈提纲目录">{[['opening', '怎么开场'], ['angles', '六个切入点'], ['request', '怎么提金额'], ['questions', '常见问题'], ['closing', '如何推进']].map(([id,label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>

      <section id="opening" className="talking-section">
        <p className="partner-eyebrow">01 / 先把话题自然打开</p><h2>先听，再介绍。</h2>
        <p className="talking-intro">先聊他孩子的魔方经历，听听选手和家长的真实需要。随后明确说明今天希望交流合作，不必整晚靠暗示。</p>
        <blockquote className="talking-quote">我现在主要在做 CubeRoot，希望把它做成面向全球魔方爱好者的平台。计时、公式、比赛和统计等工具已经可以打开体验。接下来，我想把产品继续做好，也探索个人和机构订阅，用直播接触用户，用 AI 提高开发与运营效率。今天也希望听听您的看法，看看您有没有兴趣支持这个方向。</blockquote>
        <div className="talking-reminder"><MessageCircle size={18} aria-hidden /><p>先展示两三个相关功能，每个用一两句话说明“谁在什么情况下会用到”。愿景可以大，眼前要解决的问题要具体。</p></div>
      </section>

      <section id="angles" className="talking-section">
        <p className="partner-eyebrow">02 / 六个交流切入点</p><h2>找到他真正关心的事。</h2>
        <p className="talking-intro">这些是可选择的话题，不是必须背完的推销顺序。对方对哪一点感兴趣，就围绕那一点展开。</p>
        <div className="talking-angles">{angles.map((angle,index) => <article className="talking-angle" key={angle.title}>
          <div className="talking-angle-heading"><span>{String(index+1).padStart(2,'0')}</span><h3>{angle.title}</h3></div>
          <p className="talking-context">{angle.context}</p>
          <p className="talking-label">可以先问</p><blockquote className="talking-question">{angle.ask}</blockquote>
          <p className="talking-label">接着可以说</p><blockquote className="talking-quote">{angle.say}</blockquote>
          <p className="talking-prepare"><strong>提前准备</strong>{angle.prepare}</p>
        </article>)}</div>
      </section>

      <section id="request" className="talking-section">
        <p className="partner-eyebrow">03 / 从认同，走向具体请求</p><h2>把金额与责任说清楚。</h2>
        <p className="talking-intro">下面方括号中的内容，需要在正式使用前换成核实后的预算与目标；目前没有填写任何未经确认的金额。</p>
        <blockquote className="talking-quote">我今天确实也想跟您谈一件事：希望争取您对 CubeRoot 的项目资助。这次不涉及股权，也不承诺还本或投资收益。我的计划是用这笔钱，在接下来【实际周期】完成【具体目标】。根据预算，我希望争取【实际金额】元的支持，主要用于【支出项目】。我会把预算和阶段安排完整给您看。您对这种支持方式有没有兴趣？</blockquote>
        <div className="talking-budget">{[
          ['金额', '需要多少支持，已有多少可用资金'], ['期限', '覆盖多久，分几个阶段'], ['用途', '开发报酬、服务器、内容与运营等真实支出'], ['目标', '每一阶段具体交付什么、验证什么'], ['汇报', '何时沟通，用哪些实际资料说明进展'], ['终止', '停止条件、未使用资金与未完成交付如何处理'],
        ].map(([title,body]) => <div key={title}><Check size={16} aria-hidden /><p><strong>{title}</strong><span>{body}</span></p></div>)}</div>
        <p className="talking-note">如果希望争取几十万元，先用真实预算支撑金额。对方愿意分阶段支持，也需要明确总额、每阶段条件，以及后续资金是否已经承诺。</p>
      </section>

      <section id="questions" className="talking-section">
        <p className="partner-eyebrow">04 / 对方可能问什么</p><h2>坦诚回答，比绕过去更有用。</h2>
        <div className="talking-faq">{questions.map(([question,answer]) => <article key={question}><h3>{question}</h3><p>{answer}</p></article>)}</div>
      </section>

      <section id="closing" className="talking-section">
        <p className="partner-eyebrow">05 / 给交流一个具体的下一步</p><h2>让合作，有机会继续。</h2>
        <blockquote className="talking-quote">您愿不愿意下一步看一下我的产品资料和资金计划？如果方向符合您的兴趣，我们再专门约时间，把金额、用途、合作方式和双方需要承担的事情谈清楚。</blockquote>
        <ol className="talking-steps"><li><strong>当晚确认兴趣。</strong>了解他倾向于项目资助、品牌赞助，还是介绍机构和资源。</li><li><strong>会后提供资料。</strong>产品入口、真实经营情况、核实后的预算和阶段目标。</li><li><strong>有意向再谈安排。</strong>明确给谁、给多少、是否归还、是否有商业交付，以及终止条件。</li><li><strong>书面说清再收款。</strong>对重要金额与条款请专业人士核对，不能只凭一句“支持你”。</li></ol>
        <p className="talking-note">共同朋友可以帮助建立信任，但不要用朋友关系施压。也不要为了促成合作，承诺给对方孩子特殊待遇、保证收益或保证做成全球最大。</p>
      </section>
      <footer className="talking-footer"><LockKeyhole size={14} aria-hidden /><span>管理员会谈资料 · 与合作提案共用访问限制</span></footer>
    </div>
  </main>;
}
