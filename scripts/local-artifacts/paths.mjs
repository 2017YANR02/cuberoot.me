import {readFileSync} from 'node:fs';
import {dirname, resolve, relative, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const {mappings}=JSON.parse(readFileSync(resolve(root,'docs/local-artifact-paths.json'),'utf8'));
/** Resolve only registered moves. Historical evidence bytes and hashes stay unchanged. */
export function relocatedArtifactPath(recorded, repositoryRoot=root) {
 if(typeof recorded!=='string')throw Error('Missing recorded artifact path');
 let path=recorded.replaceAll('\\','/');
 if(path.split('/').includes('..'))throw Error('Recorded artifact contains parent traversal');
 for(const prefix of [repositoryRoot+'/','/Users/eula/Developer/cuberoot.me/','/Users/cuberoot/Developer/cuberoot.me/'])
  if(path.startsWith(prefix)){path=path.slice(prefix.length);break;}
 for(const {from,to} of mappings)if(path===from||path.startsWith(from+'/'))return resolve(repositoryRoot,to+path.slice(from.length));
 const result=resolve(repositoryRoot,path),rel=relative(repositoryRoot,result);
 if(!rel||rel.startsWith('../')||isAbsolute(rel))throw Error('Recorded artifact escapes the repository');
 return result;
}
