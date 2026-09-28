import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { SITE_DIRECTORY_GROUPS } from '@cuberoot/shared/site-directory';
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
  document.querySelectorAll('div[hidden][id]').forEach(n=>{if (/^S:[0-9a-f]+$/i.test(n.id)) n.removeAttribute('hidden');});
  document.querySelectorAll('script,style,nav,header,footer,form,button,[hidden],[aria-hidden="true"]').forEach(n=>n.remove());
  const text=(document.querySelector('main') ?? document.body)?.textContent?.replace(/\s+/g,' ').trim() ?? '';
  if (text.length<80) return null;
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

async function main() {
  const root=path.resolve('.next/server/app');
  const pages: NonNullable<ReturnType<typeof indexPublicHtml>>[]=[];
  const rendered=new Set<string>();
  const labels=new Map<string,string>();
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
  await writeFile('public/assistant/pages.json',JSON.stringify({updated:new Date().toISOString(),pages}));
  console.log(`Assistant content index: ${pages.length} public pages (${discovered.length} read on demand)`);
}
if (path.basename(process.argv[1] ?? '')==='build-assistant-index.ts') {
  main().catch(error=>{console.error(error);process.exitCode=1;});
}
