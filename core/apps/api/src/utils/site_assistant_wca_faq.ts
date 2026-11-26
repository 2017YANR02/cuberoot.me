import { parseHTML } from 'linkedom';
import type { AssistantAnswer } from '@cuberoot/shared/site-assistant';

export const WCA_FAQ = 'https://www.worldcubeassociation.org/faq';
type Lang = 'en' | 'zh';
interface Entry { slug: string; title: string; answer: string }

// Aliases cover whole, standalone requests. Extra clauses, particular events and
// accidents during an attempt still need their own evidence and adjudication.
const aliases = [
  { prefix: 'how-do-i-obtain-a-wca-id-', question: /^(?:我)?(?:该|应该)?(?:怎样才能|如何|怎么|怎样)(?:才能)?(?:获得|获取|申请)\s*(?:一个)?\s*WCA\s*ID(?:\s*(?:和|及)\s*(?:WCA\s*)?个人(?:成绩页|主页))?[？?。!！]?$/i },
  { prefix: 'how-can-i-register-for-a-competition-', question: /^(?:我)?(?:该|应该)?(?:怎么|如何|怎样)报名(?:参加)?(?:一场)?(?:WCA\s*)?比赛[？?。]?(?:\s*如果报名(?:时|遇到)?(?:有)?问题[，,]?\s*(?:我)?(?:应该|可以|该)?联系谁[？?。]?)?$/i },
  { prefix: 'i-lost-a-center-cap-', question: /^(?:我(?:的魔方)?|魔方)?(?:掉了|丢了|缺了)(?:一枚|一个)?中心盖(?:或一个部件)?[，,。]?\s*(?:我)?(?:还)?(?:能|可以)(?:用它|用这个魔方)?参赛吗[？?。]?$/ },
];

const normalize = (question: string) => question.normalize('NFKC').trim().toLowerCase()
  .replace(/^(?:请问[，,]?|(?:could|can) you (?:please )?tell me )/u, '').replace(/[\s\p{P}]+/gu, '');
export function couldBeWcaFaq(question: string) {
  const text = question.trim();
  if (text.length > 260 || /\d|https?:|\n/i.test(text)) return false;
  return aliases.some(alias => alias.question.test(text))
    || /^(?:how (?:do|can|old)|when are|what are|is my|may i|i (?:am registered|lost)).*\b(?:a wca (?:competition|id)|wca accounts?|a competition|profile picture|puzzle competition legal|magnetic puzzle|cent(?:er|re) cap)\b/i.test(text)
    || /^(?:如何|几岁|参加|我(?:的|已经|可以|丢了)|WCA).*(?:WCA\s*(?:ID|比赛|主页照片|账号|官网)|报名比赛|补报项目|参加比赛吗|中心盖|磁力魔方)/i.test(text);
}

