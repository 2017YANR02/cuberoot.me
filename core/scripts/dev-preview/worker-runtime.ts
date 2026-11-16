import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { nginx, origins, validate, type Registry } from './model.ts';
import { artifacts } from './checkout.ts';

export type Command = (command: string, args: string[], options?: { input?: string; env?: NodeJS.ProcessEnv; timeout?: number }) => Promise<string>;

/** Abort the entire command group when lease renewal fails, including SSH children. */
export function commandRunner(cwd: string, signal: AbortSignal): Command {
  return (command,args,options={}) => new Promise((resolve,reject)=>{
    if(signal.aborted){reject(Error('Worker lease lost'));return;}
    const child=spawn(command,args,{cwd,env:options.env??process.env,detached:true,stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='',stopped=false,killTimer:ReturnType<typeof setTimeout>|undefined;
    const stop=()=>{
      if(stopped)return;stopped=true;
      try{process.kill(-child.pid!,'SIGTERM');}catch{/* already exited */}
      killTimer=setTimeout(()=>{try{process.kill(-child.pid!,'SIGKILL');}catch{/* already exited */}},2000);killTimer.unref();
    };
    const timer=setTimeout(stop,options.timeout??180000);
    signal.addEventListener('abort',stop,{once:true});
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>4*1024*1024)stop();});
    child.stderr.on('data',chunk=>{stderr+=chunk;if(stderr.length>1024*1024)stop();});
    child.on('error',error=>{clearTimeout(timer);signal.removeEventListener('abort',stop);reject(error);});
    child.on('close',code=>{
      clearTimeout(timer);clearTimeout(killTimer);signal.removeEventListener('abort',stop);
      if(stopped)reject(Error(signal.aborted?'Worker lease lost':'Command timed out'));
      else if(code!==0){
        // CLI errors can contain expired OAuth tokens: classify in memory, never echo.
        const error=Error(/invalid_grant|refresh token|credential/i.test(stderr)?'DNS login expired; renew this computer’s authorization':`${command.split('/').at(-1)} failed (exit ${code})`);
        Object.assign(error,{retryable:/ETIMEDOUT|ECONNRESET|connection.*(?:closed|reset)|timed? out|TLS|502|503|504/i.test(stderr)});
        reject(error);
      }else resolve(stdout.trim());
    });
    child.stdin.on('error',()=>{});child.stdin.end(options.input);
  });
}

export async function writeArtifacts(workspace: string, registry: Registry) {
  validate(registry);
  const contents=[JSON.stringify(registry,null,2)+'\n',nginx(registry),origins(registry)];
  for(let i=0;i<artifacts.length;i++){
    const file=join(workspace,artifacts[i]);await mkdir(dirname(file),{recursive:true});await writeFile(file,contents[i]);
  }
}

/** Publish just the three generated files through an isolated index. No checkout,
 * branch, staging area or developer modification is changed. Never force-push. */
export async function publishArtifacts(args: {
  run: Command; workspace: string; baseSha: string; previousSha?: string; message: string;
  checkpoint: (sha: string)=>Promise<void>; assertLease: ()=>Promise<void>;
}): Promise<string> {
  const {run,workspace,baseSha,previousSha,checkpoint,assertLease}=args;
  const git=(...a:string[])=>run('git',a);
  await git('fetch','origin','main');
  if(previousSha){
    try{await git('merge-base','--is-ancestor',previousSha,'origin/main');return previousSha;}catch{/* commit was not published */}
  }
  const base=await git('rev-parse','origin/main');
  if(base!==baseSha){
    const changed=await git('diff','--name-only',baseSha,base,'--',...artifacts);
    if(changed)throw Error('Preview registry changed; reconcile without overwriting');
  }
  const env={...process.env,GIT_INDEX_FILE:join(workspace,'publish.index')};
  await run('git',['read-tree',base],{env});
  for(const file of artifacts){
    const blob=await run('git',['hash-object','-w','--stdin'],{input:await readFile(join(workspace,file),'utf8')});
    await run('git',['update-index','--add','--cacheinfo',`100644,${blob},${file}`],{env});
  }
  const tree=await run('git',['write-tree'],{env});
  if(tree===await git('rev-parse',`${base}^{tree}`))throw Error('No changed artifacts or deployment checkpoint');
  const sha=await run('git',['commit-tree',tree,'-p',base],{input:args.message+'\n'});
  await checkpoint(sha); // durable before push, including an unacknowledged push
  await assertLease();
  await git('push','origin',`${sha}:refs/heads/main`);
  return sha;
}
