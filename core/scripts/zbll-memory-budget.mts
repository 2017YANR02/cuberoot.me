/** Use the menu's verified anonymous-table accounting for the job guard too. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { memoryBudget } from './mac-memory-menu.mts';
import { parseProcesses } from './mac-system-recorder.mts';
const root = resolve(import.meta.dirname, '../..');
export function observeZbllMemory(owner: number, available: number, boot: string) {
  const command = (args: string[]) => execFileSync('/bin/ps', args, {encoding:'utf8',timeout:3000});
  const processes = parseProcesses(command(['-axo','pid,ppid,rss,pcpu,stat,comm']));
  if (!processes.some(p=>p.pid === owner)) throw Error('Incomplete process-tree observation');
  let lock: any = null, guardCommand = '', commands: Record<number,string> = {};
  try {
    lock = JSON.parse(readFileSync(resolve(root,'.tmp/cubeopt-reverse/compute.lock'),'utf8'));
    if (Number.isSafeInteger(lock.pid) && lock.pid > 0) {
      guardCommand = command(['-p',String(lock.pid),'-o','command=']);
      const pids = processes.filter(p=>p.name === 'cube48opt-research' || p.name === 'time').map(p=>p.pid);
      if (pids.length && pids.length <= 8) {
        commands = Object.fromEntries(command(['-p',pids.join(','),'-o','pid=,command=']).split('\n').flatMap(line=>{
          const m = /^\s*(\d+)\s+(.+)$/.exec(line); return m ? [[Number(m[1]),m[2]]] : [];
        }));
      }
    }
  } catch { /* Missing/unconfirmed identity retains the conservative reservation. */ }
  return memoryBudget(processes,owner,available,lock,boot,guardCommand,{commands});
}
