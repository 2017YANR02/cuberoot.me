// Deployment-host preflight, executed before migrations. No credentials are read.
// Alinux 3 PostgreSQL 13 has no packaged pgvector; build the pinned official source.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const run=(file,args,options={})=>execFileSync(file,args,{stdio:'inherit',...options});
const output=(file,args)=>execFileSync(file,args,{encoding:'utf8'}).trim();
const psql=['-u','postgres','--','psql','-X','-v','ON_ERROR_STOP=1','-d','cuberoot_db'];
if(output('runuser',[...psql,'-Atc',"SELECT count(*) FROM pg_available_extensions WHERE name='vector'"])==='0') {
  if(!readFileSync('/etc/os-release','utf8').includes('ID="alinux"')) throw new Error('Unsupported extension provision host');
  const configPaths=['/usr/bin/pg_server_config','/usr/bin/pg_config'];
  if(!configPaths.some(existsSync)) run('dnf',['-y','install','postgresql-server-devel']);
  const pgConfig=configPaths.find(existsSync);
  if(!pgConfig) throw new Error('PostgreSQL development configuration is missing');
  const version=output(pgConfig,['--version']);
  if(!/^PostgreSQL 13\./.test(version)) throw new Error('PostgreSQL build/server version mismatch');
  const root=mkdtempSync(join(tmpdir(),'cuberoot-pgvector-'));
  run('git',['clone','--depth','1','--branch','v0.8.7','https://github.com/pgvector/pgvector.git',root]);
  const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  if(revision!=='f37c13f68b57d2c3472b2214fbcff699d6d34876') throw new Error('pgvector source revision mismatch');
  run('make',['-j1',`PG_CONFIG=${pgConfig}`,'OPTFLAGS='],{cwd:root});
  run('make',['install',`PG_CONFIG=${pgConfig}`],{cwd:root});
}
// Isolated acceptance installs the files first, then enables the extension only
// inside its disposable database. Production activation stays in deployment.
if (!process.argv.includes('--install-only')) run('runuser',[...psql,'-c','CREATE EXTENSION IF NOT EXISTS vector']);
