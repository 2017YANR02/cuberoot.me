'use client';

import { useEffect, useState } from 'react';
import { parseAsInteger, parseAsStringEnum, useQueryState } from 'nuqs';
import Paginator from '@/components/wca-stats/Paginator';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useAuthUser } from '@/lib/auth-store';
import { apiUrl } from '@/lib/api-base';
import { renderArticleMarkdown } from '@/lib/article-markdown';
import { platformLearningRequest, learningTime, type LearningNote } from '@/lib/platform-learning';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
import { PlatformState } from './PlatformState';
import './platform-learning.css';

type Row = Record<string, unknown>;
const rows=(value:unknown):Row[]=>Array.isArray(value)?value.filter((item):item is Row=>!!item&&typeof item==='object'):[];
const text=(value:unknown)=>typeof value==='string'?value:'';
const localized=(row:Row,key:string,english:boolean)=>text(row[`${key}${english?'En':'Zh'}`])||text(row[`${key}Zh`])||text(row[`${key}En`])||text(row[key]);
function money(value:unknown,currency:unknown){return new Intl.NumberFormat(undefined,{style:'currency',currency:/^[A-Z]{3}$/.test(String(currency))?String(currency):'CNY'}).format(Number(value??0)/100);}
const WORKSPACE_IDS=new Set(['account-courses','account-notes','account-badges','progress','account-progress','instructor','instructor-students','instructor-earnings','leaderboard']);
export function isPlatformLearningWorkspace(id:string){return WORKSPACE_IDS.has(id);}

