/** Explicit, private real-model benchmark. Never mounted as an HTTP endpoint. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createSiteAssistantRoutes, requireAssistantUser } from '../src/routes/site_assistant.js';
import { answerSiteQuestion, assistantConfig } from '../src/utils/site_assistant.js';
import { getUserById } from '../src/utils/account.js';
import { signSession } from '../src/utils/session.js';

export interface BenchmarkCase { id:string; category:string; question:string; expected:string; statId?:string }
export function parseBenchmarkQuestions(markdown:string): BenchmarkCase[] {
  return markdown.split('\n').filter(line=>/^\| [RDS]\d+ \|/.test(line)).map(line=>{
    const [id,category,question,expected,statId]=line.split('|').slice(1,-1).map(cell=>cell.trim());
    if(!id || !question || question.length>500) throw new Error('Invalid benchmark question');
    return {id,category,question,expected,...(statId && statId!=='—'?{statId}:{})};
  });
}

export async function runAssistantBenchmark(cases:BenchmarkCase[], accountId:number, expectedWcaId:string) {
  if(cases.length<1 || cases.length>100 || new Set(cases.map(c=>c.id)).size!==cases.length) throw new Error('Expected 1–100 unique cases');
  const config = assistantConfig();
  if(!config) throw new Error('Configure the existing server-side assistant provider before benchmarking');
  const account=await getUserById(accountId);
  if(account?.wca_id!==expectedWcaId) throw new Error('Benchmark account mismatch');
  // Kept only in this process; never printed, saved, or sent to the provider.
  const token=signSession({uid:account.id,wcaId:account.wca_id});
  // Private diagnostics do not consume the public site's remaining 100/day
  // allowance before migration. The fixed 800/day diagnostic ceiling plus that
  // public ceiling stays below the owner's requested 1000/day overall budget.
  // Run a single benchmark process at a time; this is not a production limiter.
  const day=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  const ledger=`/tmp/cuberoot-assistant-benchmark-${day}.json`;
  const reserve=async()=>{
    const count=existsSync(ledger)?JSON.parse(readFileSync(ledger,'utf8')).questions:0;
    if(!Number.isInteger(count) || count<0 || count>=800) return {allowed:false,retryAfter:86400};
    writeFileSync(ledger,JSON.stringify({day,questions:count+1}),{mode:0o600});
    return {allowed:true,retryAfter:86400};
  };
  console.log(JSON.stringify({benchmarkRun:true,started:new Date().toISOString(),cases:cases.length,model:config.model,providerOrigin:new URL(config.baseUrl).origin,budget:'isolated-800-per-Beijing-day',surface:'in-process real API handler; real account lookup; real configured model; real public data; no browser/network ingress',requestCache:'fresh per question',providerCache:'uncontrolled'}));
  for(const item of cases) {
    const modelSteps:unknown[]=[];
    const fetcher:typeof fetch=async(input,init)=>{
      const started=performance.now();
      const response=await fetch(input,init);
      if(String(input).endsWith('/chat/completions')) {
        const payload=await response.clone().json().catch(()=>null);
        const content=payload?.choices?.[0]?.message?.content;
        let parsed;try{parsed=JSON.parse(content);}catch{}
        modelSteps.push({ms:Math.round(performance.now()-started),status:response.status,model:payload?.model,hasReasoning:!!payload?.choices?.[0]?.message?.reasoning_content,usage:payload?.usage,finish:payload?.choices?.[0]?.finish_reason,calls:parsed?.calls,unexpectedShape:parsed && !Array.isArray(parsed.calls)?parsed:undefined,decodeFailure:parsed?undefined:String(content).slice(0,500)});
      }
      return response;
    };
    // Fresh process-local rate window per case avoids measuring deliberate 429s.
    // The normal production burst/concurrency policy remains covered separately.
    const route=createSiteAssistantRoutes({config:assistantConfig,authenticate:requireAssistantUser,now:Date.now,reserve,
      answer:(q,l,c,s,_f,h,v)=>answerSiteQuestion(q,l,c,s,fetcher,h,v)});
    const history=item.id==='D08'?[{role:'user',content:'我想看 2009ZEMD01 的三阶成绩'},{role:'assistant',content:'我们正在查看 2009ZEMD01 的三阶成绩。'}]:[];
    const started=performance.now();
    const response=await route.request('/site-assistant',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({question:item.question,lang:'zh',history})});
    const result=await response.json();
    console.log(JSON.stringify({benchmark:true,id:item.id,question:item.question,statId:item.statId,durationMs:Math.round(performance.now()-started),status:response.status,result,modelSteps,rssMb:Math.round(process.memoryUsage().rss/1048576)}));
    if(response.status===429) break;
  }
  console.log(JSON.stringify({benchmarkEnd:true,peakRssMb:Math.round(process.resourceUsage().maxRSS/1024)}));
}

// Explicit opt-in: importing this module never starts paid calls.
if(process.argv.includes('--run')) {
  const value=(name:string)=>process.argv.find(arg=>arg.startsWith(`--${name}=`))?.slice(name.length+3);
  const file=value('questions'), accountId=Number(value('account-id')), wcaId=value('wca-id');
  if(!file || !Number.isSafeInteger(accountId) || accountId<1 || !wcaId || !/^\d{4}[A-Z]{4}\d{2}$/.test(wcaId)) throw new Error('Required: --run --questions=path.md --account-id=N --wca-id=YYYYXXXXNN');
  await runAssistantBenchmark(parseBenchmarkQuestions(readFileSync(file,'utf8')),accountId,wcaId);
  process.exit(0);
}
