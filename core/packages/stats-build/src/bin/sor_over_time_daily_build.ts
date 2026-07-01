// NOTE: SOR (Sum of Ranks) DAILY over-time builder — bar-chart-race at per-comp-day granularity.
// 取代年级 race(24 帧)→ 逐比赛日帧。直接从 MySQL WCA dump 重放 17 现役项目结果:
//   - 按 comp end_date 归并重放,维护 每项 × (世界 / 大洲 / 国家) 的 Fenwick(序统计)+ 参与人数
//   - 代表国随比赛变更 → 搬迁该人已有 PB 的 Fenwick 项(对齐 historical_ranks_build.computeBestRanks)
//   - 每比赛日:SOR = Σ_项 (有名次? 该 scope 世界/洲/国排名 : 该 scope 参与人数+1 罚分);取 top-STORE_K
//   - order 去重:仅当某 scope top-STORE_K 的"人员顺序"变化才出帧(SOR 值每日微抖不出帧)
// 输出(与年级同路径,新 shape:帧 key 从 y:number 改为 d:'YYYY-MM-DD'):
//   stats/sor_over_time.json                  ← 索引(granularity:'day' / persons / comps / scopes)
//   stats/sor_over_time/world.json            ← { single: DayFrame[], average: DayFrame[] }
//   stats/sor_over_time/continent/{Cont}.json
//   stats/sor_over_time/country/{ISO2}.json
// 用法(CI,historical_ranks_build 之后同一 MySQL):
//   NODE_OPTIONS='--max-old-space-size=8192' npx tsx src/bin/sor_over_time_daily_build.ts
// 本地校验:VALIDATE=1(对现有年表比年末 top-10);SINGLE_ONLY=1 只跑单次(快)。
//
// 口径对齐年级主榜:17 现役项目;average 跳过 333mbf;并列取 standard competition ranking。
// 罚分/参与人数按 scope(世界/该洲/该国)当日实时计。sor_historical_best(徽标)仍由年级
// sor_over_time_build.ts 产出,本 builder 只管 race 帧。

import mysql from 'mysql2/promise';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../../../..');              // repo root cuberoot.me (has stats/); from src/bin that's 5 up
const STATS_DIR = process.env.STATS_DIR || resolve(ROOT, 'stats');
const SOR_DIR = resolve(STATS_DIR, 'sor_over_time');

const EVENTS = ['333','222','444','555','666','777','333bf','333fm','333oh','minx','pyram','clock','skewb','sq1','444bf','555bf','333mbf'] as const;
const NO_AVG = new Set<string>(['333mbf']);
const STORE_K = 15, SHOW_N = 10;
const FRAME_START = 20030822;         // race 起点(项目约定;此前结果全折进第 0 帧)
const MIN_COUNTRY_CUBERS = 10;
const VALIDATE = process.env.VALIDATE === '1';
const SINGLE_ONLY = process.env.SINGLE_ONLY === '1';

class Fen {
  private t: Int32Array;
  constructor(n: number) { this.t = new Int32Array(n + 2); }
  add(i: number, v: number) { for (i++; i < this.t.length; i += i & -i) this.t[i] += v; }
  private sumLE(i: number) { let s = 0; for (i++; i > 0; i -= i & -i) s += this.t[i]; return s; }
  countLess(idx: number) { return idx > 0 ? this.sumLE(idx - 1) : 0; }
}
const ymd = (d: string) => +d.slice(0,4)*10000 + +d.slice(5,7)*100 + +d.slice(8,10);
const dstr = (n: number) => `${String(Math.floor(n/10000)).padStart(4,'0')}-${String(Math.floor(n/100)%100).padStart(2,'0')}-${String(n%100).padStart(2,'0')}`;

interface FrameRow { p: string; v: number; r: number; c?: string }
interface DayFrame { d: string; rows: FrameRow[] }
interface ScopeOut { single: DayFrame[]; average: DayFrame[] }

