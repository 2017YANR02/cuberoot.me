/** @module Summarize download_click JSON log lines from stdin, without loading the log into memory. */
import { createInterface } from 'node:readline';

const counts = new Map<string, number>();
for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  let entry: Record<string, unknown>;
  try { entry = JSON.parse(line); }
  catch { continue; }
  if (!entry || entry.event !== 'download_click' || !['android', 'windows'].includes(entry.platform as string)
    || !['play', 'apk', 'windows-installer', 'windows-portable'].includes(entry.channel as string)
    || !['zh', 'en'].includes(entry.language as string)
    || typeof entry.time !== 'string' || !Number.isFinite(Date.parse(entry.time))) continue;
  const date = new Date(entry.time).toISOString().slice(0, 10);
  const key = `${date}\t${entry.channel}\t${entry.language}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}
console.log('date_utc\tchannel\tlanguage\tclicks');
for (const [key, count] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`${key}\t${count}`);
}
