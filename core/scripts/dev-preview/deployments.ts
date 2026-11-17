export type Run={name:string;headSha:string;status:string;conclusion:string;databaseId?:number};
export function deploymentProgress(sha:string,names:string[],runs:Run[],isEquivalent:(sha:string)=>boolean){
  return names.map(name=>{
    const eligible=runs.filter(r=>r.name===name&&(r.headSha===sha||isEquivalent(r.headSha)));
    const run=eligible.find(r=>r.conclusion==='success')??eligible.find(r=>r.status!=='completed')??eligible[0];
    return {name,runId:run?.databaseId??null,state:!run?'queued':run.conclusion==='success'?'success':run.status==='in_progress'?'running':run.status==='completed'?'failure':'queued'};
  });
}
// A later repair commit may redeploy only the failed application. Accept it only
// when it contains the checkpoint and preserves all three device artifacts.
export function deploymentState(sha:string,names:string[],runs:Run[],isEquivalentDescendant:(sha:string)=>boolean):'success'|'failure'|'pending'{
  const cache=new Map<string,boolean>([[sha,true]]);
  const eligible=runs.filter(r=>{
    if(!names.includes(r.name))return false;
    if(!cache.has(r.headSha))cache.set(r.headSha,isEquivalentDescendant(r.headSha));
    return cache.get(r.headSha);
  });
  if(names.every(name=>eligible.some(r=>r.name===name&&r.conclusion==='success')))return 'success';
  if(names.some(name=>{
    const rows=eligible.filter(r=>r.name===name);
    return rows.length>0&&!rows.some(r=>r.conclusion==='success'||r.status!=='completed');
  }))return 'failure';
  return 'pending';
}
