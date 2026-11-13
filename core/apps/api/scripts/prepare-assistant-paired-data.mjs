/** Small public-data fixture; never imports or writes a production database. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import postgres from 'postgres';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..'),dir=path.join(root,'.local-data/assistant-evaluation-20261112');
const sha=x=>createHash('sha256').update(x).digest('hex');
const source=new Map(fs.readdirSync(dir).filter(f=>f.endsWith('.meta.json')).map(f=>{const m=JSON.parse(fs.readFileSync(path.join(dir,f)));return [m.url,{...m,file:f.replace('.meta.json','.body')}];}));
async function capture(url){if(source.get(url)?.status===200)return;const r=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});const b=Buffer.from(await r.arrayBuffer());if(!r.ok||b.length>8e6)throw new Error(`Public capture failed: ${url} (${r.status})`);const id=sha(url).slice(0,16),meta={url,status:r.status,type:r.headers.get('content-type'),retrievedAt:new Date().toISOString(),sha256:sha(b),file:id+'.body'};fs.writeFileSync(path.join(dir,meta.file),b);fs.writeFileSync(path.join(dir,id+'.meta.json'),JSON.stringify(meta));source.set(url,meta);}
const json=url=>JSON.parse(fs.readFileSync(path.join(dir,source.get(url).file)));
for(const year of [2025,2026])for(const type of ['single','average'])await capture(`https://api.cuberoot.me/v1/wca/historical-ranks?event=333&type=${type}&country=&year=${year}&size=20&page=1`);
const all=json('https://next.cuberoot.me/assistant/pages.json');
const hrefs=['/regulation/speed-solving','/regulation/solved-state','/regulation/defects','/regulation/competitors','/regulation/one-handed','/regulation/events','/regulation/blindfolded','/regulation/puzzles','/regulation/scrambling','/regulation/notation','/timer','/timer/accuracy','/frame-count-about'];
const pages=all.pages.filter(page=>hrefs.includes(page.href));
// Same source text and source metadata in both arms; each version performs its
// own actual chunking. This evaluates a bounded corpus, not full-site coverage.
const corpus={...all,releaseId:'paired-evaluation-20261112',pages};
fs.writeFileSync(path.join(dir,'corpus.json'),JSON.stringify(corpus));
const cases=[];
const add=(id,category,question,expected,extra={})=>cases.push({id,category,question,expected,...extra});
add('G01','基础','一句话说清楚 DNF 和 DNS 的区别。','未完成/未开始，展开英文必须正确');
add('G02','基础','CFOP 的四个阶段分别是什么？不要推荐课程。','Cross/F2L/OLL/PLL及顺序，不夹带课程');
add('G03','基础','五次成绩是12秒、13秒、14秒、15秒和DNF，ao5是多少？','去最快12和最差DNF，平均14秒');
add('G04','训练','我三阶平均30秒，F2L总停顿，每天只有15分钟，给我三个能执行的练习建议。','针对观察与停顿的三条可执行建议，不保证达成某秒数');
add('N01','导航','给我本站练习 PLL 识别的入口，只要一个链接。','/recognize/pll，单一入口');
add('N02','导航','我想查三盲公式，给我入口，不用介绍教程。','/alg/3bld/lookup');
add('R01','规则','根据本站 WCA 速拧规则，观察到15.5秒才开始转动，应判什么？','+2，规则检查的是启动计时而非首个转动，指出表述歧义');
add('R02','规则','根据 WCA 速拧规则，观察时间达到17秒才启动计时器，是加两秒还是DNF？','DNF，引用可读规则');
add('R03','规则','比赛可以戴耳机降噪吗？请按本站参赛选手规则说明例外。','不可用电子设备降噪，可用不播放声音的非电子耳罩等，保留合法例外');
add('R04','规则','根据本站魔方故障规则，三阶中心盖掉了但我继续还原，会直接判DNF吗？','仅非功能中心盖缺失不自动DNF，条件不可泛化所有零件');
add('R05','规则','按本站单手规则，复原途中能换另一只手转吗？','一旦使用一只手复原不能改用另一只手；观察阶段区分');
add('S01','站点','根据本站计时器说明，怎么指定只练某几个公式情况？','仅按实际菜单说明，不猜按钮或功能');
add('S02','站点','请根据本站计时器页面确认：它能自动把我的成绩认证为WCA世界纪录吗？','不从缺少说明推断功能不存在；不虚构可自动认证');
add('S03','站点','根据本站数帧工具说明，数帧测时需要注意什么限制？','来源支持的时间精度/帧率限制，不宣称绝对准确');
add('D01','成绩','只告诉我2017YANR02三阶官方平均PB，不要单次和排名。','仅平均字段，对照profile.personal_records');
add('D02','统计','统计2017YANR02在2025年三阶每个月参加了多少场不同比赛，没比赛的月份可以不列。','按比赛开始日、event333、distinct comp_id、月粒度；不是轮次数');
add('D03','统计','2017YANR02在2025年三阶的尝试中，DNF占比多少？排除DNS和空缺，给分子、分母和百分比。','attempt=-1 / (attempt>0 OR -1)，列出三项');
add('C01','资讯','列出WCA官方RSS里最近两条公告，带发布日期。','冻结RSS最新两条与发布日期，说明仅RSS覆盖');
add('C02','资讯','本月发布和本月实际发生的魔方事件都要，按同一个日期范围列出来。','澄清两类时间含义，不能混用或虚构全面覆盖');
add('F01','追问','列出2025年三阶单次世界排名前三名。','对照冻结排名，含明确行次', {conversation:'ranking'});
add('F02','追问','第二名是谁？','对应上一轮实际表格第二名',{conversation:'ranking'});
add('F03','追问','他的三阶平均PB呢？只要平均。','沿用第二名身份，重新读取平均PB',{conversation:'ranking'});
add('F04','追问','回到刚才2025年的表，统计的是哪一年？','明确2025，不换当前年份',{conversation:'ranking'});
add('F05','追问','第二名现在还是3.06秒吗？','重查2026当前排名，不能直接复用2025表',{conversation:'ranking'});
add('H01','追问','我2025年参加过多少场三阶比赛？','viewer2017YANR02，2025，333，去重比赛',{conversation:'attendance'});
add('H02','追问','改成二阶呢？','继承2025和身份，项目改222',{conversation:'attendance'});
add('H03','追问','这些比赛分布在哪些国家？分别几场？','保持2025二阶范围，举办国家分组',{conversation:'attendance'});
add('H04','追问','不限年份和项目，我总共参加过多少场？','清除范围，profile生涯总数',{conversation:'attendance'});
add('E01','故障','查TPS的百科定义和论坛主题，有资料的部分先答，查不到的部分说明状态。','保留百科TPS定义，论坛失败单独说明',{fault:'forum_503'});
add('E02','故障','查F2L的百科定义和论坛讨论，论坛有问题也请先说能确认的部分。','不因论坛先失败丢掉百科',{fault:'forum_503'});
fs.writeFileSync(path.join(dir,'cases.json'),JSON.stringify({version:1,cases},null,2));
const db=postgres({host:'127.0.0.1',port:55487,user:'eula',database:'assistant_eval_data',max:1});
try{
 const existing=await db`SELECT to_regclass('public.wca_person_results') AS relation`;
 if(existing[0].relation)throw new Error('Fixture database already populated');
 const test=fs.readFileSync(path.join(root,'core/apps/api/tests/site_assistant_analysis_pg.test.ts'),'utf8');
 const schema=test.split('await db.unsafe(`')[1].split('INSERT INTO meta_historical')[0];
 await db.unsafe(schema);
 const people=[...source.keys()].filter(url=>url.includes('/person-page?')).map(json);
 const countries={CN:['China','_Asia'],JP:['Japan','_Asia'],MY:['Malaysia','_Asia'],SG:['Singapore','_Asia'],VN:['Vietnam','_Asia'],US:['USA','_North America'],AU:['Australia','_Oceania']};
 const comps=new Map();
 for(const person of people){
  const p=person.profile.person;await db`INSERT INTO wca_persons VALUES(${person.wcaId},${p.name},${countries[p.country_iso2]?.[0]??p.country_iso2})`;
  for(const c of person.comps)comps.set(c.id,c);
  for(const r of person.results)await db`INSERT INTO wca_person_results VALUES(${person.wcaId},${r.competition_id},${r.date},${r.event_id},${r.round_type_id},${r.format_id},${r.pos},${r.best},${r.average},${r.attempts},${r.regional_single_record},${r.regional_average_record})`;
 }
 for(const c of comps.values())await db`INSERT INTO wca_competitions VALUES(${c.id},${c.name},${countries[c.country_iso2]?.[0]??c.country_iso2},${c.country_iso2},${c.city},${c.start_date},${c.end_date})`;
 for(const [iso,[name,continent]]of Object.entries(countries))await db`INSERT INTO wca_countries VALUES(${name},${iso},${name},${continent})`;
 const meta=json('https://api.cuberoot.me/v1/wca/historical-ranks/meta');await db`INSERT INTO meta_historical VALUES('last_imported_at',${meta.lastImportedAt})`;
 await db.unsafe(fs.readFileSync(path.join(root,'ops/bin/provision-assistant-reader.sql'),'utf8'));await db.unsafe('GRANT cuberoot_assistant_reader TO CURRENT_USER');await db.unsafe(fs.readFileSync(path.join(root,'core/apps/api/migrations/0267_assistant_public_analysis.sql'),'utf8'));
 const person=people.find(p=>p.wcaId==='2017YANR02');const rows=person.results.filter(r=>r.event_id==='333'&&r.date.startsWith('2025'));
 const months=Object.fromEntries([...new Set(rows.map(r=>r.date.slice(5,7)))].sort().map(month=>[month,new Set(rows.filter(r=>r.date.slice(5,7)===month).map(r=>r.competition_id)).size]));
 const attempts=rows.flatMap(r=>r.attempts);const dnf=attempts.filter(v=>v===-1).length,denominator=attempts.filter(v=>v>0||v===-1).length;
 fs.writeFileSync(path.join(dir,'truth.json'),JSON.stringify({capturedAt:new Date().toISOString(),importedAt:meta.lastImportedAt,viewer:person.wcaId,profile:person.profile,months,dnf:{numerator:dnf,denominator,percent:100*dnf/denominator},scope:'Complete person histories only; not a global WCA database',people:people.map(p=>p.wcaId)},null,2));
}finally{await db.end();}
fs.writeFileSync(path.join(dir,'sources.json'),JSON.stringify([...source.values()],null,2));
console.log(JSON.stringify({cases:cases.length,corpusPages:pages.length,sources:source.size,fixtureSha256:sha(fs.readFileSync(path.join(dir,'sources.json')))}));
