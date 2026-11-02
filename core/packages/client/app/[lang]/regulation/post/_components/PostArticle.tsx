'use client';
import {useTranslation} from 'react-i18next';
import {ExternalLink} from '@app-foundation/icons/lucide';
import PostHeading, { PostFeatureAction } from './PostHeading';
import {useT} from '@/hooks/useT';
import {tr} from '@/i18n/tr';
import {findRegulationPost} from '@/lib/regulation-posts';
import RegulationHtml from '../../_components/RegulationHtml';
import {regulationSupplementId} from '@/lib/regulation-links';
import '../../regulation.css';
import '../news.css';
type Text={zh:string;en:string};
export type Content={id:string;date:string;title:Text;sourceUrl:string;html:Text};
export default function PostArticle({article,featured=true,contentKind,backHref='/regulation/post',backLabel}:{article:Content&{supplements:Content[]};featured?:boolean;contentKind?:'summary'|'translation';backHref?:string;backLabel?:string}){
 useTranslation();const t=useT();
 const post=findRegulationPost(article.id)??article;
 return <div className="reg-page news-article-page"><div className="reg-wrap">
  <article className="news-item">
   <PostHeading href={backHref} backLabel={backLabel??t('公告','Posts')}>{tr(post.title)}</PostHeading>
   <div className="news-meta">{article.date&&<time className="news-date" dateTime={article.date}>{article.date}</time>}{contentKind==='summary'&&<span>{t('内容摘要','Summary')}</span>}<a className="news-source" href={article.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/>{t('官方原文','Official source')}</a>{featured&&<PostFeatureAction post={post}/>}</div>
   <RegulationHtml className="news-post-body" html={tr(article.html)}/>
   {article.supplements.map(s=><section key={s.id} id={regulationSupplementId(s.id)}><div className="news-meta"><time dateTime={s.date}>{s.date}</time><a className="news-source" href={s.sourceUrl} target="_blank" rel="noopener noreferrer">{t('官方归档','Official archive')}<ExternalLink size={13}/></a></div><h2 className="news-sub-title">{tr(s.title)}</h2><RegulationHtml className="news-post-body" html={tr(s.html)}/></section>)}
  </article>
 </div></div>;
}