export function PlatformLearningWorkspace({definition}:{definition:PlatformRouteDefinition;params?:Record<string,string>;entity?:PlatformEntity;entities?:PlatformEntity[]}){
  const t=useT();const english=t('zh','en')==='en';const [data,setData]=useState<Row|null>(null);const [error,setError]=useState('');const [revision,setRevision]=useState(0);const [busy,setBusy]=useState(false);
  const id=definition.id;
  const [page,setPage]=useQueryState('page',parseAsInteger.withDefault(1));
  const [requestedSize,setSize]=useQueryState('pageSize',parseAsInteger.withDefault(12));
  const size=[12,30,60].includes(requestedSize)?requestedSize:12;
  const [metric,setMetric]=useQueryState('metric',parseAsStringEnum(['points','learning'] as const).withDefault('points'));
  const [period,setPeriod]=useQueryState('period',parseAsStringEnum(['week','month','all'] as const).withDefault('all'));
  const pageQuery=`?page=${Math.max(1,page)}&pageSize=${[12,30,60].includes(size)?size:12}`;
  const reload=()=>setRevision(value=>value+1);
  useEffect(()=>{const abort=new AbortController();setData(null);setError('');void(async()=>{
    let result:Row;
    if(id==='account-courses'||id==='progress'||id==='account-progress'){
      const [courses,certificates,checkins]=await Promise.all([platformLearningRequest<Row>(`/me/courses${pageQuery}`,undefined,'GET',abort.signal),platformLearningRequest<Row>('/me/certificates',undefined,'GET',abort.signal),platformLearningRequest<Row>(`/me/checkins?timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`,undefined,'GET',abort.signal)]);
      result={...courses,certificates:certificates.items,checkins};
    }else result=await platformLearningRequest<Row>(id==='leaderboard'?`/leaderboard${pageQuery}&metric=${metric}&period=${period}&v=3`:id==='account-notes'?`/me/notes${pageQuery}`:id==='account-badges'?'/me/badges':id==='instructor-students'?`/instructor/students${pageQuery}`:'/instructor/dashboard',undefined,'GET',abort.signal);
    if(!abort.signal.aborted)setData(result);
  })().catch(reason=>{if(!abort.signal.aborted)setError(String(reason.message??reason));});return()=>abort.abort();},[id,revision,pageQuery,metric,period]);
  const mutate=async(path:string,payload:Row,method='POST')=>{setBusy(true);setError('');try{const result=await platformLearningRequest<Row>(path,payload,method);reload();return result;}catch(reason){setError(String(reason));return null;}finally{setBusy(false);}};
  if(!data)return <PlatformState kind={error?'error':'loading'} message={error} onRetry={reload}/>;
  const items=rows(data.items);
  const pager=<Paginator page={Math.max(1,page)} totalPages={Math.max(1,Math.ceil(Number(data.total??items.length)/size))} size={size} pageSizeOptions={[12,30,60]} isZh={!english} className="platform-toolbar" onPageChange={value=>void setPage(value)} onSizeChange={value=>{void setSize(value);void setPage(1);}}/>;
  if(id==='leaderboard')return <div className="platform-learning-workspace"><div className="platform-toolbar"><label>{t('榜单','Leaderboard')}<select className="platform-field-control" value={metric} onChange={event=>{void setMetric(event.target.value as 'points'|'learning');void setPage(1);}}><option value="points">{t('积分','Points')}</option><option value="learning">{t('学习','Learning')}</option></select></label><label>{t('时间','Period')}<select className="platform-field-control" value={period} onChange={event=>{void setPeriod(event.target.value as 'week'|'month'|'all');void setPage(1);}}><option value="week">{t('近七天','Last 7 days')}</option><option value="month">{t('近三十天','Last 30 days')}</option><option value="all">{t('全部时间','All time')}</option></select></label><AppLink href="/timer">{t('前往计时器','Open timer')}</AppLink></div>{items.map(item=><article key={String(item.id)} className="platform-learning-panel" data-site-surface="panel"><strong>{Number(item.rank)} · {text(item.title)}</strong><p>{text(item.value)} {metric==='points'?t('积分','points'):t('节已完成课时','completed lessons')}</p></article>)}{!items.length?<PlatformState kind="empty"/>:null}{pager}</div>;
  if(id==='account-courses'||id==='progress'||id==='account-progress'){
    const checkin=data.checkins as Row;
    return <div className="platform-learning-workspace">{error?<p role="alert">{error}</p>:null}
      <section className="platform-learning-panel" data-site-surface="panel"><h2>{t('学习打卡','Study check-in')}</h2><p>{t('当前连续','Current streak')} {Number(checkin.current)} · {t('最长连续','Longest streak')} {Number(checkin.longest)} · {t('积分','Points')} {Number(checkin.balance)}</p><button className="platform-button" type="button" disabled={busy||Boolean(checkin.checkedToday)} onClick={()=>void mutate('/me/checkins',{timezone:checkin.timezone,localDate:checkin.today})}>{checkin.checkedToday?t('今日已签到','Checked in today'):t('今日签到 +5','Check in today +5')}</button><AppLink className="platform-button" href="/platform/account/badges">{t('我的徽章','My badges')}</AppLink></section>
      <div className="platform-learning-cards">{items.map(course=>{const total=Number(course.totalLessons);const complete=Number(course.completedLessons);const percent=Number(course.progressBps)/100;const presentation=(course.presentation??{}) as Row;const certificate=rows(data.certificates).find(row=>row.courseId===course.id&&row.status==='issued');return <article className="platform-learning-panel" data-site-surface="panel" key={String(course.id)}>
        {presentation.coverUrl?<img className="platform-learning-cover" src={text(presentation.coverUrl)} alt="" loading="lazy"/>:null}<h2>{localized(course,'title',english)}</h2><p>{complete}/{total} · {Math.round(percent)}%</p><progress max={10000} value={Number(course.progressBps)}/>
        <div className="platform-write-actions"><AppLink className="platform-button platform-button-primary" href={`/platform/courses/${course.id}${course.continueLessonId?`/learn/${course.continueLessonId}`:''}`} prefetch={false}>{t('继续学习','Continue learning')}</AppLink>
        {certificate?.verificationCode?<AppLink className="platform-button" href={`/platform/cert/${certificate.verificationCode}`} prefetch={false}>{t('查看结课证书','View certificate')}</AppLink>:total>0&&complete===total?<button className="platform-button" disabled={busy} type="button" onClick={()=>void mutate('/me/certificates',{courseId:course.id})}>{t('领取结课证书','Claim certificate')}</button>:null}</div>
      </article>;})}</div>{!items.length?<PlatformState kind="empty"/>:null}{pager}
    </div>;
  }
  if(id==='account-notes'){
    const groups=new Map<string,LearningNote[]>();for(const raw of items){const note=raw as unknown as LearningNote;const key=note.courseId??'';groups.set(key,[...(groups.get(key)??[]),note]);}
    return <div className="platform-learning-workspace">{error?<p role="alert">{error}</p>:null}{[...groups].map(([courseId,notes])=><section key={courseId}><h2><AppLink href={`/platform/courses/${courseId}`} prefetch={false}>{localized(notes[0] as unknown as Row,'courseTitle',english)||t('课程','Course')}</AppLink></h2>{notes.map(note=><article key={note.id} className="platform-learning-panel" data-site-surface="panel"><h3>{note.title}</h3><AppLink href={`/platform/courses/${courseId}/learn/${note.lessonId}?t=${note.positionSeconds??0}`} prefetch={false}>{learningTime(note.positionSeconds??0)} · {t('回到视频','Return to video')}</AppLink><div className="platform-prose">{renderArticleMarkdown(note.body)}</div><div className="platform-write-actions"><AppLink href={`/platform/courses/${courseId}/learn/${note.lessonId}?t=${note.positionSeconds??0}`} prefetch={false}>{t('在课堂编辑','Edit in classroom')}</AppLink><button type="button" className="platform-text-button" disabled={busy} onClick={()=>{if(window.confirm(t('删除这条笔记？','Delete this note?')))void mutate(`/me/notes/${note.id}`,{},'DELETE');}}>{t('删除','Delete')}</button></div></article>)}</section>)}{!items.length?<PlatformState kind="empty"/>:null}{pager}</div>;
  }
  if(id==='account-badges')return <div className="platform-learning-workspace"><p>{t('已解锁','Unlocked')} {items.filter(item=>item.awardedAt).length}/{items.length}</p><button className="platform-button" type="button" disabled={busy} onClick={()=>void mutate('/me/badges/refresh',{})}>{t('检查新成就','Check for new achievements')}</button>{error?<p role="alert">{error}</p>:null}<div className="platform-learning-cards">{items.map(item=>{const rule=(item.rule??{}) as Row;return <article key={String(item.id)} className="platform-learning-panel" data-site-surface="panel"><h2>{localized(item,'title',english)}</h2><p>{localized(item,'description',english)}</p><p>{item.awardedAt?t('已解锁','Unlocked'):t('尚未解锁','Locked')} · +{Number(item.pointReward)}</p><progress value={Math.min(Number(item.progress),Number(rule.threshold))} max={Number(rule.threshold)||1}/>{item.awardedAt?<time>{new Date(String(item.awardedAt)).toLocaleDateString()}</time>:<p>{Number(item.progress)}/{Number(rule.threshold)}</p>}</article>;})}</div></div>;
  if(id==='instructor-students')return <div className="platform-learning-workspace">{error?<p role="alert">{error}</p>:null}{items.map(student=><article className="platform-learning-panel" data-site-surface="panel" key={String(student.id)}><h2>{text(student.title)}</h2><p>{localized(student,'courseTitle',english)}</p><p>{t('完成课时','Completed lessons')} {Number(student.completedLessons)}/{Number(student.totalLessons)}</p><p>{text(student.validFrom)?.slice(0,10)} — {text(student.validUntil)?.slice(0,10)||t('长期有效','No expiry')}</p><button type="button" className="platform-button" disabled={busy||student.status!=='active'} onClick={()=>void mutate('/instructor/certificates',{courseId:student.courseId,userId:Number(student.userId),recipientName:student.title})}>{t('签发证书','Issue certificate')}</button></article>)}{!items.length?<PlatformState kind="empty"/>:null}{pager}</div>;
  return <div className="platform-learning-workspace"><div className="platform-learning-cards"><article className="platform-learning-panel" data-site-surface="panel"><h2>{t('课程','Courses')}</h2><strong>{Number(data.courseCount)}</strong></article><article className="platform-learning-panel" data-site-surface="panel"><h2>{t('有效学员','Active learners')}</h2><strong>{Number(data.studentCount)}</strong></article></div>
    <h2>{t('月度收入','Monthly earnings')}</h2><p>{t('金额为你的实际分成，退款与调整按账本计入对应月份，币种分别统计。','Amounts are your actual revenue share. Refunds and adjustments follow their ledger month; currencies remain separate.')}</p><div className="platform-learning-cards">{rows(data.months).map(month=><article key={`${month.month}-${month.currency}`} className="platform-learning-panel" data-site-surface="panel"><h3>{text(month.month)} · {text(month.currency)}</h3><dl><dt>{t('订单','Orders')}</dt><dd>{Number(month.orders)}</dd><dt>{t('销售分成','Sales share')}</dt><dd>{money(month.saleAmountMinor,month.currency)}</dd><dt>{t('退款','Refunds')}</dt><dd>{money(month.refundAmountMinor,month.currency)}</dd><dt>{t('净收入','Net earnings')}</dt><dd>{money(month.netAmountMinor,month.currency)}</dd></dl></article>)}</div>
    <h2>{t('结算记录','Payouts')}</h2>{rows(data.payouts).map(payout=><article key={String(payout.id)} className="platform-learning-panel" data-site-surface="panel"><h3>{text(payout.payoutNumber)}</h3><p>{money(payout.amountMinor,payout.currency)} · {payout.status==='paid'?t('已到账','Paid'):payout.status==='failed'?t('失败','Failed'):payout.status==='cancelled'?t('已取消','Cancelled'):t('处理中','Processing')}</p><p>{text(payout.paidAt)?.slice(0,10)} {text(payout.providerReference)}</p></article>)}{!rows(data.payouts).length?<p>{t('暂无结算记录','No payouts yet')}</p>:null}
    <h2>{t('最近订单','Recent orders')}</h2>{rows(data.recent).map(order=><article key={String(order.id)} className="platform-learning-panel" data-site-surface="panel"><h3>{text(order.studentName)}</h3><p>{text(order.orderNumber)} · {money(order.amountMinor,order.currency)} · {text(order.createdAt)?.slice(0,10)}</p></article>)}
  </div>;
}

