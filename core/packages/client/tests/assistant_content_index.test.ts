import {afterEach,describe,it,expect} from 'vitest';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {getRouteCacheKey} from 'next/dist/server/lib/route-cache-key';
import type {RouteKind} from 'next/dist/server/route-kind';
import {indexPublicHtml,discoverPublicPages,discoverNavigationLinks,solverDestinations,metadataDestinations,platformDestinations,discoverBuildArtifacts} from '../scripts/build-assistant-index';

describe('assistant build-time public content index',()=>{
  it('includes concrete platform entries while excluding parameterized entity routes',()=>{
    const destinations=platformDestinations();
    expect(destinations.some(p=>p.href==='/platform')).toBe(true);
    expect(destinations.some(p=>p.access==='account')).toBe(true);
    expect(destinations.some(p=>p.href.includes(':'))).toBe(false);
  });
  it('makes static page metadata navigable without indexing private page contents',()=>{
    const destinations=metadataDestinations(['timer','account','admin','missing-page','alg/[puzzle]']);
    expect(destinations.some(p=>p.href==='/timer' && p.lang==='zh')).toBe(true);
    expect(destinations.find(p=>p.href==='/account' && p.lang==='en')).toMatchObject({title:'Account',access:'account',description:''});
    expect(destinations.find(p=>p.href==='/admin')).toMatchObject({access:'admin'});
    expect(destinations.some(p=>p.href.includes('missing') || p.href.includes('['))).toBe(false);
  });
  it('discovers navigation outside the cubing tool sections',()=>{
    expect(discoverNavigationLinks('/zh/wiki','<a href="/zh/math/group">群论</a><a href="/zh/forum">论坛</a><a href="/zh/dev/auth">登录流程</a>')).toEqual([
      {lang:'zh',href:'/math/group',title:'群论'},
      {lang:'zh',href:'/forum',title:'论坛'},
      {lang:'zh',href:'/dev/auth',title:'登录流程'},
    ]);
  });
  it('indexes full puzzle names and the actual solver event routes',()=>{
    expect(solverDestinations()).toContainEqual({lang:'en',href:'/scramble/solver?event=pyram',title:'Pyraminx — Solver'});
    expect(solverDestinations()).toContainEqual({lang:'zh',href:'/scramble/solver?event=222',title:'二阶 — 求解器'});
  });
  it('reuses solver menu links while excluding external, private and state-bearing destinations',()=>{
    const links=['/zh/scramble/solver?event=222','/zh/recognize/pll','https://evil.example/scramble/solver','/zh/admin','/zh/scramble/solver?state=private','/zh/alg/3x3/_'].map(href=>`<a href="${href}">二阶求解器</a>`).join('');
    expect(discoverNavigationLinks('/zh/scramble/stats',links)).toEqual([
      {lang:'zh',href:'/scramble/solver?event=222',title:'二阶求解器'},
      {lang:'zh',href:'/recognize/pll',title:'二阶求解器'},
    ]);
  });
  it('preserves tutorial instructions inside article headers and public tool descriptions',()=>{
    const result=indexPublicHtml('/zh/recognize/pll/guide','<html><head><title>PLL</title></head><body><header>Site chrome</header><main><header><h1>PLL 识别指南</h1><p>'+('先找连色条和灯眼，再比较相邻两面。'.repeat(8))+'</p></header></main></body></html>');
    expect(result?.text).toContain('先找连色条和灯眼');expect(result?.text).not.toContain('Site chrome');
    expect(indexPublicHtml('/en/recognize/pll','<html><head><title>PLL</title><meta name="description" content="A timed drill for recognising all 21 PLL cases."></head><body>Loading...</body></html>')?.text).toContain('21 PLL');
  });
  const html='<html><head><title>CFOP</title></head><body><nav>navigation</nav><main>'+('Public cubing tutorial. '.repeat(8))+'<script>secret script</script><span hidden>hidden UI</span></main></body></html>';
  const fixtureRoots: string[]=[];
  afterEach(async()=>{await Promise.all(fixtureRoots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
  async function fixtureRoot() {
    const root=await mkdtemp(path.join(tmpdir(),'assistant-output-'));fixtureRoots.push(root);return root;
  }
  async function artifact(root:string,file:string,content:string) {
    const target=path.join(root,file);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,content);return target;
  }
  const adapterPage=(route:string)=>`${getRouteCacheKey(route,{kind:'APP_PAGE' as RouteKind.APP_PAGE,sourceRoute:'/[lang]/wiki/page'})}.html`;
  const adapterSitemap=()=>`${getRouteCacheKey('/sitemap.xml',{kind:'APP_ROUTE' as RouteKind.APP_ROUTE,sourceRoute:'/sitemap.xml/route'})}.body`;
  it.each(['standalone','adapter'] as const)('reads %s build artifacts while retaining public/noindex boundaries',async(layout)=>{
    const root=await fixtureRoot();
    for(const route of ['/en/wiki','/zh/wiki','/en/account','/zh/admin','/zh/wca/persons/_','/en/private-example']) {
      await artifact(root,layout==='adapter'?adapterPage(route):`app${route}.html`,route==='/en/private-example'?html.replace('<head>','<head><meta name="robots" content="noindex">'):html);
    }
    const xml='<urlset><url><loc>https://cuberoot.me/private-example</loc></url><url><loc>https://cuberoot.me/math/group/example</loc></url></urlset>';
    await artifact(root,layout==='adapter'?adapterSitemap():'app/sitemap.xml.body',xml);
    const found=await discoverBuildArtifacts(root);
    const pages=(await Promise.all([...found.htmlFiles].map(async([route,file])=>indexPublicHtml(route,await readFile(file,'utf8'))))).filter(Boolean);
    expect(pages.map(page=>`${page!.lang}${page!.href}`).sort()).toEqual(['en/wiki','zh/wiki']);
    expect(await readFile(found.sitemapFile!,'utf8')).toBe(xml);
    const discovered=discoverPublicPages(xml,new Map(),new Set(found.htmlFiles.keys()));
    expect(discovered.some(page=>page.lang==='en' && page.href==='/private-example')).toBe(false);
    expect(discovered.some(page=>page.href==='/math/group/example')).toBe(true);
  });
  it('prefers current adapter pages over cached legacy pages and ignores non-page artifacts',async()=>{
    const root=await fixtureRoot();
    await artifact(root,'app/en/wiki.html',html);
    const current=await artifact(root,adapterPage('/en/wiki'),html.replace('<head>','<head><meta name="robots" content="noindex">'));
    await artifact(root,`route-cache/APP_ROUTE/${'a'.repeat(64)}/$/en/unsafe.html`,html);
    await artifact(root,`route-cache/PAGES/${'b'.repeat(64)}/$/en/unsafe.html`,html);
    await artifact(root,'app/en/data.rsc',html);
    const found=await discoverBuildArtifacts(root);
    expect([...found.htmlFiles]).toEqual([['/en/wiki',current]]);
    expect(indexPublicHtml('/en/wiki',await readFile(current,'utf8'))).toBeNull();
  });
  it('indexes actual public text with language-neutral source paths',()=>{
    const result=indexPublicHtml('/zh/tutorial/lbl',html)!;
    expect(result.href).toBe('/tutorial/lbl');expect(result.lang).toBe('zh');
    expect(result.text).toContain('Public cubing tutorial');
    expect(result.text).not.toMatch(/navigation|secret script|hidden UI/);
  });
  it('excludes account/admin routes, dynamic placeholders and noindex pages',()=>{
    for(const route of ['/zh/admin/content','/en/account','/zh/wca/persons/_','/zh/platform/org','/zh/courses','/zh/tutorial-legacy/cfop'])expect(indexPublicHtml(route,html)).toBeNull();
    expect(indexPublicHtml('/zh/wiki',html.replace('<head>','<head><meta name="robots" content="noindex">'))).toBeNull();
  });
  it('discovers on-demand chapters from the site sitemap without reindexing excluded pages',()=>{
    const xml='<urlset>'+['math/group/what-is-a-group','courses/secret','account','wiki','math/group/what-is-a-group'].map(p=>`<url><loc>https://cuberoot.me/${p}</loc></url>`).join('')+'<url><loc>https://evil.example/math</loc></url></urlset>';
    const pages=discoverPublicPages(xml,new Map([['/zh/math/group/what-is-a-group','什么是群']]),new Set(['/en/wiki','/zh/wiki']));
    expect(pages).toEqual([
      {lang:'en',href:'/math/group/what-is-a-group',title:'math · group · what-is-a-group',text:''},
      {lang:'zh',href:'/math/group/what-is-a-group',title:'什么是群',text:''},
    ]);
  });
});