async function main() {
  const t0 = Date.now();
  mkdirSync(resolve(SOR_DIR, 'continent'), { recursive: true });
  mkdirSync(resolve(SOR_DIR, 'country'), { recursive: true });

  // ── config / connect ──
  const dbHost = process.env.MYSQL_HOST;
  const dbConfig = dbHost
    ? { host: dbHost, user: process.env.MYSQL_USER ?? 'root', password: process.env.MYSQL_PASS ?? '', database: process.env.MYSQL_DB ?? 'wca_developer_database' }
    : (() => { const y = parseYaml(readFileSync(resolve(__dirname, '../../database.yml'), 'utf8')); return { host: y.host, user: y.username, password: y.password, database: y.database }; })();
  const conn = await mysql.createConnection(dbConfig);

  // ── reference: countries/continents, persons(name+current country), competitions(name) ──
  const [countries] = await conn.query<mysql.RowDataPacket[]>(`SELECT id, iso2, name, continent_id FROM countries`);
  const cCodeOf = new Map<string, number>();
  const cIso2: (string|null)[] = []; const cName: string[] = []; const cContCode: number[] = [];
  const contCodeOf = new Map<string, number>(); const contId: string[] = [];   // '_Asia'...
  const cc = (cont: string) => { let v = contCodeOf.get(cont); if (v===undefined){v=contId.length;contCodeOf.set(cont,v);contId.push(cont);} return v; };
  for (const c of countries) {
    const code = cIso2.length; cCodeOf.set(c.id as string, code);
    cIso2.push((c.iso2 as string) || null); cName.push((c.name as string) || (c.id as string)); cContCode.push(cc(c.continent_id as string));
  }
  const contDisplay = contId.map(s => s.replace(/^_/, ''));       // 'Asia'
  const [persons] = await conn.query<mysql.RowDataPacket[]>(`SELECT wca_id, name, country_id FROM persons WHERE sub_id=1`);
  const nameByWca = new Map<string, string>(); const curCtryByWca = new Map<string, string>();
  for (const p of persons) { nameByWca.set(p.wca_id as string, p.name as string); curCtryByWca.set(p.wca_id as string, p.country_id as string); }
  const [comps] = await conn.query<mysql.RowDataPacket[]>(`SELECT id, name FROM competitions`);
  const compName = new Map<string, string>(); for (const c of comps) compName.set(c.id as string, c.name as string);
  console.log(`[sor-daily] ref: countries=${cIso2.length} continents=${contId.length} persons=${persons.length} comps=${compName.size}`);

  // ── load results (best + average + representing country + comp) per event ──
  const pidId = new Map<string, number>(); const pidStr: string[] = [];
  const iid = (s:string)=>{let v=pidId.get(s);if(v===undefined){v=pidStr.length;pidId.set(s,v);pidStr.push(s);}return v;};
  const compIdIntern = new Map<string, number>(); const compIdStr: string[] = [];
  const cidi = (s:string)=>{let v=compIdIntern.get(s);if(v===undefined){v=compIdStr.length;compIdIntern.set(s,v);compIdStr.push(s);}return v;};
  // parallel column arrays over ALL results (best>0 OR average>0)
  const rDay:number[]=[]; const rEv:number[]=[]; const rPid:number[]=[]; const rBest:number[]=[]; const rAvg:number[]=[]; const rCtry:number[]=[]; const rComp:number[]=[];
  for (let e=0;e<EVENTS.length;e++){
    const tq=Date.now();
    const [rows]=await conn.query<mysql.RowDataPacket[]>(
      `SELECT r.person_id pid, r.best best, r.average avg, r.country_id ctry, r.competition_id comp,
              DATE_FORMAT(COALESCE(c.end_date,c.start_date),'%Y-%m-%d') d
         FROM results r JOIN competitions c ON c.id=r.competition_id
        WHERE r.event_id=? AND (r.best>0 OR r.average>0) AND c.start_date IS NOT NULL`, [EVENTS[e]]);
    for (const r of rows){
      rDay.push(ymd(r.d as string)); rEv.push(e); rPid.push(iid(r.pid as string));
      rBest.push(r.best as number); rAvg.push(r.avg as number);
      rCtry.push(cCodeOf.get(r.ctry as string) ?? -1); rComp.push(cidi(r.comp as string));
    }
    console.log(`  [${EVENTS[e]}] ${rows.length.toLocaleString()} rows (${Date.now()-tq}ms)`);
  }
  await conn.end();
  const M=rDay.length, P=pidStr.length;
  const order=Array.from({length:M},(_,i)=>i).sort((a,b)=>rDay[a]!-rDay[b]!);
  console.log(`[sor-daily] rows=${M.toLocaleString()} persons=${P.toLocaleString()} (load+sort ${((Date.now()-t0)/1000).toFixed(1)}s)`);

  // ── scope frame accumulators (persist across metrics) ──
  const worldOut: ScopeOut = { single: [], average: [] };
  const contOut = new Map<number, ScopeOut>();     // contCode -> out
  const ctryOut = new Map<number, ScopeOut>();      // cCode -> out
  const maxCountryN = new Map<number, number>();
  const personsInFrames = new Set<number>(); const personFrameCtry = new Map<number, number>();
  const referencedComps = new Set<number>();
  const contSeen = new Set<number>();

  // ── per-metric replay ──
  function processMetric(isAvg: boolean) {
    const metricKey = isAvg ? 'average' : 'single';
    // value compression per event for THIS metric
    const evVals: Set<number>[] = EVENTS.map(()=>new Set());
    for (let k=0;k<M;k++){ const e=rEv[k]!; if (isAvg && NO_AVG.has(EVENTS[e]!)) continue; const v=isAvg?rAvg[k]!:rBest[k]!; if (v>0) evVals[e]!.add(v); }
    const evIdxMap = evVals.map(s=>{const a=[...s].sort((x,y)=>x-y);const m=new Map<number,number>();a.forEach((v,i)=>m.set(v,i));return m;});
    const evSize = evVals.map(s=>s.size);

    const curIdx: Int32Array[] = EVENTS.map(()=>new Int32Array(P).fill(-1));
    const worldFen = EVENTS.map((_,e)=>new Fen(evSize[e]!)); const worldField = new Int32Array(EVENTS.length);
    const contFen: Map<number,Fen>[] = EVENTS.map(()=>new Map()); const contField: Map<number,number>[] = EVENTS.map(()=>new Map());
    const ctryFen: Map<number,Fen>[] = EVENTS.map(()=>new Map()); const ctryField: Map<number,number>[] = EVENTS.map(()=>new Map());
    const gF=(m:Map<number,Fen>,k:number,e:number)=>{let f=m.get(k);if(!f){f=new Fen(evSize[e]!);m.set(k,f);}return f;};
    const gN=(m:Map<number,number>,k:number)=>m.get(k)||0;
    const pcur = new Int32Array(P).fill(-1);           // person current representing country code
    const pLastComp = new Int32Array(P).fill(-1); const pLastDay = new Int32Array(P);
    const activePids: number[] = []; const hasAny = new Uint8Array(P);

    // transient top-K per scope for the current day
    const worldTop: {id:number;sor:number}[] = [];
    const contTop = new Map<number,{id:number;sor:number}[]>();
    const ctryTop = new Map<number,{id:number;sor:number}[]>();
    const prevOrder = { world: '', cont: new Map<number,string>(), ctry: new Map<number,string>() };

    const insTop=(top:{id:number;sor:number}[], id:number, sor:number)=>{
      if(top.length<STORE_K) top.push({id,sor});
      else { const w=top[STORE_K-1]!; if(sor>w.sor||(sor===w.sor&&pidStr[id]!>=pidStr[w.id]!))return; top[STORE_K-1]={id,sor}; }
      let pos=top.length-1;
      while(pos>0){const a=top[pos-1]!,b=top[pos]!; if(a.sor>b.sor||(a.sor===b.sor&&pidStr[a.id]!>pidStr[b.id]!)){top[pos-1]=b;top[pos]=a;pos--;}else break;}
    };
    const sorScoped=(id:number, fen:(e:number)=>Fen|undefined, field:(e:number)=>number)=>{
      let sor=0,done=0;
      for(let e=0;e<EVENTS.length;e++){ if(isAvg&&NO_AVG.has(EVENTS[e]!))continue; const ix=curIdx[e]![id]!;
        if(ix>=0){const f=fen(e);sor+=(f?f.countLess(ix):0)+1;done++;} else sor+=field(e)+1; }
      return {sor,done};
    };
    const emitFrame=(arr:DayFrame[], top:{id:number;sor:number}[], day:number)=>{
      const rows:FrameRow[]=[]; let ps=NaN,pr=0;
      for(let k=0;k<top.length;k++){const x=top[k]!;let rk;if(x.sor===ps)rk=pr;else{rk=k+1;ps=x.sor;pr=rk;}
        const lc = pLastComp[x.id]!>=0 ? compIdStr[pLastComp[x.id]!] : undefined;
        rows.push({p:pidStr[x.id]!,v:x.sor,r:rk,...(lc?{c:lc}:{})});
        personsInFrames.add(x.id); personFrameCtry.set(x.id, pcur[x.id]!); if(lc) referencedComps.add(pLastComp[x.id]!);
      }
      arr.push({d:dstr(day),rows});
    };

    let i=0;
    while(i<M){
      const day=rDay[order[i]!]!;
      while(i<M){ const oi=order[i]!; if(rDay[oi]!!==day)break;
        const e=rEv[oi]!; const p=rPid[oi]!; const v=isAvg?rAvg[oi]!:rBest[oi]!; const nc=rCtry[oi]!;
        if (isAvg && NO_AVG.has(EVENTS[e]!)) { i++; continue; }
        // representing-country switch: move all existing PBs old->new country/continent
        if (nc>=0 && pcur[p]>=0 && nc!==pcur[p]) {
          const oc=pcur[p]!, ocn=cContCode[oc]!, ncn=cContCode[nc]!;
          for (let ev=0;ev<EVENTS.length;ev++){ if(isAvg&&NO_AVG.has(EVENTS[ev]!))continue; const ix=curIdx[ev]![p]!; if(ix<0)continue;
            gF(ctryFen[ev]!,oc,ev).add(ix,-1); ctryField[ev]!.set(oc,gN(ctryField[ev]!,oc)-1);
            gF(ctryFen[ev]!,nc,ev).add(ix,1);  ctryField[ev]!.set(nc,gN(ctryField[ev]!,nc)+1);
            if (ocn!==ncn) {
              gF(contFen[ev]!,ocn,ev).add(ix,-1); contField[ev]!.set(ocn,gN(contField[ev]!,ocn)-1);
              gF(contFen[ev]!,ncn,ev).add(ix,1);  contField[ev]!.set(ncn,gN(contField[ev]!,ncn)+1);
            }
          }
          pcur[p]=nc;
        }
        if (v>0) {
          const ni=evIdxMap[e]!.get(v)!; const cur=curIdx[e]![p]!; const cco=nc>=0?nc:pcur[p]!; const con=cco>=0?cContCode[cco]!:-1;
          if (cco>=0 && pcur[p]<0) pcur[p]=cco;
          if (cur<0) {
            worldFen[e]!.add(ni,1); worldField[e]!++;
            if(cco>=0){gF(ctryFen[e]!,cco,e).add(ni,1); ctryField[e]!.set(cco,gN(ctryField[e]!,cco)+1);}
            if(con>=0){gF(contFen[e]!,con,e).add(ni,1); contField[e]!.set(con,gN(contField[e]!,con)+1);}
            curIdx[e]![p]=ni; pLastComp[p]=rComp[oi]!; pLastDay[p]=day;
          } else if (ni<cur) {
            worldFen[e]!.add(cur,-1); worldFen[e]!.add(ni,1);
            if(cco>=0){const f=gF(ctryFen[e]!,cco,e);f.add(cur,-1);f.add(ni,1);}
            if(con>=0){const f=gF(contFen[e]!,con,e);f.add(cur,-1);f.add(ni,1);}
            curIdx[e]![p]=ni; pLastComp[p]=rComp[oi]!; pLastDay[p]=day;
          }
        }
        if(!hasAny[p]){hasAny[p]=1;activePids.push(p);}
        i++;
      }
      const emit = day>=FRAME_START;
      // one pass: world + own continent + own country
      worldTop.length=0; contTop.clear(); ctryTop.clear();
      for(let a=0;a<activePids.length;a++){
        const id=activePids[a]!; const cco=pcur[id]!; const con=cco>=0?cContCode[cco]!:-1;
        const ws=sorScoped(id, e=>worldFen[e], e=>worldField[e]!); if(ws.done>0) insTop(worldTop,id,ws.sor);
        if(con>=0){ let t=contTop.get(con); if(!t){t=[];contTop.set(con,t);} const cs=sorScoped(id, e=>contFen[e]!.get(con), e=>gN(contField[e]!,con)); if(cs.done>0) insTop(t,id,cs.sor); }
        if(cco>=0 && cIso2[cco]){ let t=ctryTop.get(cco); if(!t){t=[];ctryTop.set(cco,t);} const qs=sorScoped(id, e=>ctryFen[e]!.get(cco), e=>gN(ctryField[e]!,cco)); if(qs.done>0) insTop(t,id,qs.sor); }
      }
      if(emit){
        // world
        const wk=worldTop.map(x=>pidStr[x.id]!).join(','); if(wk!==prevOrder.world){emitFrame(worldOut[metricKey],worldTop,day);prevOrder.world=wk;}
        // continents
        for(const [con,t] of contTop){ contSeen.add(con); let out=contOut.get(con); if(!out){out={single:[],average:[]};contOut.set(con,out);} const k=t.map(x=>pidStr[x.id]!).join(','); if(k!==(prevOrder.cont.get(con)||'')){emitFrame(out[metricKey],t,day);prevOrder.cont.set(con,k);} }
        // countries
        for(const [cco,t] of ctryTop){ maxCountryN.set(cco,Math.max(maxCountryN.get(cco)||0,t.length)); let out=ctryOut.get(cco); if(!out){out={single:[],average:[]};ctryOut.set(cco,out);} const k=t.map(x=>pidStr[x.id]!).join(','); if(k!==(prevOrder.ctry.get(cco)||'')){emitFrame(out[metricKey],t,day);prevOrder.ctry.set(cco,k);} }
      } else {
        // still record country max for filter + carry orders so first emitted frame diffs correctly
        for(const [cco,t] of ctryTop) maxCountryN.set(cco,Math.max(maxCountryN.get(cco)||0,t.length));
      }
    }
    console.log(`  [${metricKey}] world=${worldOut[metricKey].length}kf conts=${contOut.size} countries=${ctryOut.size} (${((Date.now()-t0)/1000).toFixed(1)}s)`);
  }

  processMetric(false);
  if (!SINGLE_ONLY) processMetric(true);

  // ── write scope files ──
  writeFileSync(resolve(SOR_DIR,'world.json'), JSON.stringify(worldOut));
  for(const [con,out] of contOut) writeFileSync(resolve(SOR_DIR,'continent',`${contDisplay[con]!.replace(/\s+/g,'_')}.json`), JSON.stringify(out));
  let countryFiles=0; const countryList:{iso2:string;id:string;name:string}[]=[];
  for(const [cco,out] of ctryOut){ const iso2=cIso2[cco]; if(!iso2)continue; if((maxCountryN.get(cco)||0)<MIN_COUNTRY_CUBERS)continue;
    writeFileSync(resolve(SOR_DIR,'country',`${iso2}.json`), JSON.stringify(out));
    countryList.push({iso2, id:[...cCodeOf].find(([,v])=>v===cco)![0], name:cName[cco]!}); countryFiles++; }

  // ── index ──
  const personsIdx: Record<string,{name:string;country:string;iso2:string|null}> = {};
  for(const id of personsInFrames){ const cco=personFrameCtry.get(id); const ctryId = cco!==undefined&&cco>=0 ? [...cCodeOf].find(([,v])=>v===cco)?.[0]||'' : '';
    personsIdx[pidStr[id]!] = { name: nameByWca.get(pidStr[id]!)||pidStr[id]!, country: ctryId, iso2: cco!==undefined&&cco>=0?cIso2[cco]||null:null }; }
  const compsIdx: Record<string,string> = {};
  for(const cid of referencedComps){ const n=compName.get(compIdStr[cid]!); if(n) compsIdx[compIdStr[cid]!]=n; }
  countryList.sort((a,b)=>a.name.localeCompare(b.name));
  const index = {
    id:'sor_over_time', granularity:'day', storeK:STORE_K, showN:SHOW_N,
    scopes:{ world:true, continents:[...contSeen].map(c=>contDisplay[c]!).sort(), countries:countryList },
    comps:compsIdx, persons:personsIdx,
  };
  writeFileSync(resolve(STATS_DIR,'sor_over_time.json'), JSON.stringify(index));

  // ── validation (optional) ──
  if (VALIDATE) {
    const yearTopStored=(path:string)=>{ if(!existsSync(path))return null; const j=JSON.parse(readFileSync(path,'utf8')); const m=new Map<number,string[]>(); for(const f of (j.single||[])) m.set((f.y ?? +String(f.d).slice(0,4)), (f.rows||[]).slice(0,SHOW_N).map((r:any)=>r.p)); return m; };
    const yearEndMine=(out:ScopeOut)=>{ const m=new Map<number,string[]>(); for(const f of out.single) m.set(+f.d.slice(0,4), f.rows.slice(0,SHOW_N).map(r=>r.p)); return m; };
    const cmp=(label:string, mine:Map<number,string[]>, stored:Map<number,string[]>|null)=>{ if(!stored){console.log(`  [${label}] no stored`);return;} let ok=0,tot=0;const bad:number[]=[]; for(const [y,top] of stored){ if(y<2004)continue; const mm=mine.get(y); if(!mm)continue; tot++; if(mm.length===top.length&&mm.every((p,k)=>p===top[k]))ok++;else bad.push(y);} console.log(`  [${label}] year-end ${ok}/${tot}${bad.length?` mismatch ${bad.join(',')}`:''}`); };
    const REF = resolve(ROOT,'stats/sor_over_time');    // committed yearly files (intact when STATS_DIR points elsewhere)
    console.log('\n=== VALIDATION (year-end top-10 vs stored yearly) ===');
    cmp('world', yearEndMine(worldOut), yearTopStored(resolve(REF,'world.json')) || null);
    const asia=contCodeOf.get('_Asia'); if(asia!==undefined&&contOut.get(asia)) cmp('Asia', yearEndMine(contOut.get(asia)!), yearTopStored(resolve(REF,'continent/Asia.json')));
    const us=cCodeOf.get('USA'); if(us!==undefined&&ctryOut.get(us)) cmp('USA', yearEndMine(ctryOut.get(us)!), yearTopStored(resolve(REF,'country/US.json')));
    const cn=cCodeOf.get('China'); if(cn!==undefined&&ctryOut.get(cn)) cmp('China', yearEndMine(ctryOut.get(cn)!), yearTopStored(resolve(REF,'country/CN.json')));
  }

  const idxMb=(statSync(resolve(STATS_DIR,'sor_over_time.json')).size/1024/1024).toFixed(2);
  console.log(`\n=== Done in ${((Date.now()-t0)/1000).toFixed(1)}s ===`);
  console.log(`world + ${contOut.size} continents + ${countryFiles} countries;  index persons=${personsInFrames.size} (${idxMb}MB)`);
}
main().catch(e=>{console.error(e);process.exit(1);});