export function PlatformCoursePresentation({entity}:{entity:PlatformEntity}){
  const t=useT();const english=t('zh','en')==='en';const data=entity.data??{};const details=(data.presentation??{}) as Row;const amount=Number(data.baseAmountMinor);return <section className="platform-learning-course-intro">
    {details.coverUrl?<img className="platform-learning-cover" src={text(details.coverUrl)} alt=""/>:null}<p>{localized(data,'summary',english)}</p><p>{[text(details.level),text(details.format),...(Array.isArray(details.tags)?details.tags.map(String):[])].filter(Boolean).join(' · ')}</p><p className="platform-learning-price">{Number.isFinite(amount)?amount===0?t('免费','Free'):money(amount,data.currency):null}</p>
    {localized(data,'description',english)?<div className="platform-prose">{renderArticleMarkdown(localized(data,'description',english))}</div>:null}
    {details.nextLiveAt?<p>{t('下次直播','Next live session')} {new Date(text(details.nextLiveAt)).toLocaleString()}</p>:null}
    {details.previewUrl?<video controls playsInline preload="metadata" className="platform-learning-cover" src={text(details.previewUrl)} poster={text(details.coverUrl)||undefined}/>:null}
    {Array.isArray(details.highlights)&&details.highlights.length?<><h2>{t('课程亮点','Highlights')}</h2><ul>{details.highlights.map((item,index)=><li key={index}>{String(item)}</li>)}</ul></>:null}
    {rows(details.outline).length?<><h2>{t('课程大纲','Course outline')}</h2><ol>{rows(details.outline).map((item,index)=><li key={index}><strong>{text(item.label)}</strong> {text(item.topic)}</li>)}</ol></>:null}
  </section>;
}

