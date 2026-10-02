import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { SITE_DIRECTORY_GROUPS } from '@cuberoot/shared/site-directory';
import { EVENT_DISPLAY_EN, EVENT_DISPLAY_ZH } from '@cuberoot/shared/wca-events';
import { EVENT_ID } from '../lib/solver-routes';
import { CSTIMER_EVENTS } from '../lib/cstimer-scramble';
import { EVENT_NAME_TO_ID } from '../lib/event-constants';
const restricted=SITE_DIRECTORY_GROUPS.flatMap(g=>g.entries.filter(e=>('adminOnly' in e && e.adminOnly)||('lockedForNonAdmin' in e && e.lockedForNonAdmin)).map(e=>e.href));


function isPublicRoute(route: string) {
  if (!/^\/(en|zh)\//.test(route) || /\/(?:_|admin|platform|org|learn|courses|tutorial-legacy|account|auth|login|register|settings)(?:\/|$)/.test(route)) return false;
  const href=route.replace(/^\/(en|zh)/,'');
  return !restricted.some(p=>href===p || href.startsWith(p+'/'));
}

export function indexPublicHtml(route: string, html: string) {
  if (!isPublicRoute(route)) return null;
  const { document } = parseHTML(html);
  if (document.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('noindex')) return null;
  const title = document.querySelector('title')?.textContent ?? route;
  const description=document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
  document.querySelectorAll('div[hidden][id]').forEach(n=>{if (/^S:[0-9a-f]+$/i.test(n.id)) n.removeAttribute('hidden');});
  document.querySelectorAll('header,footer').forEach(n=>{if(!n.closest('main,article'))n.remove();});
  document.querySelectorAll('script,style,nav,form,button,[hidden],[aria-hidden="true"]').forEach(n=>n.remove());
  const body=(document.querySelector('main') ?? document.body)?.textContent ?? '';
  const text=[description,body].join(' ').replace(/\s+/g,' ').trim();
  if (text.length<80 && description.length<20) return null;
  return { lang:route.startsWith('/zh/')?'zh':'en', href:route.replace(/^\/(en|zh)/,''),title,text:text.slice(0,60000) };
}

/** On-demand public pages are in the existing sitemap but have no build HTML.
 * Keep their public link labels searchable; the API reads their body on demand.
 * Never turn a rendered noindex/empty/private page back into an indexed page. */
export function discoverPublicPages(xml: string, labels: Map<string,string>, rendered: Set<string>) {
  const {document}=parseHTML(xml);
  const pages: NonNullable<ReturnType<typeof indexPublicHtml>>[]=[];
  for (const loc of document.querySelectorAll('loc')) {
    let url: URL;
    try { url=new URL(loc.textContent ?? ''); } catch { continue; }
    if (url.origin!=='https://cuberoot.me' || url.search || url.hash) continue;
    const href=url.pathname.replace(/^\/(?:en|zh)(?=\/|$)/,'').replace(/\/$/,'');
    for (const lang of ['en','zh']) {
      const route=`/${lang}${href}`;
      if (!isPublicRoute(route) || rendered.has(route)) continue;
      rendered.add(route);
      pages.push({lang,href,title:labels.get(route) ?? href.split('/').filter(Boolean).join(' · '),text:''});
    }
  }
  return pages;
}

/** Reuse links rendered by the real tool menus, including solver event selection. */
export function discoverNavigationLinks(route: string, html: string) {
  if (!isPublicRoute(route)) return [];
  const {document}=parseHTML(html);
  const lang=route.startsWith('/zh/')?'zh':'en';
  const destinations: Array<{lang:string;href:string;title:string}>=[];
  for (const link of document.querySelectorAll('a[href]')) {
    try {
      const url=new URL(link.getAttribute('href')!,`https://cuberoot.me${route}`);
      const href=url.pathname.replace(/^\/(en|zh)(?=\/|$)/,'');
      if(url.origin!=='https://cuberoot.me' || !isPublicRoute(`/${lang}${href}`) || !/^\/(scramble|recognize|alg|predict|memo)(?:\/|$)/.test(href)) continue;
      if([...url.searchParams.keys()].some(key=>!['event','tool','method','stage','variant'].includes(key))) continue;
      const title=link.textContent?.replace(/\s+/g,' ').trim();
      if(title) destinations.push({lang,href:href+url.search,title:title.slice(0,250)});
    } catch { /* Invalid or non-HTTP link. */ }
  }
  return destinations;
}

/** The project picker is closed during SSR, so index its canonical routing data too. */
export function solverDestinations() {
  return Object.values(EVENT_ID).flatMap(event=>{
    const puzzle=CSTIMER_EVENTS.find(p=>p.id===event);
    const english=Object.entries(EVENT_NAME_TO_ID).find(([,id])=>id===event)?.[0] ?? EVENT_DISPLAY_EN[event];
    return (['en','zh'] as const).map(lang=>({lang,href:`/scramble/solver?event=${event}`,title:`${puzzle?.[lang] ?? {en:english,zh:EVENT_DISPLAY_ZH[event]}[lang] ?? event} — ${{en:'Solver',zh:'求解器'}[lang]}`}));
  });
}

async function main() {
  const root=path.resolve('.next/server/app');
  const pages: NonNullable<ReturnType<typeof indexPublicHtml>>[]=[];
  const rendered=new Set<string>();
  const labels=new Map<string,string>();
  const destinations=new Map<string, ReturnType<typeof discoverNavigationLinks>[number]>();
  for(const destination of solverDestinations()) destinations.set(destination.lang+destination.href,destination);
  async function walk(dir:string): Promise<void> {
    for (const entry of await readdir(dir,{withFileTypes:true})) {
      const file=path.join(dir,entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.name.endsWith('.html')) {
        const route='/'+path.relative(root,file).replace(/\.html$/,'');
        const html=await readFile(file,'utf8');
        rendered.add(route);
        const page=indexPublicHtml(route,html);
        if (page) {
          pages.push(page);
          for(const destination of discoverNavigationLinks(route,html)) {
            const key=destination.lang+destination.href;
            if(!destinations.has(key)) destinations.set(key,destination);
          }
          const {document}=parseHTML(html);
          for (const link of document.querySelectorAll('a[href]')) {
            try {
              const url=new URL(link.getAttribute('href')!,`https://cuberoot.me${route}`);
              if(url.origin!=='https://cuberoot.me')continue;
              const target=/^\/(en|zh)(?:\/|$)/.test(url.pathname)?url.pathname:`/en${url.pathname}`;
              const label=link.textContent?.replace(/\s+/g,' ').trim();
              if(isPublicRoute(target) && label && (!labels.has(target) || label.length>labels.get(target)!.length))labels.set(target,label.slice(0,250));
            } catch { /* Non-HTTP and malformed links are not content entries. */ }
          }
        }
      }
    }
  }
  await walk(root);
  if (!pages.length) throw new Error('No public assistant content found');
  const xml=await readFile(path.join(root,'sitemap.xml.body'),'utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error;});
  const discovered=discoverPublicPages(xml,labels,rendered);
  pages.push(...discovered);
  await mkdir('public/assistant',{recursive:true});
  await writeFile('public/assistant/pages.json',JSON.stringify({updated:new Date().toISOString(),pages,destinations:[...destinations.values()]}));
  console.log(`Assistant content index: ${pages.length} public pages (${discovered.length} read on demand)`);
}
if (path.basename(process.argv[1] ?? '')==='build-assistant-index.ts') {
  main().catch(error=>{console.error(error);process.exitCode=1;});
}
