'use client';

import { useEffect, useState } from 'react';
import { parseAsInteger, parseAsStringEnum, useQueryState } from 'nuqs';
import { ArrowRight, BookOpen, Plus, Receipt, UserRound, UsersRound, Wallet } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { CompactSelect } from '@/components/CompactSelect';
import Paginator from '@/components/wca-stats/Paginator';
import { entityStatusLabel } from '@/components/teaching/TeachingUi';
import { useT } from '@/hooks/useT';
import { commerceMoney, commerceText } from '@/lib/platform-commerce-format';
import { courseCatalogDetails } from '@/lib/platform-course-catalog';
import { platformLearningRequest } from '@/lib/platform-learning';
import { PLATFORM_INSTRUCTOR_PAGE_SIZES } from '@/lib/platform-routes';
import { PlatformCourseCover } from './PlatformCourseCatalog';
import { PlatformState } from './PlatformState';
import { InstructorPayoutSettings } from './InstructorPayoutSettings';

type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.filter((item): item is Row => !!item && typeof item === 'object') : [];
const text = (value: unknown) => typeof value === 'string' ? value : '';
const money = (amount: unknown, currency: unknown) => amount == null ? '—' : commerceMoney(amount, currency);
const root = '/platform/instructor';

function ledgerMonths(data: Row) {
  return rows(data.months).filter(row => /^\d{4}-\d{2}$/.test(text(row.month)) && /^[A-Z]{3}$/.test(text(row.currency)));
}

function MonthlyMetric({ data }: { data: Row }) {
  const t = useT();
  const months = ledgerMonths(data);
  const currentMonth = text(data.currentMonth);
  const month = currentMonth || months.map(row => text(row.month)).sort().at(-1);
  const records = months.filter(row => row.month === month);
  return <div><dt><Wallet size={18} aria-hidden />{currentMonth ? t('本月净收入','This month’s net earnings') : t('最近月净收入','Latest monthly net earnings')}</dt>
    <dd>{records.length ? records.map(row => <span key={text(row.currency)}>{money(row.netAmountMinor,row.currency)}</span>) : <span className="platform-instructor-metric-empty">{t('暂无收入记录','No earnings yet')}</span>}{month && <small>{month}</small>}</dd></div>;
}

function transactionLabel(row: Row, t: ReturnType<typeof useT>) {
  const labels: Record<string,[string,string]> = { sale:['销售分成','Sales share'],refund:['退款','Refund'],chargeback:['拒付','Chargeback'],adjustment:['账本调整','Ledger adjustment'],reversal:['冲销','Reversal'] };
  return labels[text(row.entryType)] ? t(...labels[text(row.entryType)]) : t('课程交易','Course transaction');
}

function TransactionList({ items }: {items: Row[]}) {
  const t = useT();
  if (!items.length) return <div className="platform-instructor-activity-empty"><Receipt size={30} aria-hidden /><p>{t('暂无交易记录','No transactions yet')}</p></div>;
  return <ul className="platform-instructor-activity-list">{items.map(row => <li key={String(row.id)}>
    <span className="platform-instructor-activity-icon"><Receipt size={19} aria-hidden /></span>
    <div><strong>{transactionLabel(row,t)}</strong>{row.studentName != null && <small>{text(row.studentName)}</small>}{row.orderNumber != null && <small>{text(row.orderNumber)}</small>}<small>{text(row.createdAt).slice(0,10)}</small></div>
    <strong>{money(row.amountMinor,row.currency)}</strong>
  </li>)}</ul>;
}

