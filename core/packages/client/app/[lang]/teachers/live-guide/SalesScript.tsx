'use client';

import { useEffect, useRef } from 'react';
import { Check, Copy } from 'lucide-react';
import { useCopy } from '@/hooks/useCopy';
import { salesScript as script } from './sales-script-data';

// 用户指定这份导入讲稿全部使用中文，沿用原指南的双语内容。
const branches = [
  { title: '开播准备', items: [{ id: 'sales-setup', title: '首屏、贴片与道具' }, { id: 'sales-checklist', title: '开播前核对清单' }, { id: 'sales-rundown', title: '三十分钟循环安排' }] },
  { title: '留住观众', items: script.stages.slice(0, 3) },
  { title: '跟练与信任', items: script.stages.slice(3, 5) },
  { title: '课程与成交', items: script.stages.slice(5) },
  { title: '现场调度', items: [{ id: 'sales-return', title: '新人进入后的回拉' }, { id: 'sales-rescue', title: '低互动救场' }, { id: 'sales-interaction', title: '互动密度表' }, { id: 'sales-crew', title: '助播与场控分工' }] },
  { title: '下播复盘', items: [{ id: 'sales-review', title: '八项指标与调整方向' }] },
];

export default function SalesScript() {
  const root = useRef<HTMLElement>(null);
  const { copy, copied } = useCopy();

  // 锚点链接（含新标签页）打开时，先展开折叠内容，再定位标题。
  useEffect(() => {
    const reveal = () => {
      const id = window.location.hash.slice(1);
      if (!id.startsWith('sales-')) return;
      const target = document.getElementById(id);
      if (!target || !root.current?.contains(target)) return;
      if (target instanceof HTMLDetailsElement) target.open = true;
      target.scrollIntoView({ block: 'start' });
    };
    reveal();
    window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, []);

  function setAll(open: boolean) {
    root.current?.querySelectorAll<HTMLDetailsElement>('.sales-script-section').forEach(details => { details.open = open; });
  }

  return <section id="sales-script" ref={root} lang="zh-Hans" tabIndex={-1}>
    <p className="sales-script-eyebrow">实战讲稿</p>
    <h2>{script.title}</h2>
    <p className="live-guide-intro">先用两个白面魔方制造认知反差，再让观众跟练、看见纠错方法，最后介绍课程并帮助家长判断是否适合。</p>
    <p className="sales-script-offer">30 分钟一轮 <span>17 节系统课</span> <span>原稿直播价 199 元</span></p>
    <p className="live-guide-source">根据《魔方课程强节奏直播成交稿》整理。17 节、199 元及老师履历沿用原稿方案，正式使用前核对当期商品页和履历材料；上课、回放、资料与售后按实际服务说明执行。</p>
    <p>读图看主线，点击节点跳到对应内容。口播可直接读，现场提示供主播和助播执行；两遍跟练、读评论与停顿都计入本轮时长。</p>

    <nav className="sales-script-map" aria-label="强节奏直播思维导图">
      <div className="sales-script-map-root"><strong>一轮直播的成交主线</strong><span>看见问题 → 动手学会一步 → 判断课程是否适合</span></div>
      <ul className="sales-script-branches">{branches.map(branch => <li key={branch.title}>
        <details open><summary>{branch.title}</summary><ul>{branch.items.map(item => <li key={item.id}><a href={`#${item.id}`} onClick={() => {
          const target = document.getElementById(item.id);
          if (target instanceof HTMLDetailsElement) target.open = true;
        }}>{item.title.replace(/^第[一二三四五六七八九]段 /, '')}</a></li>)}</ul></details>
      </li>)}</ul>
    </nav>

    <div className="live-guide-copy-row sales-script-controls">
      <button type="button" className="live-guide-copy-btn" onClick={() => setAll(true)}>展开全部内容</button>
      <button type="button" className="live-guide-copy-btn" onClick={() => setAll(false)}>收起全部内容</button>
      <button type="button" className="live-guide-copy-btn" onClick={() => {
        const text = script.stages.map(stage => [stage.title, stage.time, ...('beats' in stage
          ? stage.beats.map(beat => `${beat.kind}：${beat.text}`)
          : stage.questions.flatMap(question => [question.title, question.answer, question.interaction]))].join('\n\n')).join('\n\n');
        copy(text);
      }}>{copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}<span aria-live="polite">{copied ? '已复制九段口播' : '复制九段口播'}</span></button>
    </div>

    <details id="sales-setup" className="sales-script-section">
      <summary><h3>开播准备：首屏与道具</h3></summary>
      {script.design.map(text => <p key={text}>{text}</p>)}
      <p className="live-guide-source">这是本稿的排练节奏，不是平台流量规则。30 至 60 秒的变化可以是指块、转动、检查结果或一句提问，不必每次都打断教学催评论。</p>
      <h4>标题任选其一</h4><ul>{script.setup.titles.map(text => <li key={text}>{text}</li>)}</ul>
      <h4>固定贴片</h4><ul>{script.setup.labels.map(text => <li key={text}>{text}</li>)}</ul>
      <h4>场景道具</h4><ul>{script.setup.props.map(text => <li key={text}>{text}</li>)}</ul>
    </details>

    <details id="sales-rundown" className="sales-script-section">
      <summary><h3>三十分钟循环安排</h3></summary>
      <ol className="live-guide-rundown">{script.rundown.map(item => <li key={item.time}>
        <span className="live-guide-time">{item.time}</span><div><h4>{item.task}</h4><p>互动：{item.interaction}</p><p>画面：{item.action}</p></div>
      </li>)}</ol>
      <p>18 至 23 分钟包含课程与价格两段，下面细分为 18 至 21 分钟和 21 至 23 分钟；实际按评论与跟练进度调整。</p>
    </details>

    <h3 className="sales-script-main-title">完整主播口播稿</h3>
    {script.stages.map(stage => <details id={stage.id} key={stage.id} className="sales-script-section sales-script-stage">
      <summary><span className="live-guide-time">{stage.time}</span><h4>{stage.title}</h4></summary>
      <p className="sales-script-goal">本段目标：{stage.goal}</p>
      {'beats' in stage ? stage.beats.map((beat, index) => beat.kind === '小节'
        ? <h4 className="sales-script-subtitle" key={index}>{beat.text}</h4>
        : <div className={`sales-script-beat${beat.kind === '口播' ? '' : ' sales-script-cue'}`} key={index}>
          <span className="sales-script-kind">{beat.kind}</span><p>{beat.text}</p>
        </div>) : stage.questions.map(question => <div className="sales-script-question" key={question.title}>
          <h4>{question.title}</h4><p>{question.answer}</p><p className="sales-script-cue">{question.interaction}</p>
        </div>)}
    </details>)}

    <details id="sales-return" className="sales-script-section">
      <summary><h3>新人进入后的六十秒回拉</h3></summary>
      <p className="sales-script-goal">新观众明显增加时使用，只重述反差和当前进度，不重复整段履历。</p>
      {script.returnScript.map(text => <p key={text}>{text}</p>)}
      <p className="sales-script-cue">如果正在跟练，先完成当前动作再回拉；“马上带一组动作”只在确实准备开始演示时说。</p>
    </details>

    <details id="sales-rescue" className="sales-script-section">
      <summary><h3>低互动时的四种救场话术</h3></summary>
      {script.rescue.map(item => <div className="sales-script-question" key={item.title}><h4>{item.title}</h4><p>{item.text}</p></div>)}
      <p className="sales-script-cue">找错后立即示范正确动作。找角块前确认实物配色，若没有红白蓝角块，就换成实际存在的三色组合。家长代入题接着说明：催促、责备和代做都可能打断思路，用“现在做到哪一步”替代。没人回复时自己示范一个答案，继续教学。</p>
    </details>

    <details id="sales-interaction" className="sales-script-section">
      <summary><h3>主播互动密度表</h3></summary>
      <p>甲、乙、丙用来区分选择项，“反”表示方向拿反；本稿已统一提示字，助播与贴片保持一致。</p>
      <ol className="sales-script-records">{script.interaction.map(item => <li key={item.time}>
        <h4>{item.time}</h4><p><strong>提问：</strong>{item.prompt}</p><p><strong>承接：</strong>{item.response}</p>
      </li>)}</ol>
    </details>

    <details id="sales-crew" className="sales-script-section">
      <summary><h3>助播和场控执行表</h3></summary>
      <dl className="sales-script-records">{script.crew.map(item => <div key={item.signal}>
        <dt>{item.signal}</dt><dd><p><strong>助播：</strong>{item.action}</p><p><strong>主播：</strong>{item.next}</p></dd>
      </div>)}</dl>
    </details>

    <details id="sales-checklist" className="sales-script-section">
      <summary><h3>开播前核对清单</h3></summary>
      <ul className="live-guide-checklist">{script.checklist.map(text => <li key={text}><Check size={17} aria-hidden /><span>{text}</span></li>)}</ul>
      <p className="sales-script-cue">先核对再口播；若本场课程数量、价格或服务发生变化，同步更新固定贴片、口播、助播回复与商品页。四步动作只采用正式课程的统一持握与口令。</p>
    </details>

    <details id="sales-review" className="sales-script-section">
      <summary><h3>每场直播的八项复盘</h3></summary>
      <dl className="sales-script-records">{script.review.map(item => <div key={item.metric}>
        <dt>{item.metric}</dt><dd><p><strong>检查：</strong>{item.check}</p><p><strong>优先调整：</strong>{item.adjust}</p></dd>
      </div>)}</dl>
      <p>先记录人数、评论与具体卡点，再比较比例；同一账号重复回复不要重复算参与人数。沿用页面下方的数据口径和复盘模板，每轮优先改一个问题。</p>
      <a href="#review">查看数据口径与复盘模板</a>
    </details>
  </section>;
}
