'use client';

import { useQueryState, parseAsInteger } from 'nuqs';
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { useEffect, useState } from 'react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { renderArticleMarkdown } from '@/lib/article-markdown';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
import './platform-commerce.css';

export function commerceRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function commerceMoney(value: unknown, currency: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || !/^[A-Z]{3}$/.test(String(currency))) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: String(currency) }).format(amount / 100);
}
export function commerceText(data: Record<string, unknown>, key: string, t: ReturnType<typeof useT>): string {
  const zh = String(data[`${key}Zh`] ?? data[`${key}En`] ?? data[key] ?? '');
  const en = String(data[`${key}En`] ?? data[`${key}Zh`] ?? data[key] ?? '');
  return t(zh, en);
}
function bodyText(value: unknown): string {
  if (typeof value === 'string') return value;
  const body = commerceRecord(value);
  if (typeof body.markdown === 'string') return body.markdown;
  if (typeof body.text === 'string') return body.text;
  if (typeof body.content === 'string') return body.content;
  return Object.values(body).filter(item => typeof item === 'string').join('\n\n');
}
export function ticketAvailability(ticket: Record<string, unknown>, now: number): 'available' | 'closed' | 'upcoming' | 'sold-out' {
  if (ticket.status !== 'active') return ticket.status === 'sold_out' ? 'sold-out' : 'closed';
  if (Number(ticket.available ?? ticket.capacity) < 1) return 'sold-out';
  if (ticket.salesEndAt && Date.parse(String(ticket.salesEndAt)) <= now) return 'closed';
  if (ticket.salesStartAt && Date.parse(String(ticket.salesStartAt)) > now) return 'upcoming';
  return 'available';
}

function PlatformOrderTrend({rows}:{rows:unknown[]}) {
  const t=useT();const counts=new Map<string,number>();
  for(const raw of rows){const row=commerceRecord(raw);const key=String(row.date??'');counts.set(key,(counts.get(key)??0)+Number(row.orders??0));}
  const dates=[...counts.keys()].sort();const values=dates.map(date=>counts.get(date)??0);const max=Math.max(1,...values);
  if(!values.length)return <p>{t('当前范围内没有订单。','No orders in this period.')}</p>;
  const points=values.map((value,index)=>`${20+index*560/Math.max(1,values.length-1)},${150-value/max*130}`).join(' ');
  return <figure className="platform-business-trend"><figcaption>{t('每日新增订单趋势','Daily new order trend')}</figcaption><svg viewBox="0 0 600 180" role="img" aria-label={t(`最高每天 ${max} 笔订单，详细数值见下表。`,`Peak ${max} orders per day; exact values are in the table below.`)}><line x1="20" y1="150" x2="580" y2="150"/><polyline points={points}/>{values.map((value,index)=><circle key={dates[index]} cx={20+index*560/Math.max(1,values.length-1)} cy={150-value/max*130} r="4"><title>{dates[index]}: {value}</title></circle>)}</svg><div><span>{dates[0]}</span><span>{dates.at(-1)}</span></div></figure>;
}

