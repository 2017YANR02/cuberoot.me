'use client';

import { useEffect, useState } from 'react';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import { ArrowUpRight, CalendarDays, Check, Clock3, Headphones, ShieldCheck, Trophy, Video, Wallet } from 'lucide-react';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { CompactSelect } from '@/components/CompactSelect';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';
import { useT } from '@/hooks/useT';
import { eventDisplayName } from '@/lib/wca-events';
import './online-competition.css';

// This route is an explicitly isolated interaction preview. No orders or results are written.
const PROJECTS = ['222', '333', '444', '555'] as const;
const SESSIONS = [
  { id: 'friday', date: '2026-10-16', time: '19:00–20:00', available: 8, capacity: 20 },
  { id: 'saturday', date: '2026-10-17', time: '14:00–15:00', available: 12, capacity: 20 },
  { id: 'sunday', date: '2026-10-18', time: '10:00–11:00', available: 0, capacity: 20 },
] as const;
const projectSet = new Set<string>(PROJECTS);

export function OnlineCompetitionPreview() {
  const t = useT();
  const [view, setView] = useQueryState('view', parseAsStringEnum(['entry', 'organizer', 'supervisor'] as const).withDefault('entry').withOptions({ history: 'push' }));
  const [tab, setTab] = useQueryState('tab', parseAsStringEnum(['schedule', 'rules', 'results'] as const).withDefault('schedule').withOptions({ history: 'push' }));
  const [project, setProject] = useQueryState('project', parseAsStringEnum([...PROJECTS]).withDefault('333'));
  const [device, setDevice] = useQueryState('device', parseAsStringEnum(['standard', 'smart'] as const).withDefault('standard'));
  const [slot, setSlot] = useQueryState('session', parseAsString.withDefault(''));
  const [accepted, setAccepted] = useState(false);
  const [step, setStep] = useState<'selection' | 'summary' | 'waiting'>('selection');
  const [judgeReady, setJudgeReady] = useState(false);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checkedIn, setCheckedIn] = useState(false);
  useEffect(() => {
    setStep('selection');
    setAccepted(false);
    setJudgeReady(false);
    setCheckedIn(false);
    setChecklist([]);
  }, [project, device, slot]);
  const selected = SESSIONS.find(s => s.id === slot && s.available > 0);
  const supported = device === 'standard' || project === '333';
  const validSelection = selected && supported && accepted;
  const projectLabel = eventDisplayName(project, t('zh', 'en') === 'zh');
  const deviceLabel = device === 'smart' ? t('智能魔方', 'Smart cube') : t('普通魔方', 'Standard cube');
  const reset = () => { setStep('selection'); setAccepted(false); setJudgeReady(false); setCheckedIn(false); setChecklist([]); };
  const steps = [t('选择项目与场次', 'Choose an event and session'), t('报名与付款', 'Register and pay'), t('检录候场', 'Check in'), t('实时监督参赛', 'Compete with supervision')];

  return <div className="online-comp">
    <div className="oc-preview-note" role="note">
      <span>{t('交互预览', 'Interactive preview')}</span>
      <p>{t('赛事、日期、名额和费用均为样例。不会创建真实报名、扣款或成绩。', 'Event, dates, capacity and fees are examples. No real registration, charge or result is created.')}</p>
    </div>
    <div className="oc-view-switch">
      <CompactSelect label={view === 'entry' ? t('选手视角', 'Competitor view') : view === 'organizer' ? t('主办方视角', 'Organizer view') : t('监督员视角', 'Supervisor view')} value={view} onChange={value => { void setView(value); }} ariaLabel={t('预览视角', 'Preview role')}
        items={[{ value: 'entry', label: t('选手视角', 'Competitor view') }, { value: 'organizer', label: t('主办方视角', 'Organizer view') }, { value: 'supervisor', label: t('监督员视角', 'Supervisor view') }]} />
      <AppLink href="/platform/events" prefetch={false}>{t('活动首页', 'Events')}<ArrowUpRight size={15} /></AppLink>
    </div>
    <header className="oc-hero">
      <div>
        <p className="oc-eyebrow">CUBEROOT ONLINE</p>
        <h1>{t('在你的空间，\n认真比一场。', 'Your space.\nYour next competition.')}</h1>
        <p className="oc-intro">{t('选择适合你的场次。普通魔方、智能魔方都能参与，全程有监督员在线。', 'Choose a session that fits your schedule. Compete with a standard or smart cube, with a supervisor online throughout.')}</p>
        <div className="oc-facts"><span><Video />{t('线上参赛', 'Online')}</span><span><ShieldCheck />{t('实时监督', 'Live supervision')}</span><span><Trophy />{t('独立分组排名', 'Separate rankings')}</span></div>
      </div>
      <div className="oc-hero-art" aria-hidden="true"><EventIcon event="333" className="oc-hero-cube" /><span className="oc-hero-number">01</span><p>ONLINE OPEN</p></div>
    </header>

    <div className="oc-event-heading"><p className="oc-eyebrow">{t('首场赛事方案', 'Opening event concept')}</p><h2>{t('CubeRoot 秋季线上公开赛', 'CubeRoot Autumn Online Open')}</h2><p><CalendarDays size={17} />2026-10-16 — 2026-10-18 <span>{t('北京时间 UTC+8', 'Beijing time UTC+8')}</span></p></div>

    {view === 'entry' ? <>
      <ol className="oc-steps">{steps.map((label, index) => <li key={label} className={index === (step === 'selection' ? 0 : step === 'summary' ? 1 : 2) ? 'is-active' : ''}><span>0{index + 1}</span>{label}</li>)}</ol>
      <div className="oc-columns">
        <section className="oc-main-content">
          <nav className="oc-tabs" aria-label={t('赛事内容', 'Event information')}>
            {(['schedule', 'rules', 'results'] as const).map((key, index) => <button type="button" key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => { void setTab(key); }}>{[t('项目与场次', 'Events & sessions'), t('参赛规则', 'Rules'), t('比赛成绩', 'Results')][index]}</button>)}
          </nav>
          {tab === 'schedule' ? <>
            <div className="oc-section-heading"><h3>{t('选一个项目，留出一小时', 'Pick an event. Set aside an hour.')}</h3><p>{t('在比赛期限内任选有名额的监督场次。每个项目选择一次。', 'Choose an available supervised session within the competition window. One session per event.')}</p></div>
            <div className="oc-filters">
              <PuzzlePicker selectedEvent={project} wcaEvents={projectSet} availableEvents={new Set()} isZh={t('zh', 'en') === 'zh'} onSelect={value => { if (projectSet.has(value)) { void setProject(value as typeof project); reset(); } }} />
              <CompactSelect label={deviceLabel} value={device} onChange={value => { void setDevice(value); reset(); }} ariaLabel={t('魔方类型', 'Cube type')} items={[{ value: 'standard', label: t('普通魔方', 'Standard cube') }, { value: 'smart', label: t('智能魔方', 'Smart cube') }]} />
              <span>{t('一轮 5 次，ao5', 'One round, 5 attempts, ao5')}</span>
            </div>
            {!supported ? <p className="oc-alert" role="status">{t('智能魔方首期仅展示三阶方案。请切换到三阶或普通魔方；其他智能项目待设备验证后开放。', 'The initial smart-cube concept supports 3×3 only. Choose 3×3 or a standard cube. Other smart events need device validation.')}</p> : <div className="oc-session-list">
              {SESSIONS.map(session => <button type="button" key={session.id} disabled={!session.available} aria-pressed={selected?.id === session.id} onClick={() => { void setSlot(session.id); reset(); }} className={`oc-session${selected?.id === session.id ? ' is-selected' : ''}`}>
                <span className="oc-session-date">{session.date}<strong>{session.time}</strong></span>
                <span className="oc-session-meta"><span><Headphones size={16} />{t('实时监督', 'Supervised')}</span><span>{session.available ? t(`剩余 ${session.available} 个名额`, `${session.available} places available`) : t('已满', 'Full')}</span></span>
                <span className="oc-select-indicator" aria-hidden>{selected?.id === session.id ? <Check size={17} /> : null}</span>
              </button>)}
            </div>}
            <p className="oc-footnote">{t('报名示例截止：2026-10-14 20:00。所有场次均为北京时间，检录提前 10 分钟开始。', 'Example registration closes: 2026-10-14 20:00. All sessions use Beijing time. Check-in opens 10 minutes early.')}</p>
            <div className="oc-guidance"><h3>{t('上场之前', 'Before you compete')}</h3><div><Video /><p><strong>{t('让监督员看清你的操作', 'Keep your solve in view')}</strong>{t('摄像头需拍到双手、魔方与计时结果。普通魔方由监督员当场确认成绩。', 'Show your hands, cube and timer result. The supervisor confirms standard-cube results during the session.')}</p></div><div><ShieldCheck /><p><strong>{t('录像用于争议复核', 'Recording supports disputes')}</strong>{t('无需赛后逐条审核。断线或异常时暂停后续尝试，由监督员处理。', 'There is no routine post-event video review. If disconnected or interrupted, pause further attempts for the supervisor to handle.')}</p></div></div>
          </> : tab === 'rules' ? <div className="oc-rules"><h3>{t('规则方案', 'Proposed rules')}</h3><ol><li>{t('普通二、三、四、五阶分别排名；智能三阶单独排名。', 'Standard 2×2, 3×3, 4×4 and 5×5 have separate rankings; smart 3×3 is ranked separately.')}</li><li>{t('首版建议一轮五次取 ao5。正式赛制以发布时的规则快照为准。', 'The proposed opening format is one average of five. Published rules define the actual format.')}</li><li>{t('选手只能在所选监督场次内参赛，检录后等待监督员确认。正式打乱由服务端按尝试分配。', 'Compete in your reserved session. After check-in, wait for supervisor approval. The server assigns official scrambles per attempt.')}</li><li>{t('监督员当场确认成绩与罚时，并记录异常原因。选手不能自行覆盖已确认的正式成绩。', 'The supervisor confirms results and penalties, recording reasons for incidents. Competitors cannot overwrite confirmed results.')}</li><li>{t('录像仅用于争议复核。保存期限、申诉期限和退款政策须在真实赛事报名开放前明确。', 'Recordings are for dispute review. Retention, appeal deadlines and refund policies must be published before real registration opens.')}</li><li>{t('报名费由 CubeRoot 统一收取。主办方按约定结算；未配置结算条款的赛事不能开放收费。', 'CubeRoot collects registration fees centrally and settles with organizers under agreed terms. Paid registration requires configured settlement terms.')}</li></ol></div> : <div className="oc-empty"><Trophy /><h3>{t('成绩将在比赛后公示', 'Results follow the competition')}</h3><p>{t('当前没有正式成绩。普通组和智能组分榜，争议处理后发布最终结果。', 'There are no official results yet. Standard and smart divisions are separate; final results follow dispute resolution.')}</p></div>}
        </section>
        <aside className="oc-entry-summary" aria-label={t('我的参赛安排', 'My entry')}>
          <p className="oc-eyebrow">{t('我的参赛安排', 'YOUR ENTRY')}</p>
          <h3><EventIcon event={project} />{projectLabel} <span>{deviceLabel}</span></h3>
          <dl><div><dt>{t('监督场次', 'Session')}</dt><dd>{selected ? <>{selected.date}<br />{selected.time}</> : t('请先选择场次', 'Choose a session')}</dd></div><div><dt>{t('参赛费用示例', 'Example entry fee')}</dt><dd className="oc-price">¥10.00</dd></div><div><dt>{t('收款方', 'Collected by')}</dt><dd>CubeRoot</dd></div></dl>
          <p className="oc-footnote">{t('仅演示单项目费用。正式价格和退款条件以赛事发布内容为准。', 'Single-event example only. Published terms define actual prices and refunds.')}</p>
          {step === 'selection' ? <><BoolToggle value={accepted} onChange={setAccepted} label={t('已了解实时监督与分榜规则', 'I understand supervision and separate rankings')} /><button type="button" className="oc-primary" disabled={!validSelection} onClick={() => setStep('summary')}>{t('预览报名确认', 'Preview registration')}<ArrowUpRight size={17} /></button></> : step === 'summary' ? <div className="oc-next-step"><h4>{t('确认报名信息', 'Review your entry')}</h4><p>{t('真实流程将在这里创建订单，由 CubeRoot 收款。付款确认后才获得参赛资格。', 'The live flow creates an order collected by CubeRoot. Eligibility follows confirmed payment.')}</p><button type="button" className="oc-primary" disabled={!validSelection} onClick={() => setStep('waiting')}>{t('预览付款后的候场页', 'Preview the waiting room')}</button><button type="button" className="oc-text-button" onClick={reset}>{t('重新选择', 'Change selection')}</button></div> : <div className="oc-next-step"><h4>{t('候场预览', 'Waiting-room preview')}</h4><p>{t('真实检录只在所选场次开放。本预览不会连接摄像头或监督员。', 'Real check-in opens for your reserved session. This preview does not connect a camera or supervisor.')}</p><button type="button" className="oc-primary" onClick={() => setCheckedIn(true)} disabled={checkedIn}>{checkedIn ? t('已模拟检录，等待监督员', 'Simulated check-in: waiting') : t('模拟检录', 'Simulate check-in')}</button><button type="button" className="oc-text-button" onClick={reset}>{t('重新选择', 'Change selection')}</button></div>}
          <div className="oc-summary-help"><Clock3 size={16} /><span>{t('未获监督员确认前，不能开始正式尝试。', 'Official attempts require supervisor approval.')}</span></div>
        </aside>
      </div>
    </> : view === 'organizer' ? <section className="oc-workspace"><div className="oc-section-heading"><h3>{t('主办方工作区预览', 'Organizer workspace preview')}</h3><p>{t('平台审核办赛申请后，仅授予本组织赛事权限。', 'After application approval, organizers receive access only to their own events.')}</p></div><div className="oc-workflow">{[t('提交办赛申请', 'Apply to host'), t('配置项目与监督场次', 'Configure events and sessions'), t('明确费用与结算条款', 'Set fees and settlement terms'), t('发布报名', 'Open registration')].map((s, i) => <div key={s}><span>0{i + 1}</span><h4>{s}</h4></div>)}</div><h3>{t('监督排班', 'Supervision schedule')}</h3>{SESSIONS.map(s => <div className="oc-workspace-row" key={s.id}><strong>{s.date} {s.time}</strong><span>{t('监督员待分配', 'Supervisor unassigned')}</span></div>)}<div className="oc-finance"><Wallet /><div><h3>{t('平台统一收款，按赛事结算', 'Central collection, settlement per event')}</h3><p>{t('真实账目将列出收款、退款、平台费用与可结算金额。目前没有真实交易。抽成和结算周期未定，正式收费发布入口保持关闭。', 'The live ledger will show receipts, refunds, platform fees and settlement eligibility. There are no real transactions. Paid publication stays closed until commission and settlement timing are agreed.')}</p></div></div></section> : <section className="oc-workspace"><div className="oc-section-heading"><h3>{t('监督员工作区预览', 'Supervisor workspace preview')}</h3><p>{t('这里只演示检查流程。正式监督员须登录并被分配到该场次，且不能监督自己的成绩。', 'This demonstrates the checklist. Real supervisors must sign in and be assigned to the session, and cannot supervise their own results.')}</p></div><h4>{t('示例选手的赛前检查', 'Sample competitor check-in')}</h4><div className="oc-judge-checks">{[t('画面包含双手、魔方与计时器', 'Hands, cube and timer are visible'), t('身份与所报项目一致', 'Identity and registered event match'), t('音视频正常，选手已准备', 'Audio and video work; competitor is ready')].map((label, i) => <BoolToggle key={i} value={checklist.includes(String(i))} onChange={value => { setChecklist(items => value ? [...items, String(i)] : items.filter(item => item !== String(i))); setJudgeReady(false); }} label={label} />)}</div><button type="button" className="oc-primary" disabled={checklist.length !== 3} onClick={() => setJudgeReady(true)}>{t('模拟监督员确认', 'Simulate supervisor approval')}</button>{judgeReady ? <p className="oc-alert" role="status">{t('检查流程已演示。正式尝试需要服务端授权和有效参赛资格；本页不生成打乱或成绩。', 'Checklist demonstrated. Official attempts require server authorization and valid eligibility; this page generates no scrambles or results.')}</p> : null}</section>}
  </div>;
}