export function PlatformLearningPath({entity}:{entity:PlatformEntity}){
  const t=useT();const user=useAuthUser();const english=t('zh','en')==='en';const [courses,setCourses]=useState<Row[]>([]);const [lessonProgress,setLessonProgress]=useState<Row[]>([]);const [error,setError]=useState('');
  useEffect(()=>{if(!user)return;const abort=new AbortController();void Promise.all([platformLearningRequest<Row>('/me/courses',undefined,'GET',abort.signal),platformLearningRequest<Row>('/me/progress',undefined,'GET',abort.signal)]).then(([a,b])=>{setCourses(rows(a.items));setLessonProgress(rows(b.items));}).catch(reason=>{if(!abort.signal.aborted)setError(String(reason));});return()=>abort.abort();},[user]);
  const items=rows(entity.data?.items);
  const total=items.reduce((sum,item)=>sum+Number(item.totalLessons??(item.lessonId?1:0)),0);
  const complete=items.reduce((sum,item)=>sum+(item.lessonId?Number(lessonProgress.some(progress=>progress.lessonId===item.lessonId&&progress.status==='completed')):Number(courses.find(course=>course.id===item.courseId)?.completedLessons??0)),0);
  return <section className="platform-learning-workspace">{error?<p role="alert">{t('学习进度加载失败：','Progress could not load: ')}{error}</p>:null}{user&&!error&&total>0?<><p>{t('整体进度','Overall progress')} {complete}/{total}</p><progress value={complete} max={total}/></>:null}<ol className="platform-learning-path">{items.map((item,index)=>{const course=item.lessonId?null:courses.find(row=>row.id===item.courseId);const href=item.lessonId?`/platform/courses/${item.lessonCourseId??item.courseId}/learn/${item.lessonId}`:`/platform/courses/${item.courseId}`;return <li key={index} className="platform-learning-panel" data-site-surface="panel"><h3><AppLink href={href} prefetch={false}>{localized(item,'title',english)}</AppLink></h3>{course?<><p>{Number(course.completedLessons)}/{Number(course.totalLessons)}</p><progress value={Number(course.progressBps)} max={10000}/></>:null}</li>;})}</ol></section>;
}

