'use client';
import {useTranslation} from 'react-i18next';
import {ExternalLink} from '@app-foundation/icons/lucide';
import PostHeading, { PostFeatureAction } from './PostHeading';
import {useT} from '@/hooks/useT';
import {tr} from '@/i18n/tr';
import {findRegulationPost} from '@/lib/regulation-posts';
import '../../regulation.css';
import '../news.css';
type Text={zh:string;en:string};
type Content={id:string;date:string;title:Text;sourceUrl:string;html:Text};
export default function PostArticle({article}:{article:Content&{supplements:Content[]}}){
 useTranslation();const t=useT();
 const post=findRegulationPost(article.id)??article;
 return <div className="reg-page news-article-page"><div className="reg-wrap">
  <article className="news-item">
   <PostHeading href="/regulation/post" backLabel={t('公告','Posts')}>{tr(post.title)}</PostHeading>
   <div className="news-meta"><time className="news-date" dateTime={article.date}>{article.date}</time><a className="news-source" href={article.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/>{t('官方原文','Official source')}</a><PostFeatureAction post={post}/></div>
   <div className="news-post-body" dangerouslySetInnerHTML={{__html:tr(article.html)}}/>
   {article.supplements.map(s=><section key={s.id}><div className="news-meta"><time dateTime={s.date}>{s.date}</time><a className="news-source" href={s.sourceUrl} target="_blank" rel="noopener noreferrer">{t('官方归档','Official archive')}<ExternalLink size={13}/></a></div><h2 className="news-sub-title">{tr(s.title)}</h2><div className="news-post-body" dangerouslySetInnerHTML={{__html:tr(s.html)}}/></section>)}
  </article>
 </div></div>;
}
