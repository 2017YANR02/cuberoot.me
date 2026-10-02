import { WC_2027_ANNOUNCEMENT as announcement } from '@cuberoot/shared/site-announcements';
import JsonLd, { articleJsonLd, SITE_URL } from '@/components/JsonLd';
import './announcement.css';

export default async function WorldChampionshipAnnouncement({params}:{params:Promise<{lang:string}>}) {
  const {lang}=await params;
  const locale=lang==='zh'?'zh':'en';
  const labels={zh:{kind:'公告转述',date:'原公告：2025 年 7 月',source:'WCA 官方原文',application:'原公告附带的申办文件'},en:{kind:'Announcement summary',date:'Original announcement: July 2025',source:'Original WCA announcement',application:'Application linked in the original announcement'}}[locale];
  return <main className="wc-announcement">
    <JsonLd data={articleJsonLd({headline:announcement.title[locale],description:announcement.summary[locale],url:`${SITE_URL}${locale==='zh'?'/zh':''}${announcement.href}`,lang:locale})}/>
    <article>
      <header><p>{labels.kind}</p><h1>{announcement.title[locale]}</h1><p>{labels.date}</p></header>
      {announcement.paragraphs.map((paragraph,i)=><p key={i}>{paragraph[locale]}</p>)}
      <footer><p><a href={announcement.sourceUrl} target="_blank" rel="noopener noreferrer">{labels.source}</a></p><p><a href={announcement.applicationUrl} target="_blank" rel="noopener noreferrer">{labels.application}</a></p></footer>
    </article>
  </main>;
}