export function PlatformCertificate({entity,code}:{entity:PlatformEntity;code:string}){
  const t=useT();const [copied,setCopied]=useState(false);const [error,setError]=useState('');const data=entity.data??{};const valid=data.status==='issued';return <section className="platform-learning-workspace"><h2>{valid?t('证书有效','Valid certificate'):t('证书已撤销','Certificate revoked')}</h2><p>{text(data.recipientName)} · {entity.title}</p><time>{text(data.issuedAt)?.slice(0,10)}</time>{valid?<><img className="platform-learning-certificate" src={apiUrl(`/v1/platform/certificates/${encodeURIComponent(code)}/image?v=3`)} alt={t('结课证书','Certificate of completion')}/><div className="platform-write-actions"><a className="platform-button" href={apiUrl(`/v1/platform/certificates/${encodeURIComponent(code)}/image?v=3`)} download>{t('下载证书','Download certificate')}</a><button className="platform-button" type="button" onClick={()=>void navigator.clipboard.writeText(window.location.href).then(()=>{setCopied(true);setError('');}).catch(()=>setError(t('复制失败，请从地址栏复制链接。','Copy failed. Copy the link from the address bar.')))}>{copied?t('已复制','Copied'):t('复制验证链接','Copy verification link')}</button></div>{error?<p role="alert">{error}</p>:null}</>:null}</section>;
}
