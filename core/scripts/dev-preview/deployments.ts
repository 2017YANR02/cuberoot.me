type Run={name:string;headSha:string;status:string;conclusion:string};
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