export function readWcaFaq(html: string, lang: Lang): Entry[] {
  const { document } = parseHTML(html);
  const entries: Entry[] = [];
  for (const item of document.querySelectorAll('li.list-group-item')) {
    const heading = item.querySelector('.list-group-item-heading [id]');
    const body = item.querySelector('.list-group-item-text');
    if (!heading || !body || !/^[a-z0-9-]{1,160}$/.test(heading.id)) continue;
    const title = (heading.textContent ?? '').trim();
    if (/\p{Script=Han}/u.test(title) !== (lang === 'zh')) continue;
    for (const el of body.querySelectorAll('script,style,form,input,button')) el.remove();
    for (const link of body.querySelectorAll('a[href]')) {
      const url = URL.parse(link.getAttribute('href')!, WCA_FAQ);
      if (url?.origin === new URL(WCA_FAQ).origin && !/[()\s]/.test(url.href)) {
        link.replaceWith(document.createTextNode('[' + (link.textContent ?? '').trim() + '](' + url.href + ')'));
      }
    }
    const paragraphs = [...body.querySelectorAll('p')].map(p => (p.textContent ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (paragraphs.length) entries.push({ slug: heading.id, title, answer: paragraphs.join('\n\n') });
  }
  return entries;
}

export function matchedWcaFaq(question: string, entries: Entry[]): AssistantAnswer | undefined {
  const match = (text: string) => {
    const key = normalize(text);
    const alias = aliases.find(a => a.question.test(text.trim()));
    return entries.find(e => normalize(e.title) === key || (alias && e.slug.startsWith(alias.prefix)));
  };
  const whole = match(question);
  const clauses = question.split(/(?<=[?？])\s*/u).map(s => s.trim()).filter(Boolean);
  const matched = whole ? [whole] : clauses.map(match);
  if (!matched.length || matched.some(entry => !entry)) return;
  const distinct = [...new Set(matched.filter((entry): entry is Entry => !!entry))];
  const sources = distinct.map(entry => ({ id: 'wca:faq:' + entry.slug, title: entry.title, href: WCA_FAQ + '#' + entry.slug, read: true }));
  const answer = distinct.map((entry, i) => (distinct.length > 1 ? (i + 1) + '. ' : '')
    + entry.answer.split('\n\n').map(p => p + ' [[' + sources[i].id + ']]').join('\n\n')).join('\n\n');
  return { answer, sources };
}

export function organizerQuestion(question: string) {
  const allStars = /\bCubingUSA\s+All[- ]Stars\s+(\d{4})\b/i.exec(question);
  const edition = /\b(?:WC(\d{4})|(?:WCA\s+)?World Championship\s+(\d{4}))\b/i.exec(question);
  const explicit = /worldcubeassociation\.org\/competitions\/([A-Za-z0-9]{3,70}\d{4})\b/i.exec(question)
    ?? /^\[([A-Za-z][A-Za-z0-9]{2,65}\d{4})\]/.exec(question);
  const id = explicit?.[1] ?? (allStars ? 'CubingUSAAllStars'+allStars[1] : edition && 'WC'+(edition[1] ?? edition[2]));
  if (!id || !/refund|spectat|vendor|sell|photo|recording|compet|qualif|regist|events|accommodation|invitation|sponsor|booth|ticket|deadline|format|advancement/i.test(question)) return;
  const text = question.replace(/^\[[^\]]+\]\s*/, '').replace(/https?:\/\/www\.worldcubeassociation\.org\/competitions\/[A-Za-z0-9]+\/?/ig,'')
    .replace(/\s+(?:at|for|in)\s+(?:the\s+)?(?:Rubik['’]s x TheCubicle\s+)?CubingUSA All[- ]Stars \d{4}(?=[?.!]|$)/ig,'')
    .replace(/\s+(?:at|for|in)\s+(?:the\s+)?(?:Rubik['’]s\s+)?(?:WCA\s+)?World Championship\s+\d{4}(?=[?.!]|$)/ig,'').trim();
  return {id,text};
}

export function organizerFaqUrl(record: {id?: string; website?: string; contact?: string}, id: string) {
  if (record?.id!==id || typeof record.website!=='string') return;
  const site=URL.parse(record.website);
  const href=/\((https:\/\/[^()\s]+)\)/.exec(record.contact ?? '')?.[1];
  const datedPath='/nationals/'+id.slice(-4);
  const contact=href ? URL.parse(href) : site?.pathname.replace(/\/$/,'')===datedPath
    ? URL.parse(datedPath+'/contact',site.origin) : undefined;
  if (!site || !contact || ![site,contact].every(u=>u.protocol==='https:' && !u.username && !u.password && !u.port
      && ['cubingusa.org','www.cubingusa.org'].includes(u.hostname))) return;
  if (contact.search || contact.hash || !contact.pathname.startsWith(site.pathname.replace(/\/$/,'')+'/')) return;
  return contact.href;
}

export function organizerFaqAnswer(html: string, url: string, id: string, question: string): AssistantAnswer | undefined {
  const {document}=parseHTML(html);
  if (!document.title.includes(id.slice(-4)) && new URL(url).pathname!=='/nationals/'+id.slice(-4)+'/contact') return;
  const cards=[...document.querySelectorAll('#faq .card')];
  const match=(text:string)=>cards.find(card=>normalize(card.querySelector('.card-header')?.textContent ?? '')===normalize(text));
  const whole=match(question);
  const items=whole?[whole]:question.split(/(?<=\?)\s*/u).map(s=>s.trim()).filter(Boolean).map(match);
  if (!items.length || items.some(card=>!card)) return;
  const answers:string[]=[], sources:AssistantAnswer['sources']=[];
  for (const card of new Set(items)) {
    const heading=card!.querySelector('.card-header');
    const body=card!.querySelector('.card-body');
    if (!body || !heading || !/^[\w-]+$/.test(heading.id)) return;
    for (const link of body.querySelectorAll('a[href]')) {
      const href=URL.parse(link.getAttribute('href')!,url);
      if (href?.protocol==='https:' && !href.username && !href.password && !/[\s()]/.test(href.href))
        link.replaceWith(document.createTextNode('['+link.textContent?.trim()+']('+href.href+')'));
    }
    const text=body.textContent?.replace(/\s+/g,' ').trim();
    if (!text || text.length>4000 || text.includes('[[')) return;
    const source={id:'organizer:'+id+':'+heading.id,href:url+'#'+heading.id,title:id+' · '+heading.textContent!.trim(),read:true};
    sources.push(source);answers.push(text+' [['+source.id+']]');
  }
  return {answer:answers.join('\n\n'),sources};
}

export const ukGuideIndex = 'https://www.ukca.org/parents-guide';

export function ukGuideQuestion(question: string) {
  const match = /^(?:\[(?:UK Cube Association|UKCA)\]\s*|according to (?:the )?(?:UKCA|UK Cube Association)(?: parents[’']? guide)?,\s*|(?:in the UK|at UK competitions),\s*)(.+)$/i.exec(question.trim());
  return match?.[1];
}

// The index and article sometimes use different titles, or combine two questions
// on the same page. Require a whole question and an unambiguous official link.
function guideTitles(title: string) {
  return [title, ...title.split(/(?<=\?)\s+/)].map(s => normalize(s.replace(/\bmake it to\b/gi, 'make').replace(/\b(?:a|the) waiting list\b/gi,'waiting list')));
}

export function ukGuideArticle(index: string, question: string) {
  const key = guideTitles(question)[0];
  const urls = new Set<string>();
  for (const a of parseHTML(index).document.querySelectorAll('main a[href]')) {
    const url = URL.parse(a.getAttribute('href')!, ukGuideIndex);
    if (!url || url.origin !== new URL(ukGuideIndex).origin || !/^\/parents-guide-[a-z0-9-]+$/.test(url.pathname) || url.search || url.hash) continue;
    if (guideTitles(a.textContent ?? '').includes(key)) urls.add(url.href);
  }
  return urls.size === 1 ? [...urls][0] : undefined;
}

export function ukGuideAnswer(html: string, url: string, question: string): AssistantAnswer | undefined {
  const doc = parseHTML(html).document;
  const main = doc.querySelector('main');
  const heading = main?.querySelector('h1')?.textContent?.trim();
  if (!main || !heading) return;
  const key = guideTitles(question)[0];
  if (!guideTitles(heading).includes(key)) {
    // The directory links to the canonical article; its editorial H1 can
    // differ from the published page title. Require both identifiers here.
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
    const pageTitle = /^Parents[’'] Guide:\s*(.+?)\s+[—–]\s+UK Cube Association$/i.exec(doc.title)?.[1];
    if (canonical !== url || !pageTitle || !guideTitles(pageTitle).includes(key)) return;
  }
  for (const el of main.querySelectorAll('script,style,form,sup,button,iframe')) el.remove();
  const paragraphs: string[] = [];
  for (const el of main.querySelectorAll('.sqs-code-container, .sqs-html-content > p, .sqs-html-content > ul, .sqs-html-content > ol')) {
    if (el.classList.contains('sqs-code-container') && el.parentElement?.closest('.sqs-code-container')) continue;
    const value = (el.textContent ?? '').replace(/\s+/g,' ').trim();
    if (/^(?:glossary\s*:|\(back to index\))/i.test(value)) break;
    if (value && !value.includes('[[')) paragraphs.push(value);
  }
  const body = paragraphs.join('\n\n');
  if (!body || body.length > 5500) return;
  const source = { id:'ukca:'+new URL(url).pathname.replace(/^\/parents-guide-/,''), href:url, title:heading, read:true };
  return {answer:paragraphs.map(line=>line+' [['+source.id+']]').join('\n\n'), sources:[source]};
}