export function PlatformCommerceContent({ definition, entity }: { definition: PlatformRouteDefinition; entity?: PlatformEntity }) {
  const t = useT();
  const [days,setDays]=useQueryState('days',parseAsInteger.withDefault(30));
  const [overview,setOverview]=useState<Record<string,unknown>|null>(null);
  const [overviewError,setOverviewError]=useState('');
  const analytics=definition.id==='admin'||definition.id==='admin-event-analytics';
  useEffect(()=>{if(!analytics)return;const controller=new AbortController();setOverviewError('');setOverview(null);
    void fetch(apiUrl(`/v1/platform/admin/analytics?days=${[7,30,90].includes(days)?days:30}`),{headers:authHeaders(false),signal:controller.signal}).then(response=>handleApi<{item:Record<string,unknown>}>(response)).then(result=>setOverview(result.item)).catch(reason=>{if(!controller.signal.aborted)setOverviewError(reason instanceof Error?reason.message:String(reason));});return()=>controller.abort();
  },[analytics,days]);
  const data = (analytics?overview:null) ?? entity?.data ?? {};
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  const local = (item: Record<string, unknown>, key: string) => commerceText(item, key, t);
  if (definition.id === 'news-detail') {
    const zh = bodyText(data.bodyZh); const en = bodyText(data.bodyEn);
    return <article className="platform-commerce-content platform-prose">
      <p>{String(data.category ?? '')}{data.publishedAt ? ` · ${String(data.publishedAt).slice(0,10)}` : ''}</p>
      {local(data, 'excerpt') ? <p>{local(data, 'excerpt')}</p> : null}
      {renderArticleMarkdown(t(zh || en, en || zh))}
      <nav className="platform-commerce-related" aria-label={t('继续阅读', 'Continue reading')}>
        {(['previous','next'] as const).map(key => { const item=commerceRecord(data[key]); return item.id ? <AppLink key={key} href={`/platform/news/${encodeURIComponent(String(item.slug ?? item.id))}`} prefetch={false}>{key === 'previous' ? t('上一篇：', 'Previous: ') : t('下一篇：', 'Next: ')}{local(item,'title')}</AppLink> : null; })}
      </nav>
      {Array.isArray(data.related) && data.related.length ? <section><h2>{t('相关资讯', 'Related articles')}</h2>{data.related.map(raw => { const item=commerceRecord(raw); return <p key={String(item.id)}><AppLink href={`/platform/news/${encodeURIComponent(String(item.slug ?? item.id))}`} prefetch={false}>{local(item,'title')}</AppLink></p>; })}</section> : null}
    </article>;
  }
  if (definition.id === 'product-detail') {
    const presentation = commerceRecord(data.presentation);
    const features = t('zh','en') === 'en' ? presentation.featuresEn ?? presentation.featuresZh : presentation.featuresZh ?? presentation.featuresEn;
    const image = typeof presentation.imageUrl === 'string' && /^(https?:\/\/|\/[^/])/.test(presentation.imageUrl) ? presentation.imageUrl : null;
    return <section className="platform-commerce-content">
      {image ? <img className="platform-product-image" src={image} alt={local(data,'title')} /> : null}
      <p>{[data.category,presentation.brand].filter(Boolean).map(String).join(' · ')}</p>
      {data.memberOnly === true ? <p>{t('此商品仅限有效会员购买。', 'An active membership is required to purchase this product.')} <AppLink href="/platform/membership">{t('查看会员', 'View memberships')}</AppLink></p> : null}
      {Array.isArray(features) && features.length ? <ul>{features.map((feature,index)=><li key={index}>{String(feature)}</li>)}</ul> : null}
      <div className="platform-commerce-grid">{Array.isArray(data.variants) ? data.variants.map(raw => { const item=commerceRecord(raw);return <article key={String(item.id)} data-site-surface="panel"><h3>{local(item,'title')}</h3><strong className="platform-commerce-price">{commerceMoney(item.amountMinor,item.currency)}</strong>{presentation.originalAmountMinor != null && Number(presentation.originalAmountMinor)>Number(item.amountMinor) ? <del>{commerceMoney(presentation.originalAmountMinor,item.currency)}</del> : null}{item.memberAmountMinor != null ? <p>{t('会员价', 'Member price')}: {commerceMoney(item.memberAmountMinor,item.currency)}</p> : null}<p>{Number(item.availableQuantity)>0 && item.status==='active' ? t(`可购买 ${item.availableQuantity} 件`, `${item.availableQuantity} available`) : t('暂时缺货', 'Out of stock')}</p></article>; }) : null}</div>
      {Array.isArray(data.related) && data.related.length ? <section><h2>{t('同类商品', 'Related products')}</h2>{data.related.map(raw=>{const item=commerceRecord(raw);return <p key={String(item.id)}><AppLink href={`/platform/shop/${encodeURIComponent(String(item.slug??item.id))}`} prefetch={false}>{local(item,'title')}</AppLink></p>;})}</section> : null}
    </section>;
  }
  if (definition.id === 'event-detail') {
    const venue=commerceRecord(data.venue);
    const date=(value:unknown)=> { if(!value)return '—'; try{return new Intl.DateTimeFormat(t('zh-CN','en-US'),{dateStyle:'medium',timeStyle:'short',timeZone:String(data.timezone??'UTC')}).format(new Date(String(value)));}catch{return String(value);} };
    return <section className="platform-commerce-content"><dl className="platform-commerce-facts"><div><dt>{t('时间','Time')}</dt><dd>{date(data.startsAt)} – {date(data.endsAt)} ({String(data.timezone??'UTC')})</dd></div><div><dt>{t('地点','Venue')}</dt><dd>{[venue.city,venue.name,venue.address].filter(Boolean).map(String).join(' · ') || t('待公布','To be announced')}</dd></div></dl>
      {Array.isArray(data.program) && data.program.length ? <p>{t('活动项目：','Program: ')}{data.program.map(String).join(' · ')}</p> : null}
      <div className="platform-commerce-grid">{Array.isArray(data.tickets) ? data.tickets.map(raw=>{const item=commerceRecord(raw);const status=ticketAvailability(item,now);const labels={available:t('报名中','Registration open'),closed:t('报名已结束','Registration closed'),upcoming:t('报名尚未开放','Registration opens later'),'sold-out':t('已满员','Sold out')};return <article key={String(item.id)} data-site-surface="panel"><h3>{local(item,'title')}</h3><strong className="platform-commerce-price">{commerceMoney(item.amountMinor,item.currency)}</strong><p>{labels[status]}</p><p>{t(`余 ${item.available} / ${item.capacity} 个名额`,`${item.available} of ${item.capacity} places available`)}</p><progress max={Number(item.capacity)||1} value={Math.max(0,Number(item.capacity)-Number(item.available))} aria-label={t('报名进度','Registration progress')} />{item.salesStartAt ? <p>{t('开放：','Opens: ')}{date(item.salesStartAt)}</p> : null}{item.salesEndAt ? <p>{t('截止：','Closes: ')}{date(item.salesEndAt)}</p> : null}</article>;}) : null}</div>
    </section>;
  }
  if (definition.id === 'admin' || definition.id === 'admin-event-analytics') {
    const summary=commerceRecord(data.summary);
    const labels: Record<string,string>={publishedCourses:t('在售课程','Published courses'),activeEntitlements:t('有效课程权益','Active course access'),orders:t('创建订单','Orders created'),paidOrders:t('付款订单','Orders paid')};
    return <section className="platform-commerce-content"><label>{t('统计范围','Reporting period')}<select className="platform-field-control" value={days} onChange={event=>{void setDays(Number(event.target.value));}}>{[7,30,90].map(value=><option key={value} value={value}>{t(`最近 ${value} 天`,`Last ${value} days`)}</option>)}</select></label>{overviewError?<p role="alert">{overviewError}</p>:null}<p>{t(`最近 ${data.days??30} 天，按 UTC 统计。数据来自订单和退款记录。`,`Last ${data.days??30} days in UTC, based on order and refund records.`)}</p><div className="platform-commerce-grid">{Object.entries(labels).map(([key,label])=><article key={key} data-site-surface="panel"><h3>{label}</h3><strong className="platform-commerce-price">{String(summary[key]??0)}</strong></article>)}</div>
      {Array.isArray(data.money) ? data.money.map(raw=>{const row=commerceRecord(raw);return <p key={String(row.currency)}><strong>{String(row.currency)}</strong> · {t('付款金额','Payments')}: {commerceMoney(row.paidAmountMinor,row.currency)} · {t('退款金额','Refunds')}: {commerceMoney(row.refundedAmountMinor,row.currency)} · {t('净额','Net')}: {commerceMoney(Number(row.paidAmountMinor)-Number(row.refundedAmountMinor),row.currency)}</p>;}) : null}
      <PlatformOrderTrend rows={Array.isArray(data.daily)?data.daily:[]}/><h2>{t('每日订单','Daily orders')}</h2><p>{t('按订单创建日期分组；已付款和金额表示这些订单目前的付款情况。','Grouped by order creation date; paid counts and amounts reflect the current payment state of those orders.')}</p><div className="sticky-scroll"><table className="sticky-thead"><thead><tr><th>{t('日期','Date')}</th><th>{t('币种','Currency')}</th><th>{t('订单','Orders')}</th><th>{t('已付款','Paid')}</th><th>{t('金额','Amount')}</th></tr></thead><tbody>{Array.isArray(data.daily) ? data.daily.map(raw=>{const row=commerceRecord(raw);return <tr key={`${row.date}-${row.currency}`}><td>{String(row.date)}</td><td>{String(row.currency)}</td><td>{String(row.orders)}</td><td>{String(row.paidOrders)}</td><td>{commerceMoney(row.paidAmountMinor,row.currency)}</td></tr>;}) : null}</tbody></table></div>
      <h2>{t('最近订单','Recent orders')}</h2>{Array.isArray(data.recent) ? data.recent.map(raw=>{const row=commerceRecord(raw);return <p key={String(row.id)}><AppLink href={`/platform/admin/orders/${encodeURIComponent(String(row.id))}`} prefetch={false}>{String(row.orderNumber)}</AppLink> · {commerceMoney(row.totalAmountMinor,row.currency)}</p>;}) : null}
    </section>;
  }
  return null;
}
