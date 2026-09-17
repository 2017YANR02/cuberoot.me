'use client';

import { useRef } from 'react';
import { BookOpen, Check, ChevronDown, Copy, Mic2 } from 'lucide-react';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';
import { chapters, journey, metrics, objections, preparation, retention, reviewTemplate, rundown, skills, techniques } from './guide-data';
import SalesScript from './SalesScript';

export default function LiveGuidePage() {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const { copy, copied } = useCopy();
  const navigation = [...chapters.slice(0, 2), { id: 'sales-script', title: '强节奏直播成交稿' }, ...chapters.slice(2)];
  const links = navigation.map((chapter) => <a key={chapter.id} href={`#${chapter.id}`} onClick={(event) => {
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && menuRef.current) menuRef.current.open = false;
  }}>{typeof chapter.title === 'string' ? chapter.title : tr(chapter.title)}</a>);

  return <main className="live-guide">
    <header className="live-guide-topbar">
      <AppLink href="/teachers/scripts" prefetch={false}><Mic2 size={17} aria-hidden />{tr({ zh: '直播话术库', en: 'Script library' })}</AppLink>
      <HeaderToggles />
    </header>
    <div className="live-guide-hero">
      <h1>{tr({ zh: '直播卖课指南', en: 'A guide to selling courses live' })}</h1>
      <p className="live-guide-lead">{tr({ zh: '让观众学会一步，看懂学习路线，再决定是否跟你学。', en: 'Help viewers learn one step, see the learning path, and decide whether to study with you.' })}</p>
      <p>{tr({ zh: '面向魔方老师与培训机构。开播前用它准备，直播中按话术执行，下播后用数据和学员反馈改进。', en: 'For cubing teachers and schools: prepare with this guide, present with your script, and improve with session data and student feedback.' })}</p>
      <div className="live-guide-actions">
        <a href="#sales-script"><BookOpen size={16} aria-hidden />强节奏直播成交稿</a>
        <a href="#rundown"><Check size={16} aria-hidden />{tr({ zh: '开播速查', en: 'Pre-stream quick reference' })}</a>
        <AppLink href="/teachers/scripts/1" prefetch={false}><BookOpen size={16} aria-hidden />{tr({ zh: '查看示例话术', en: 'View the example script' })}</AppLink>
      </div>
    </div>

    <nav className="live-guide-mobile-nav" aria-label={tr({ zh: '本页目录', en: 'On this page' })}>
      <details ref={menuRef} onKeyDown={(event) => {
        if (event.key === 'Escape' && menuRef.current?.open) {
          menuRef.current.open = false;
          menuRef.current.querySelector('summary')?.focus();
        }
      }}><summary>{tr({ zh: '本页目录', en: 'On this page' })}<ChevronDown size={16} aria-hidden /></summary><div className="live-guide-mobile-links">{links}</div></details>
    </nav>

    <div className="live-guide-layout">
      <nav className="live-guide-sidebar" aria-label={tr({ zh: '本页目录', en: 'On this page' })}>
        <p>{tr({ zh: '本页目录', en: 'On this page' })}</p>{links}
      </nav>
      <article className="live-guide-body">
        <section id="skills" tabIndex={-1}>
          <h2>{tr(chapters[0].title)}</h2>
          <p className="live-guide-intro">{tr({ zh: '先练“教得懂、能回应、讲清课程”，再逐步完善镜头表现和数据分析。下面每项都配一个可练习的动作。', en: 'Start with clear teaching, responsive interaction, and an understandable offer. Then improve your presentation and analysis. Each skill below has a practice task.' })}</p>
          <div className="live-guide-skills">{skills.map((item) => <div key={item.title.en}>
            <h3>{tr(item.title)}</h3><p>{tr(item.body)}</p><p className="live-guide-practice"><strong>{tr({ zh: '练法：', en: 'Practise: ' })}</strong>{tr(item.practice)}</p>
          </div>)}</div>
        </section>

        <section id="conversion" tabIndex={-1}>
          <h2>{tr(chapters[1].title)}</h2>
          <p className="live-guide-intro">{tr({ zh: '观众从“这和我有关”走到“我知道下一步怎么做”，每一步都需要具体内容承接。先让体验成立，再介绍适合的课程。', en: 'Each step from “this is relevant” to “I know what to do next” needs useful content. Deliver the learning experience, then explain a suitable course.' })}</p>
          <ol className="live-guide-journey">{journey.map((item) => <li key={item.title.en}>
            <h3>{tr(item.title)}</h3><p>{tr(item.body)}</p><blockquote>{tr(item.example)}</blockquote>
          </li>)}</ol>
          <p className="live-guide-source">{tr({ zh: '分段演示、关键内容回顾与即时互动参考 ', en: 'Segmented demos, recaps, and interaction draw on ' })}<a href="https://seller-fr.tiktok.com/university/essay?knowledge_id=2738703987279638&lang=en-GB" target="_blank" rel="noreferrer">TikTok Shop Academy</a>{tr({ zh: '。这里的魔方教学示例是应用建议；平台功能与课程上架条件需按你使用的平台核对。', en: '. The cubing examples are practical adaptations; check features and course eligibility on your own platform.' })}</p>
          <h3>{tr({ zh: '常见购买顾虑', en: 'Common buying questions' })}</h3>
          <div className="live-guide-details">{objections.map((item) => <details key={item.title.en}><summary>{tr(item.title)}</summary><p>{tr(item.body)}</p></details>)}</div>
        </section>

        <SalesScript />

        <section id="rundown" tabIndex={-1}>
          <h2>{tr(chapters[2].title)}</h2>
          <h3>{tr({ zh: '开播前逐项过一遍', en: 'Before going live' })}</h3>
          <ul className="live-guide-checklist">{preparation.map((item) => <li key={item.en}><Check size={17} aria-hidden /><span>{tr(item)}</span></li>)}</ul>
          <p className="live-guide-source">{tr({ zh: '试播、环境检查和提前预告参考 ', en: 'Trial runs, setup checks, and advance promotion draw on ' })}<a href="https://ads.tiktok.com/business/en/blog/tiktok-live-best-practice" target="_blank" rel="noreferrer">TikTok for Business</a>{tr({ zh: ' 的开播建议。', en: ' guidance.' })}</p>
          <h3>{tr({ zh: '一场 45 分钟的练习安排', en: 'A 45-minute practice rundown' })}</h3>
          <p>{tr({ zh: '这是便于试播的建议时长，不是平台流量规则。已有长话术可选取相关章节套入；加长时优先增加教学与答疑，按真实观众反应调整。', en: 'These timings are a rehearsal starting point, not a platform ranking rule. Select relevant chapters from a longer script; extend teaching and Q&A when needed and adjust to the audience.' })}</p>
          <ol className="live-guide-rundown">{rundown.map((item) => <li key={item.time}><span className="live-guide-time">{item.time}</span><div><h4>{tr(item.title)}</h4><p>{tr(item.body)}</p></div></li>)}</ol>
          <p className="live-guide-reminder">{tr({ zh: '每轮教学都走完：提出问题 → 示范 → 跟做 → 检查 → 总结。独播时先完成当前步骤，再看评论。', en: 'Complete each loop: question → demo → practice → check → recap. If presenting alone, finish the step before checking chat.' })}</p>
        </section>

        <section id="techniques" tabIndex={-1}>
          <h2>{tr(chapters[3].title)}</h2>
          <p className="live-guide-intro">{tr({ zh: '遇到具体情况时展开查看。先保证观众看得清、听得懂、跟得上，再增加复杂演示。', en: 'Expand the situation you need. Prioritise a clear view, clear sound, and a pace viewers can follow before adding complex demos.' })}</p>
          <div className="live-guide-details">{techniques.map((item) => <details key={item.title.en}><summary>{tr(item.title)}</summary><p>{tr(item.body)}</p></details>)}</div>
        </section>

        <section id="retention" tabIndex={-1}>
          <h2>{tr(chapters[4].title)}</h2>
          <p className="live-guide-intro">{tr({ zh: '观看留存看观众是否继续看；学员留存看购课后是否持续学习。把成交承诺落实到第一次练习和后续支持，才有长期信任。以下安排按课程真实服务范围执行。', en: 'Viewer retention measures continued watching; student retention measures continued learning after purchase. Deliver the first practice experience and ongoing support within the actual course service scope.' })}</p>
          <div className="live-guide-retention">{retention.map((item) => <div key={item.title.en}><h3>{tr(item.title)}</h3><p>{tr(item.body)}</p></div>)}</div>
        </section>

        <section id="review" tabIndex={-1}>
          <h2>{tr(chapters[5].title)}</h2>
          <p className="live-guide-intro">{tr({ zh: '用自己的可比场次建立基线，不套一个所谓通用合格转化率。先看人数和证据，再看百分比；分母为零时记为不适用。', en: 'Build a baseline from comparable sessions instead of using a supposed universal conversion target. Check counts and evidence before percentages; mark zero-denominator metrics as not applicable.' })}</p>
          <dl className="live-guide-metrics">{metrics.map((item) => <div key={item.title.en}><dt>{tr(item.title)}</dt><dd><p className="live-guide-formula">{tr(item.formula)}</p><p>{tr(item.action)}</p></dd></div>)}</dl>
          <p className="live-guide-reminder">{tr({ zh: '先定位卡在哪一步，再改一件事。例如停留短先改开场，点击少先查课程相关性和入口，购买少先查详情与支付。比较时记录时段、流量、人群和价格差异；样本少时只作为线索，不急着判定有效。', en: 'Find the weak step, then change one thing. Short viewing suggests reviewing the opening; few clicks suggest checking relevance and the entry; few purchases suggest reviewing details and checkout. Record differences in timing, traffic, audience, and price. Treat small samples as clues.' })}</p>
          <div className="live-guide-copy-row"><h3>{tr({ zh: '复盘记录模板', en: 'Session review template' })}</h3><button className="live-guide-copy-btn" type="button" onClick={() => copy(tr(reviewTemplate))}>{copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}<span aria-live="polite">{copied ? tr({ zh: '已复制', en: 'Copied' }) : tr({ zh: '复制模板', en: 'Copy template' })}</span></button></div>
          <details className="live-guide-template"><summary>{tr({ zh: '展开模板，也可手动选中复制', en: 'Show the template or select it to copy manually' })}</summary><pre>{tr(reviewTemplate)}</pre></details>
        </section>
        <footer className="live-guide-footer"><AppLink href="/teachers/scripts" prefetch={false}><Mic2 size={17} aria-hidden />{tr({ zh: '到话术库安排下一场直播', en: 'Plan your next session in the script library' })}</AppLink></footer>
      </article>
    </div>
  </main>;
}
