import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

export const artifacts=['ops/dev-preview/machines.json','ops/nginx/dev-machines.conf','core/packages/shared/src/dev-preview.ts'];
// Never reset, discard work or run stale application code after a fast-forward.
// Only a recorded publication checkpoint may remain ahead for publish() to resume.
export function syncCheckout(root:string,state:string,id:string):boolean {
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:1024*1024}).trim();
  const dirty=git('status','--porcelain');
  if(dirty){
    const paths=execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).split('\n').filter(Boolean).map(line=>line.slice(3));
    if(paths.some(path=>!artifacts.includes(path)))throw Error('Unexpected changed files in provisioning checkout');
    return false;
  }
  git('fetch','origin','main');
  const head=git('rev-parse','HEAD');
  if(git('rev-list','--count','origin/main..HEAD')!=='0'){
    const checkpoints=['http','https'].map(phase=>join(state,`${id}-${phase}.sha`));
    const recorded=checkpoints.some(file=>existsSync(file)&&readFileSync(file,'utf8').trim()===head);
    if(!recorded)throw Error('Provisioning checkout history conflicts with origin/main; preserve and repair the dedicated checkout');
    const paths=git('diff-tree','--no-commit-id','--name-only','-r',head).split('\n').filter(Boolean);
    if(paths.some(path=>!artifacts.includes(path)))throw Error('Unpublished checkpoint contains unexpected files');
    return false;
  }
  git('merge','--ff-only','origin/main');
  return head!==git('rev-parse','HEAD');
}
