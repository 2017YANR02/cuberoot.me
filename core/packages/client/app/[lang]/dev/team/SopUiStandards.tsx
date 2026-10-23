'use client';

import { useT } from '@/hooks/useT';
import { ArrowRight, Check, Search, X } from 'lucide-react';
import SopLoadingDemo from './SopLoadingDemo';

type Example = 'simple' | 'sequence' | 'focus' | 'action' | 'group' | 'secondary' | 'consistent';

function ExampleView({ kind, good }: { kind: Example; good: boolean }) {
  const t = useT();
  const title = t('春季公开赛', 'Spring Open');
  const date = t('4 月 18 日，上海', '18 April, Shanghai');
  const action = t('报名', 'Register');
  const button = <span className="sop-demo-button">{action}</span>;
  const heading = <strong className="sop-demo-title">{title}</strong>;
  const detail = <span className="sop-demo-detail">{date}</span>;
  return <div className={`sop-demo sop-demo-${kind} ${good ? 'is-good' : 'is-bad'}`} aria-hidden="true">
    {kind === 'simple' && <><div className="sop-demo-frame">{heading}</div><div className="sop-demo-frame">{detail}</div><div className="sop-demo-frame">{button}</div></>}
    {kind === 'sequence' && (good ? <><span className="sop-demo-step"><span>1</span>{title}</span><span className="sop-demo-step"><span>2</span>{date}</span><span className="sop-demo-step"><span>3</span>{action} →</span></> : <><span className="sop-demo-step"><span>3</span>{action} →</span><span className="sop-demo-step"><span>1</span>{title}</span><span className="sop-demo-step"><span>2</span>{date}</span></>)}
    {kind === 'focus' && <><span className="sop-demo-banner">{t('社区动态', 'Community news')}</span>{heading}{detail}{button}</>}
    {kind === 'action' && <>{!good && button}<div className="sop-demo-event">{heading}{detail}{good && button}</div>{!good && <span className="sop-demo-detail">{t('其他活动　往期回顾', 'More events / Past events')}</span>}</>}
    {kind === 'group' && <><div className="sop-demo-field"><strong>{t('参赛信息', 'Entry details')}</strong><span>{t('项目：三阶', 'Event: 3×3')}</span></div><div className="sop-demo-field"><strong>{t('联系信息', 'Contact details')}</strong><span>{t('邮箱：name@example.com', 'Email: name@example.com')}</span></div></>}
    {kind === 'secondary' && <>{heading}<span className="sop-demo-detail">{t('报名截止：4 月 10 日', 'Entries close: 10 April')}</span>{button}<span className="sop-demo-meta">{t('更新于 3 月 1 日', 'Updated 1 March')}</span></>}
    {kind === 'consistent' && <>{[t('三阶', '3×3'), t('二阶', '2×2'), t('四阶', '4×4')].map((label, i) => <div className={`sop-demo-row sop-demo-row-${i}`} key={label}><strong>{label}</strong><span className="sop-demo-button">{t('查看', 'View')}</span></div>)}</>}
  </div>;
}