export function InstructorOverview({ data }: {data: Row}) {
  const t = useT();
  const tasks = [
    { href:`${root}/courses`, icon:BookOpen, title:t('课程管理','Manage courses'), description:t('创建、编辑和发布课程','Create, edit and publish courses') },
    { href:`${root}/students`, icon:UsersRound, title:t('学员管理','Manage learners'), description:t('学员进度与结课证书','Learner progress and completion certificates') },
    { href:`${root}/earnings`, icon:Wallet, title:t('收入与结算','Earnings and payouts'), description:t('查看分成、订单、收款及提现','Review earnings, orders and request payouts') },
    { href:`${root}/profile`, icon:UserRound, title:t('讲师资料','Teaching profile'), description:t('编辑个人主页及公开设置','Edit your public profile and visibility') },
  ];
  const courses = rows(data.recentCourses);
  return <div className="platform-learning-workspace platform-instructor-dashboard">
    <section className="platform-instructor-overview">
      <div className="platform-instructor-overview-heading"><div><h2>{t('教学概览','Teaching overview')}</h2><p>{t('查看教学进展与经营状况。','Review your teaching and business activity.')}</p></div><AppLink className="platform-button platform-button-primary" href={`${root}/courses/new`} prefetch={false}><Plus aria-hidden />{t('创建课程','Create course')}</AppLink></div>
      <dl className="platform-instructor-metrics platform-studio-metrics">
        <div><dt><BookOpen size={18} aria-hidden />{t('课程总数','Total courses')}</dt><dd>{Number(data.courseCount??0)}</dd><AppLink href={`${root}/courses`}>{t('管理课程','Manage courses')}<ArrowRight size={14} aria-hidden /></AppLink></div>
        <div><dt><UsersRound size={18} aria-hidden />{t('有效学员','Active learners')}</dt><dd>{Number(data.studentCount??0)}</dd><AppLink href={`${root}/students`}>{t('查看学员','View learners')}<ArrowRight size={14} aria-hidden /></AppLink></div>
        <MonthlyMetric data={data}/>
        <div><dt><Wallet size={18} aria-hidden />{t('可提现金额','Available for payout')}</dt><dd>{money(data.availableMinor,data.availableCurrency)}</dd><AppLink href={`${root}/earnings?earningsView=payouts`}>{t('前往结算','Manage payouts')}<ArrowRight size={14} aria-hidden /></AppLink></div>
      </dl>
    </section>
    <section className="platform-instructor-task-section platform-instructor-mobile-tasks"><h2>{t('常用操作','Teaching tasks')}</h2><div className="platform-instructor-task-grid">{tasks.map(({href,icon:Icon,title,description}) => <AppLink key={href} href={href} prefetch={false} className="platform-learning-panel platform-instructor-task" data-site-surface="panel"><span className="platform-instructor-task-icon"><Icon size={23} aria-hidden /></span><div><h3>{title}</h3><p>{description}</p></div><ArrowRight className="platform-instructor-task-arrow" size={18} aria-hidden /></AppLink>)}</div></section>
    <div className="platform-instructor-dashboard-body">
      <section className="platform-learning-panel" data-site-surface="panel"><div className="platform-instructor-activity-heading"><h2>{t('近期课程','Recent courses')}</h2><AppLink href={`${root}/courses`} prefetch={false}>{t('查看全部','View all')}<ArrowRight size={15} aria-hidden /></AppLink></div>
        {courses.length ? <ul className="platform-studio-course-list">{courses.map(course => {
          const title = commerceText(course,'title',t) || t('未命名课程','Untitled course');
          const details = courseCatalogDetails({id:String(course.id),title,data:course});
          return <li key={String(course.id)}><AppLink href={`${root}/courses/${course.id}`} prefetch={false}><PlatformCourseCover {...details}/><div><strong>{title}</strong><small>{course.status==='unlisted'?t('不公开列出','Unlisted'):entityStatusLabel(text(course.status),t)}</small>{course.publishedLessons != null && <small>{t(`${course.publishedLessons} 节已发布课时`,`${course.publishedLessons} published lessons`)}</small>}{course.learnerCount != null && <small>{t(`${course.learnerCount} 位有效学员`,`${course.learnerCount} active learners`)}</small>}</div><ArrowRight size={16} aria-hidden /></AppLink></li>;
        })}</ul> : <PlatformState kind={Array.isArray(data.recentCourses)?'empty':'error'} title={Array.isArray(data.recentCourses)?t('暂无课程','No courses yet'):t('暂无法读取课程','Courses unavailable')}/>}
      </section>
      <section className="platform-learning-panel platform-instructor-activity" data-site-surface="panel"><div className="platform-instructor-activity-heading"><h2>{t('近期交易','Recent transactions')}</h2><AppLink href={`${root}/earnings?earningsView=transactions`} prefetch={false}>{t('查看全部','View all')}<ArrowRight size={15} aria-hidden /></AppLink></div><TransactionList items={rows(data.recent).slice(0,4)}/></section>
    </div>
  </div>;
}

