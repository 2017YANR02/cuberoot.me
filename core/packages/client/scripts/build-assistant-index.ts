import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { SITE_DIRECTORY_GROUPS } from '@cuberoot/shared/site-directory';
const restricted=SITE_DIRECTORY_GROUPS.flatMap(g=>g.entries.filter(e=>('adminOnly' in e && e.adminOnly)||('lockedForNonAdmin' in e && e.lockedForNonAdmin)).map(e=>e.href));


export function indexPublicHtml(route: string, html: string) {
  if (!/^\/(en|zh)\//.test(route) || /\/(?:_|admin|platform|org|learn|courses|tutorial-legacy|account|auth|login|register|settings)(?:\/|$)/.test(route)) return null;
  const href=route.replace(/^\/(en|zh)/,'');
  if (restricted.some(p=>href===p || href.startsWith(p+'/'))) return null;
  const { document } = parseHTML(html);
  if (document.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('noindex')) return null;
  const title = document.querySelector('title')?.textContent ?? route;
  document.querySelectorAll('div[hidden][id]').forEach(n=>{if (/^S:[0-9a-f]+$/i.test(n.id)) n.removeAttribute('hidden');});
  document.querySelectorAll('script,style,nav,header,footer,form,button,[hidden],[aria-hidden="true"]').forEach(n=>n.remove());
  const text=(document.querySelector('main') ?? document.body)?.textContent?.replace(/\s+/g,' ').trim() ?? '';
  if (text.length<80) return null;
  return { lang:route.startsWith('/zh/')?'zh':'en', href:route.replace(/^\/(en|zh)/,''),title,text:text.slice(0,60000) };
}

async function main() {
  const root=path.resolve('.next/server/app');
  const pages: NonNullable<ReturnType<typeof indexPublicHtml>>[]=[];
  async function walk(dir:string): Promise<void> {
    for (const entry of await readdir(dir,{withFileTypes:true})) {
      const file=path.join(dir,entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.name.endsWith('.html')) {
        const page=indexPublicHtml('/'+path.relative(root,file).replace(/\.html$/,''),await readFile(file,'utf8'));
        if (page) pages.push(page);
      }
    }
  }
  await walk(root);
  if (!pages.length) throw new Error('No public assistant content found');
  await mkdir('public/assistant',{recursive:true});
  await writeFile('public/assistant/pages.json',JSON.stringify({updated:new Date().toISOString(),pages}));
  console.log(`Assistant content index: ${pages.length} public pages`);
}
if (path.basename(process.argv[1] ?? '')==='build-assistant-index.ts') {
  main().catch(error=>{console.error(error);process.exitCode=1;});
}