export default function SopUiStandards() {
  const t = useT();
  const rules: { kind: Example; title: string; text: string; bad: string; good: string }[] = [
    { kind: 'simple', title: t('界面简洁', 'Keep the interface simple'), text: t('参考苹果的简洁风格，用排版和留白区分层级，去掉多余的线条、方框和装饰；尽量不用中点分隔和圆点列表，优先用间距与分组。', 'Take cues from Apple’s simple style: use typography and spacing for hierarchy, without unnecessary lines, boxes or decoration; avoid middle-dot separators and bullet markers, using spacing and grouping instead.'), bad: t('每条信息都加框，边界抢眼。', 'A box around every item competes with the content.'), good: t('留白区分内容，重点更清楚。', 'Spacing separates content and makes the main point clearer.') },
    { kind: 'sequence', title: t('先确定阅读顺序', 'Plan the reading order'), text: t('排版前明确用户先看什么、再了解什么、最后做什么；顺序由页面任务决定。', 'Before laying out a page, decide what users should notice, understand and do, based on their task.'), bad: t('操作在前，必要信息在后。', 'The action appears before the information needed to decide.'), good: t('认识比赛 → 了解时间地点 → 报名。', 'Identify the event → check when and where → register.') },
    { kind: 'focus', title: t('突出主要内容', 'Emphasize the main content'), text: t('用大小、字重和对比突出当前重点，避免装饰和次要内容抢走注意力。', 'Use size, weight and contrast to highlight what matters; keep decoration and secondary content from competing.'), bad: t('社区横幅比比赛信息更醒目。', 'The community banner overshadows the event.'), good: t('比赛名称最突出，辅助内容退后。', 'The event name stands out; supporting content recedes.') },
    { kind: 'action', title: t('操作紧跟内容', 'Keep actions close to content'), text: t('把主要操作放在相关信息附近，让用户看完就知道下一步怎么做。', 'Place primary actions near the relevant information so the next step is easy to find.'), bad: t('报名入口与比赛信息分离。', 'The registration action is separated from the event.'), good: t('看完比赛信息，紧接着报名。', 'The registration action follows the event details.') },
    { kind: 'group', title: t('相关内容靠近', 'Group related information'), text: t('组内间距小、组间间距大，让用户从位置判断信息归属。', 'Use smaller gaps within groups and larger gaps between groups to make relationships clear.'), bad: t('标题离自己的内容远，反而贴近下一组。', 'Headings are distant from their content and close to the next group.'), good: t('每组标题与内容靠近，组间留出空间。', 'Each heading stays close to its content, with space between groups.') },
    { kind: 'secondary', title: t('弱化次要信息', 'Reduce secondary emphasis'), text: t('补充说明、更新时间和低频操作降低视觉权重，但仍须清楚可读。', 'Reduce the emphasis of supporting notes, timestamps and infrequent actions while keeping them readable.'), bad: t('更新时间与报名信息争夺注意力。', 'The update timestamp competes with registration information.'), good: t('报名信息优先，更新时间作为补充。', 'Registration information comes first; the timestamp stays secondary.') },
    { kind: 'consistent', title: t('同类元素一致', 'Keep similar elements consistent'), text: t('同类元素使用一致的字体、颜色、间距和样式，避免无意义的视觉差异。', 'Use consistent typography, colors, spacing and styling for similar elements; avoid arbitrary visual differences.'), bad: t('相同的查看操作使用三种样式。', 'The same view action uses three different styles.'), good: t('同类操作保持一致，便于识别。', 'Consistent actions are easier to recognize.') },
  ];
  return <section className="sop-ui-standards" aria-labelledby="sop-ui-title">
    <h3 id="sop-ui-title">{t('界面设计', 'Visual design')}</h3>
    <p className="quality-ui-summary">{t('让用户第一眼看到重点，看完就知道下一步。', 'Make the main point visible at a glance and the next action easy to find.')}</p>
    <div className="quality-reading-order" aria-label={t('阅读顺序', 'Reading order')}>
      <span><b>1</b>{t('看到重点', 'Notice')}</span><ArrowRight size={14} aria-hidden="true" />
      <span><b>2</b>{t('理解信息', 'Understand')}</span><ArrowRight size={14} aria-hidden="true" />
      <span><b>3</b>{t('完成操作', 'Act')}</span>
    </div>
    <SopLoadingDemo />
    <div className="sop-ui-rules">{rules.map(rule => <article key={rule.kind} className="staff-sop-card sop-ui-rule" data-site-surface="panel">
      <div className="quality-rule-heading"><h4>{rule.title}</h4></div><p className="sop-ui-description">{rule.text}</p>
      <div className="sop-ui-comparison">{[false, true].map(good => <figure key={String(good)}>
        <div className={`quality-verdict ${good ? 'is-good' : 'is-bad'}`}>{good ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}{good ? t('推荐', 'Do') : t('避免', 'Avoid')}</div>
        <ExampleView kind={rule.kind} good={good} />
        <figcaption>{good ? rule.good : rule.bad}</figcaption>
      </figure>)}</div>
    </article>)}</div>
    <aside className="quality-review"><Search size={18} aria-hidden="true" /><div><strong>{t('验收时看什么', 'What to check')}</strong><p>{t('请未参与设计的人看一眼：先注意到什么？页面能做什么？下一步点哪里？答案应与设计目标一致。', 'Ask someone uninvolved in the design what they noticed first, what the page does and where they would click next. Their answers should match the intended task.')}</p></div></aside>
  </section>;
}
