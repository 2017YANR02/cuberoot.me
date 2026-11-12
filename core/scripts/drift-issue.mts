/** One durable issue per detector. Unchanged source versions produce no writes. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Issue = { number: number; body: string | null; state: string; pull_request?: unknown };
type Github = (path: string, method?: string, body?: unknown) => Promise<any>;
export function reportVersion(report: string) {
  const source = report.match(/<!-- drift-source ([a-f0-9]{64}) -->/);
  if (!source) throw new Error('Missing semantic source fingerprint; refusing to publish');
  return source[1];
}
export async function publishDrift(label: string, title: string, report: string, github: Github) {
  if (!['icons-drift', 'best2x2-drift', 'regulation-drift', 'sq1-pbl-drift'].includes(label)) throw new Error('Unknown drift detector');
  const hash = reportVersion(report);
  const marker = `<!-- drift-issue ${label} ${hash} -->`;
  const body = `${marker}\n${report.trim()}\n`;
  if (body.length > 60_000) throw new Error('Report exceeds issue limit; refusing truncation');
  const issues: Issue[] = [];
  for (let page = 1; ; page++) {
    const batch = await github(`/issues?state=all&labels=${label}&per_page=100&page=${page}&sort=updated&direction=desc`);
    if (!Array.isArray(batch)) throw new Error('Invalid issue listing');
    issues.push(...batch.filter((item: Issue) => !item.pull_request));
    if (batch.length < 100) break;
  }
  // Include closed issues and every comments page. A timeout or partial read
  // aborts before writing, rather than interpreting it as an empty history.
  const history: { issue: Issue; versions: string[] }[] = [];
  const versions = (body: string | null | undefined) => [...(body ?? '').matchAll(new RegExp(`<!-- drift-issue ${label} ([a-f0-9]{64}) -->`, 'g'))].map(match => match[1]);
  for (const issue of issues.sort((a, b) => b.number - a.number)) {
    const saved = versions(issue.body);
    for (let page = 1; ; page++) {
      const comments = await github(`/issues/${issue.number}/comments?per_page=100&page=${page}`);
      if (!Array.isArray(comments)) throw new Error('Invalid comment listing');
      for (const comment of comments) saved.push(...versions(comment.body));
      if (comments.length < 100) break;
    }
    history.push({ issue, versions: saved });
  }
  const managed = history.find(item => item.versions.length);
  if (managed?.versions.at(-1) === hash) return 'unchanged';
  const issue = managed?.issue ?? issues.find(item => item.state === 'open') ?? issues[0];
  if (issue) {
    // Reopen first: a failed comment write remains visible and can retry; a
    // successful write with a lost response is detected from history next run.
    if (issue.state === 'closed') await github(`/issues/${issue.number}`, 'PATCH', { state: 'open' });
    await github(`/issues/${issue.number}/comments`, 'POST', { body });
    return 'updated';
  }
  await github('/issues', 'POST', { title, body, labels: [label], assignees: ['2017YANR02'] });
  return 'created';
}
async function main() {
  const [label, title, path] = process.argv.slice(2);
  if (!label || !title || !path) throw new Error('Usage: drift-issue.mts LABEL TITLE REPORT');
  const repo = process.env.GITHUB_REPOSITORY ?? '2017YANR02/cuberoot.me';
  if (repo !== '2017YANR02/cuberoot.me') throw new Error('Unexpected repository');
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Missing GitHub token');
  const github: Github = async (path, method = 'GET', body) => {
    const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      method, signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`GitHub ${method} ${path}: HTTP ${response.status}`);
    return response.json();
  };
  console.log(await publishDrift(label, title, await readFile(path, 'utf8'), github));
}
export const sourceMarker = (value: unknown) => `<!-- drift-source ${createHash('sha256').update(JSON.stringify(value)).digest('hex')} -->`;
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