function EarningsTrend({ data }: { data: Row }) {
  const t = useT();
  const months = ledgerMonths(data);
  const currencies = [...new Set(months.map(row => text(row.currency)))].sort();
  const [selected,setSelected] = useState('CNY');
  const currency = currencies.includes(selected) ? selected : currencies[0];
  const history = months.filter(row => row.currency === currency).sort((a,b) => text(b.month).localeCompare(text(a.month)));
  const records = history.slice(0,12).reverse();
  const max = Math.max(1,...records.map(row => Math.abs(Number(row.netAmountMinor)||0)));
  return <section className="platform-learning-panel platform-studio-trend" data-site-surface="panel">
    <div className="platform-instructor-activity-heading"><h2>{t('月度收入趋势','Monthly earnings trend')}</h2>{currencies.length>1 && <CompactSelect ariaLabel={t('币种','Currency')} label={currency} value={currency} items={currencies.map(value=>({value,label:value}))} onChange={setSelected}/>}</div>
    <p>{t('最近十二个有记录的账本月份，按币种展示实际净收入。','Actual net earnings for the latest 12 recorded ledger months, by currency.')}</p>
    {records.length ? <><div className="platform-studio-chart" aria-label={t('净收入趋势','Net earnings trend')}>{records.map(row => {
      const amount=Number(row.netAmountMinor); const width=Math.min(100,Math.abs(amount)/max*100);
      return <div className="platform-studio-chart-row" key={text(row.month)}><span>{text(row.month)}</span><div className="platform-studio-chart-track" aria-hidden="true"><div className="platform-studio-chart-negative">{amount<0&&<i style={{width:`${width}%`}}/>}</div><div className="platform-studio-chart-positive">{amount>=0&&<i style={{width:`${width}%`}}/>}</div></div><strong>{money(row.netAmountMinor,row.currency)}</strong></div>;
    })}</div><div className="platform-studio-month-table"><h3>{t('全部月度记录','All monthly records')}</h3><table><thead><tr><th>{t('月份','Month')}</th><th>{t('订单','Orders')}</th><th>{t('销售分成','Sales share')}</th><th>{t('退款与拒付','Refunds and chargebacks')}</th><th>{t('净收入','Net earnings')}</th></tr></thead><tbody>{history.map(row=><tr key={text(row.month)}><th scope="row">{text(row.month)}</th><td>{Number(row.orders)}</td><td>{money(row.saleAmountMinor,row.currency)}</td><td>{money(row.refundAmountMinor,row.currency)}</td><td>{money(row.netAmountMinor,row.currency)}</td></tr>)}</tbody></table></div></>:<PlatformState kind="empty" title={t('暂无收入记录','No earnings yet')}/>}
  </section>;
}

