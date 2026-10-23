'use client';
import {useEffect} from 'react';
import {useRouter,usePathname} from 'next/navigation';
import {useTranslation} from 'react-i18next';
import {parseAsString,parseAsInteger,useQueryStates} from 'nuqs';
import {ArrowRight} from '@app-foundation/icons/lucide';
import Link from '@/components/AppLink';
import {ClearButton} from '@/components/ClearButton';
import {useT} from '@/hooks/useT';
import {tr} from '@/i18n/tr';
import {ALL_NEWS,NEWS_INDEX} from '../_data/news-catalog';
import '../regulation.css';
import './news.css';
import PostHeading from './_components/PostHeading';
const years=[...new Set(NEWS_INDEX.map(e=>e.date.slice(0,4)))].sort().reverse();
const pageSize=25;
export default function RegulationNews(){
 useTranslation();const t=useT();const router=useRouter();const pathname=usePathname();
 const [state,setState]=useQueryStates({q:parseAsString.withDefault(''),year:parseAsString.withDefault(''),page:parseAsInteger.withDefault(1)});
 const query=state.q.trim().toLocaleLowerCase();
 const filtered=NEWS_INDEX.filter(e=>(!state.year||e.date.startsWith(state.year))&&(!query||(e.title.zh+' '+e.title.en).toLocaleLowerCase().includes(query)));
 const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
 const page=Math.max(1,Math.min(state.page,totalPages));
 const visible=filtered.slice((page-1)*pageSize,page*pageSize);
 useEffect(()=>{
  const openLegacyArticle=()=>{const id=window.location.hash.slice(1);if(!ALL_NEWS.some(e=>e.id===id))return;router.replace((pathname.startsWith('/zh/')?'/zh':'')+'/regulation/post/'+id);};
  openLegacyArticle();
 },[pathname,router]);
 return <div className="reg-page"><div className="reg-wrap">
  <PostHeading href="/regulation" backLabel={t('全部规则','All regulations')} large>{t('公告','Posts')}</PostHeading>
  <div className="news-filters"><div className="news-search"><input className="news-search-input" type="search" aria-label={t('搜索标题','Search titles')} placeholder={t('搜索标题','Search titles')} value={state.q} onChange={e=>void setState({q:e.target.value,page:null})}/>{state.q&&<ClearButton onClick={()=>void setState({q:null,page:null})}/>}</div><select className="news-year-select" aria-label={t('年份','Year')} value={state.year} onChange={e=>void setState({year:e.target.value,page:null})}><option value="">{t('全部年份','All years')}</option>{years.map(year=><option value={year} key={year}>{year}</option>)}</select></div>
  <ul className="news-index">{visible.map(item=><li key={item.id}><Link href={'/regulation/post/'+item.id} prefetch={false} className="news-index-link"><time dateTime={item.date}>{item.date}</time><span>{tr(item.title)}</span><ArrowRight size={18} aria-hidden="true"/></Link></li>)}</ul>
  {!visible.length&&<p>{t('没有匹配的公告。','No matching announcements.')}</p>}
  {totalPages>1&&<nav className="news-pagination" aria-label={t('公告分页','Announcement pages')}><button className="news-page-button" disabled={page===1} onClick={()=>void setState({page:page-1},{history:'replace'})}>{t('上一页','Previous')}</button><span>{page} / {totalPages}</span><button className="news-page-button" disabled={page===totalPages} onClick={()=>void setState({page:page+1},{history:'replace'})}>{t('下一页','Next')}</button></nav>}
 </div></div>;
}
