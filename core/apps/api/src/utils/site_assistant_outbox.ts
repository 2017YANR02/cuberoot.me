import { mkdir, open, readdir, readFile, rename, unlink, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { QueryRunner } from '../db/connection.js';

export const assistantOutboxDirectory = () => process.env.SITE_ASSISTANT_OUTBOX_DIR || join(homedir(), '.local/state/cuberoot/assistant-outbox');
export interface AssistantCompletion { id: string; createdAt: string; params: unknown[] }
const update = `UPDATE site_assistant_requests SET status=?,error_code=?,finished_at=?,duration_ms=?,first_answer_ms=?,answer=?,response=?,metrics=?
  WHERE id=? AND status IN ('running','interrupted')`;
export async function applyAssistantCompletion(item: AssistantCompletion, run: QueryRunner) {
  // Replay only updates existing records: deletion of an account cannot resurrect its chats.
  const params = [...item.params];
  if (Date.now() - Date.parse(item.createdAt) > 30 * 86400_000) { params[5] = null; params[6] = null; }
  await run(update, params);
}
export async function saveAssistantCompletion(item: AssistantCompletion, directory = assistantOutboxDirectory()) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const files = (await readdir(directory)).filter(name => name.endsWith('.json'));
  if (files.length >= 256 && !files.includes(`${item.id}.json`)) throw new Error('Assistant outbox capacity reached');
  const data = JSON.stringify(item);
  if (Buffer.byteLength(data) > 256_000) throw new Error('Assistant completion exceeds budget');
  const destination = join(directory, `${item.id}.json`), temporary = destination + '.tmp';
  const file = await open(temporary, 'w', 0o600);
  try { await file.writeFile(data); await file.sync(); } finally { await file.close(); }
  await rename(temporary, destination);
  const dir = await open(directory, 'r');
  try { await dir.sync(); } finally { await dir.close(); }
  return destination;
}
export async function replayAssistantCompletions(run: QueryRunner, directory = assistantOutboxDirectory()) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const names = await readdir(directory);
  for (const name of names.filter(name=>/^[a-f0-9-]{36}\.(?:json|fault)\.tmp$/.test(name))) {
    const path=join(directory,name);
    try { if(Date.now()-(await stat(path)).mtimeMs>300_000) await unlink(path); } catch(error) { if((error as NodeJS.ErrnoException).code!=='ENOENT') throw error; }
  }
  const files = names.filter(name => /^[a-f0-9-]{36}\.json$/.test(name));
  // Scrub every expired journal entry before any DB call, even during a prolonged outage.
  for (const name of files) {
    const path=join(directory,name);
    try {
      const item=JSON.parse(await readFile(path,'utf8')) as AssistantCompletion;
      if (Array.isArray(item.params) && Date.now()-Date.parse(item.createdAt)>30*86400_000 && (item.params[5]!=null || item.params[6]!=null)) {
        item.params[5]=null;item.params[6]=null;await saveAssistantCompletion(item,directory);
      }
    } catch(error) { if((error as NodeJS.ErrnoException).code!=='ENOENT') throw error; }
  }
  for (const name of files.slice(0, 100)) {
    const path = join(directory, name);
    try {
      const info = await stat(path);
      if (info.size > 256_000) throw new Error('Invalid outbox entry');
      const item = JSON.parse(await readFile(path, 'utf8')) as AssistantCompletion;
      if (!Array.isArray(item.params) || item.params.length !== 9 || item.id + '.json' !== name || item.params[8] !== item.id || !Number.isFinite(Date.parse(item.createdAt))) throw new Error('Invalid outbox entry');
      await applyAssistantCompletion(item, run);
      await unlink(path);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return (await readdir(directory)).filter(name => name.endsWith('.json')).length;
}
export async function removeAssistantCompletion(path: string) { await unlink(path).catch(error => { if (error.code !== 'ENOENT') throw error; }); }

// One small, atomic counter file per process: no prompt text and no per-error file flood.
// Replaying the absolute count is idempotent even if a reload occurs after DB commit.
export async function replayAssistantFaults(run: QueryRunner, directory = assistantOutboxDirectory()) {
  const files = (await readdir(directory)).filter(name => /^[a-f0-9-]{36}\.fault$/.test(name));
  for (const name of files) {
    const path = join(directory, name);
    const item = JSON.parse(await readFile(path, 'utf8')) as { id: string; failures: number; at: string };
    if (item.id + '.fault' !== name || !Number.isSafeInteger(item.failures) || item.failures < 1 || !Number.isFinite(Date.parse(item.at))) throw new Error('Invalid fault counter');
    await run(`INSERT INTO site_assistant_recording_faults(id,failures,last_at) VALUES (?,?,?)
      ON CONFLICT(id) DO UPDATE SET failures=GREATEST(site_assistant_recording_faults.failures,EXCLUDED.failures),last_at=GREATEST(site_assistant_recording_faults.last_at,EXCLUDED.last_at)`, [item.id,item.failures,item.at]);
    // Live processes can recreate their absolute counter; stale files need not remain on disk.
    if (Date.now()-Date.parse(item.at)>86400_000) await unlink(path).catch(error=>{if(error.code!=='ENOENT')throw error;});
  }
  await run(`UPDATE site_assistant_monitor_state SET failed_writes=(SELECT COALESCE(SUM(failures),0) FROM site_assistant_recording_faults),last_failure_at=(SELECT MAX(last_at) FROM site_assistant_recording_faults),last_replay_at=NOW() WHERE id=TRUE`);
}