function InstructorTransactions() {
  const t = useT();
  const [rawPage,setPage]=useQueryState('page',parseAsInteger.withDefault(1));
  const defaultSize=PLATFORM_INSTRUCTOR_PAGE_SIZES[0];
  const [rawSize,setSize]=useQueryState('pageSize',parseAsInteger.withDefault(defaultSize));
  const page=Math.max(1,rawPage), size=PLATFORM_INSTRUCTOR_PAGE_SIZES.includes(rawSize)?rawSize:defaultSize;
  const [revision,setRevision]=useState(0);
  const [result,setResult]=useState<Row|null>(null), [error,setError]=useState(false);
  useEffect(()=>{
    const abort=new AbortController();setResult(null);setError(false);
    void platformLearningRequest<Row>(`/instructor/earnings?page=${page}&pageSize=${size}&v=2`,undefined,'GET',abort.signal).then(value=>{if(!abort.signal.aborted)setResult(value);}).catch(()=>{if(!abort.signal.aborted)setError(true);});
    return ()=>abort.abort();
  },[page,size,revision]);
  if(error)return <PlatformState kind="error" onRetry={()=>setRevision(value=>value+1)}/>;
  if(!result)return <ContentSkeleton variant="list" rows={5} label={t('正在加载交易…','Loading transactions…')}/>;
  const all=rows(result.items), total=Number(result.total??all.length);
  const items=result.total==null?all.slice((page-1)*size,page*size):all;
  return <><section className="platform-learning-panel" data-site-surface="panel"><h2>{t('交易明细','Transaction history')}</h2><TransactionList items={items}/></section><Paginator page={page} totalPages={Math.max(1,Math.ceil(total/size))} size={size} pageSizeOptions={PLATFORM_INSTRUCTOR_PAGE_SIZES} isZh={t('zh','en')==='zh'} className="platform-pagination" onPageChange={value=>void setPage(value)} onSizeChange={value=>{void setSize(value);void setPage(1);}}/></>;
}

export function InstructorEarnings({ data }: { data: Row }) {
  const t=useT();
  const [view,setView]=useQueryState('earningsView',parseAsStringEnum(['overview','transactions','payouts'] as const).withDefault('overview'));
  const [openedPayouts,setOpenedPayouts]=useState(view==='payouts');
  const [payoutSnapshot,setPayoutSnapshot]=useState<{availableMinor:number;payouts:Row[]}|null>(null);
  useEffect(()=>{if(view==='payouts')setOpenedPayouts(true);},[view]);
  const byId=new Map(rows(data.payouts).map(row=>[String(row.id),row]));
  for(const row of payoutSnapshot?.payouts??[])byId.set(String(row.id),row);
  const payouts=[...byId.values()].filter(row=>row.currency==='CNY');
  const sum=(statuses:string[])=>Array.isArray(data.payouts)?payouts.filter(row=>statuses.includes(text(row.status))).reduce((value,row)=>value+Number(row.amountMinor),0):null;
  const views=[['overview',t('收入概览','Overview')],['transactions',t('交易明细','Transactions')],['payouts',t('收款与结算','Payouts')]] as const;
  return <div className="platform-learning-workspace platform-instructor-earnings">
    <div className="platform-studio-view-nav" role="group" aria-label={t('收入管理','Earnings management')}>{views.map(([value,label])=><button className="platform-studio-view-button" key={value} type="button" aria-pressed={view===value} onClick={()=>void setView(value)}>{label}</button>)}</div>
    {view==='overview'&&<><dl className="platform-instructor-metrics platform-studio-metrics"><MonthlyMetric data={data}/><div><dt>{t('可提现金额','Available for payout')}</dt><dd>{money(payoutSnapshot?.availableMinor??data.availableMinor,data.availableCurrency??'CNY')}</dd></div><div><dt>{t('待处理结算（人民币）','Pending payouts (CNY)')}</dt><dd>{money(sum(['draft','approved','processing']),'CNY')}</dd></div><div><dt>{t('已到账（人民币）','Paid out (CNY)')}</dt><dd>{money(sum(['paid']),'CNY')}</dd></div></dl><EarningsTrend data={data}/></>}
    {(view==='payouts'||openedPayouts)&&<div hidden={view!=='payouts'}><InstructorPayoutSettings history={rows(data.payouts)} active={view==='payouts'} onBalanceChange={setPayoutSnapshot}/></div>}
    {view==='transactions'&&<InstructorTransactions/>}
  </div>;
}
