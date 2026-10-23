import { describe, expect, it } from 'vitest';
import { isAssistantSourceHref } from '@cuberoot/shared/site-assistant';
import { parseAssistantNews, readAssistantNews } from '../src/utils/site_assistant_news.js';

const item=(slug:string,date:string,body='<p>Official announcement.</p>')=>`<item><title>News &amp; updates</title><link>https://www.worldcubeassociation.org/posts/${slug}</link><pubDate>${date}</pubDate><description><![CDATA[${body}]]></description></item>`;
const feed=(items:string)=>`<rss><channel><title>WCA</title>${items}</channel></rss>`;
describe('assistant official news',()=>{
  it('uses publication dates in the visitor time zone and does not substitute old articles',async()=>{
    const items=parseAssistantNews(feed(item('older','2026-10-18T23:00:00Z')+item('boundary','2026-10-19T01:00:00Z')+item('current','2026-10-20T12:00:00Z')));
    const result=await readAssistantNews({from:'2026-10-19',to:'2026-10-25',limit:5},'zh',async()=>items,'America/Los_Angeles');
    expect(result.sources.map(s=>s.id)).toEqual(['news:current']);
    expect(result.evidence).toMatchObject({matching:1,oldestAvailableDate:'2026-10-18',articles:[{date:'2026-10-20'}]});
    expect(JSON.stringify(result.evidence)).not.toContain('publishedAt');
    const empty=await readAssistantNews({from:'2026-10-26',to:'2026-11-01',limit:5},'en',async()=>items,'UTC');
    expect(empty.evidence).toMatchObject({matching:0,articles:[]});
    expect(empty.sources[0].href).toBe('https://www.worldcubeassociation.org/posts');
  });
  it('strips markup, deduplicates articles and rejects untrusted links and dates',()=>{
    const valid=item('example','2026-10-20','<p>Facts <strong>here</strong>.</p><script>secret()</script>');
    const items=parseAssistantNews(feed(valid+valid+item('bad','invalid')+valid.replace('/posts/example','/posts/../../evil')+valid.replace('www.worldcubeassociation.org','evil.example')));
    expect(items).toEqual([{title:'News & updates',href:'https://www.worldcubeassociation.org/posts/example',publishedAt:'2026-10-20T00:00:00.000Z',text:'Facts here.'}]);
  });
  it.each(['<html>challenge</html>','<rss><channel>','<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>'])('does not present invalid feeds as no news: %s',xml=>{
    expect(()=>parseAssistantNews(xml)).toThrow('source_unavailable');
  });
  it('allows internal routes and safe public HTTPS metadata while keeping feed validation separate',()=>{
    for(const href of ['/regulation','https://www.worldcubeassociation.org/posts','https://www.worldcubeassociation.org/posts/example-2026','https://www.typescriptlang.org/docs/']) expect(isAssistantSourceHref(href)).toBe(true);
    for(const href of ['//evil.example','/\\evil.example','javascript:alert(1)','https://www.worldcubeassociation.org.evil.example/posts/x','https://user@www.worldcubeassociation.org/posts/x','https://127.0.0.1/private','https://www.worldcubeassociation.org/posts/x?token=secret']) expect(isAssistantSourceHref(href)).toBe(false);
  });
});
