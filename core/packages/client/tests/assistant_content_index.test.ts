import {describe,it,expect} from 'vitest';
import {indexPublicHtml,discoverPublicPages} from '../scripts/build-assistant-index';

describe('assistant build-time public content index',()=>{
  const html='<html><head><title>CFOP</title></head><body><nav>navigation</nav><main>'+('Public cubing tutorial. '.repeat(8))+'<script>secret script</script><span hidden>hidden UI</span></main></body></html>';
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
