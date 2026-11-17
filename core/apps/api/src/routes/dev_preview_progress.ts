// Expose only presentation fields, never the worker checkpoint/registry or credentials.
const stages = new Set(['checkout','identity','authorization','dns','http','certificate','https','finalizing']);
const workflows = new Set(['Deploy Web Ops Config','Deploy Core','Deploy Next']);
export type PreviewWorkerProgress = {request_id?:string; progress?:unknown; retry_at?:unknown; attempt?:unknown; http_sha?:string; https_sha?:string; expires_at?:string|Date; updated_at?:string|Date};
const timestamp = (value:unknown) => {
  if(typeof value!=='string' && typeof value!=='number' && !(value instanceof Date))return null;
  const ms=new Date(value).getTime();return Number.isFinite(ms)?new Date(ms).toISOString():null;
};
export function previewProgress(id:string,status:string,worker:PreviewWorkerProgress|undefined,now=Date.now()) {
  if(status!=='provisioning'||worker?.request_id!==id)return null;
  const raw=worker.progress && typeof worker.progress==='object'?worker.progress as Record<string,unknown>:{};
  const stage=typeof raw.stage==='string'&&stages.has(raw.stage)?raw.stage:worker.https_sha?'https':worker.http_sha?'http':null;
  const retryAt=timestamp(worker.retry_at),expiresAt=timestamp(worker.expires_at);
  const active=!!expiresAt&&Date.parse(expiresAt)>now;
  const state=retryAt&&(raw.state==='retrying'||(!raw.stage&&Number(worker.attempt)>0))&&(Date.parse(retryAt)>now||active) ? 'retrying'
    : !active ? 'waiting_worker'
    : raw.state==='waiting'||(!raw.stage&&(worker.https_sha||worker.http_sha))?'waiting':'running';
  const jobs=Array.isArray(raw.jobs)?raw.jobs.flatMap(value=>{
    if(!value||typeof value!=='object')return [];
    const j=value as Record<string,unknown>;
    if(typeof j.name!=='string'||!workflows.has(j.name)||!['queued','running','success','failure'].includes(String(j.state)))return [];
    return [{name:j.name,state:String(j.state),runId:Number.isSafeInteger(j.runId)&&Number(j.runId)>0?Number(j.runId):null}];
  }).slice(0,3):[];
  return {stage,state,jobs,updatedAt:timestamp(raw.updatedAt)||timestamp(worker.updated_at),retryAt:state==='retrying'?retryAt:null,
    attempt:state==='retrying'&&Number.isSafeInteger(Number(worker.attempt))?Math.max(0,Number(worker.attempt)):0};
}
