/** Advisory only: consume Vitest's own inventory; never discover or execute tests here.
 * Keep full CI execution until shadow reports establish that selection is safe.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { resolveWorkspacePath } from '../resolve-workspace-path.mjs';

const CORE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REPO_ROOT = resolve(CORE_ROOT, '..');
const CLIENT = `core/${resolveWorkspacePath('@cuberoot/client', CORE_ROOT)}/`;

// Business ownership, not a substitute for an import graph. Unknown tests stay in
// the always-selected common group, including repository/file-reading guards.
const GROUPS = {
  alg: { names: /^(alg|f2l|oll|pll|zbll|zbls|sq1_pbl)(?:[-_]|[A-Z]|$)/, routes: ['alg', 'recognize'] },
  timer: { names: /^(timer|trainer|cross_trainer|stage_training|stackmat|bluetooth|smart_cube)(?:[-_]|[A-Z]|$)/, routes: ['timer', 'train', 'battle'] },
  recon: { names: /^(recon|analyzer)(?:[-_]|[A-Z]|$)/, routes: ['recon'] },
  account: { names: /^(account|auth|identity|wca_identity|wca_auth|google_membership|membership|login|session)(?:[-_]|[A-Z]|$)/, routes: ['account', 'auth', 'login'] },
  stats: { names: /^(stats|wca|comp|competition|person|record|rank)(?:[-_]|[A-Z]|$)/, routes: ['wca', 'comp'] },
  tutorial: { names: /^(tutorial|teaching|lesson|course)(?:[-_]|[A-Z]|$)/, routes: ['tutorial', 'courses', 'learn'] },
} as const;

type BusinessGroup = keyof typeof GROUPS;
export type TestGroup = BusinessGroup | 'common';
export type ChangedFile = { path: string; status: string };
export type TestPlan = {
  version: 1;
  mode: 'shadow';
  full: boolean;
  base: string | null;
  head: string;
  reasons: string[];
  groups: Record<TestGroup, { selected: boolean; tests: string[] }>;
  selectedTests: string[];
  deferredTests: string[];
};

function repoPath(path: string): string {
  return (isAbsolute(path) ? relative(REPO_ROOT, path) : path).replaceAll('\\', '/').replace(/^\.\//, '');
}

export function testGroup(path: string): TestGroup {
  const name = basename(path).replace(/\.test\.[^.]+$/, '');
  return (Object.entries(GROUPS).find(([, rule]) => rule.names.test(name))?.[0] as BusinessGroup) ?? 'common';
}

function sourceGroup(path: string): BusinessGroup | null {
  if (!path.startsWith(CLIENT)) return null;
  const local = path.slice(CLIENT.length);
  if (/^(tests|lib)\/.*\.test\.[^.]+$/.test(local)) {
    const group = testGroup(path);
    return group === 'common' ? null : group;
  }
  for (const [group, rule] of Object.entries(GROUPS)) {
    if (rule.routes.some(route => local.startsWith(`app/[lang]/${route}/`))) return group as BusinessGroup;
  }
  if (!/^(components|hooks|lib)\//.test(local)) return null;
  const name = basename(local).replace(/^use(?=[A-Z])/, '').replace(/^[A-Z]/, char => char.toLowerCase());
  return (Object.entries(GROUPS).find(([, rule]) => rule.names.test(name))?.[0] as BusinessGroup) ?? null;
}

export function planClientTests(options: {
  changes: ChangedFile[] | null;
  tests: string[];
  base?: string | null;
  head?: string;
  fullReason?: string;
}): TestPlan {
  const selected = new Set<TestGroup>(['common']);
  const reasons = ['Common and unclassified tests remain selected (including implicit file dependencies).'];
  let full = !!options.fullReason || options.changes === null || options.changes.length === 0;
  if (options.fullReason) reasons.push(options.fullReason);
  else if (!options.changes?.length) reasons.push('No trustworthy changed-file range: select the complete inventory.');
  for (const change of options.changes ?? []) {
    const path = repoPath(change.path);
    // Additions/deletions/renames can change routing, discovery, and file-reading
    // contracts without any static import. Do not infer that they are isolated.
    const group = sourceGroup(path);
    if (change.status !== 'M' || !group) {
      full = true;
      reasons.push(`${change.status} ${path}: structural, shared, configuration, or unclassified change; select all.`);
    } else {
      selected.add(group);
      reasons.push(`${path}: ${group}.`);
    }
  }
  const groups = Object.fromEntries([...Object.keys(GROUPS), 'common'].map(group => [
    group, { selected: full || selected.has(group as TestGroup), tests: [] as string[] },
  ])) as TestPlan['groups'];
  const tests = [...new Set(options.tests.map(repoPath))].sort();
  for (const test of tests) groups[testGroup(test)].tests.push(test);
  return {
    version: 1, mode: 'shadow', full, base: options.base ?? null, head: options.head ?? 'HEAD', reasons, groups,
    selectedTests: tests.filter(test => groups[testGroup(test)].selected),
    deferredTests: tests.filter(test => !groups[testGroup(test)].selected),
  };
}

/** --no-renames emits both deleted and added names, preserving both sides. */
export function parseGitChanges(output: string): ChangedFile[] {
  const fields = output.split('\0');
  if (fields.at(-1) === '') fields.pop();
  if (fields.length % 2) throw new Error('Malformed git name-status output');
  const changes: ChangedFile[] = [];
  for (let index = 0; index < fields.length; index += 2) {
    if (!/^[ACDMRTUXB]$/.test(fields[index]) || !fields[index + 1]) throw new Error('Malformed changed-file entry');
    changes.push({ status: fields[index], path: fields[index + 1] });
  }
  return changes;
}

type VitestReport = { testResults: { name: string; status: string; assertionResults?: { status: string }[] }[] };

/** Shards must have planned the same commit, baseline and inventory. */
export function compatiblePlans(plans: TestPlan[], expectedHead?: string): TestPlan {
  if (!plans.length) throw new Error('Missing shadow plans');
  const signature = (plan: TestPlan) => {
    if (plan.version !== 1 || plan.mode !== 'shadow' || !Array.isArray(plan.selectedTests) || !Array.isArray(plan.deferredTests)) throw new Error('Invalid shadow plan');
    if (expectedHead && plan.head !== expectedHead) throw new Error(`Shadow plan head ${plan.head} does not match ${expectedHead}`);
    return JSON.stringify([plan.base, plan.head, plan.full, [...plan.selectedTests].sort(), [...plan.deferredTests].sort()]);
  };
  const first = signature(plans[0]);
  if (plans.some(plan => signature(plan) !== first)) throw new Error('Shard plans disagree on commit, baseline, inventory or selection');
  return plans[0];
}

export function comparePlan(plan: TestPlan, report: VitestReport) {
  if (plan.version !== 1 || plan.mode !== 'shadow' || !Array.isArray(report.testResults)) throw new Error('Invalid shadow report');
  const selected = new Set(plan.selectedTests);
  const inventory = new Set([...plan.selectedTests, ...plan.deferredTests]);
  const reported = new Set(report.testResults.map(test => repoPath(test.name)));
  const failed = report.testResults.filter(test => test.status === 'failed' || test.assertionResults?.some(result => result.status === 'failed')).map(test => repoPath(test.name));
  return {
    failedTests: failed,
    missedFailures: failed.filter(test => !selected.has(test)),
    missingResults: [...inventory].filter(test => !reported.has(test)),
    unexpectedResults: [...reported].filter(test => !inventory.has(test)),
  };
}

function save(path: string, data: unknown) {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function summary(text: string) {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}

function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    base: { type: 'string' }, head: { type: 'string', default: 'HEAD' }, tests: { type: 'string' },
    output: { type: 'string' }, full: { type: 'boolean' }, plan: { type: 'string', multiple: true },
    results: { type: 'string', multiple: true }, partial: { type: 'boolean' },
  } });
  if (positionals[0] === 'plan') {
    if (!values.tests || !values.output) throw new Error('plan requires --tests <Vitest list JSON> --output <plan JSON>');
    const inventory: { file: string }[] = JSON.parse(readFileSync(values.tests, 'utf8'));
    if (!Array.isArray(inventory) || inventory.length === 0 || inventory.some(entry => typeof entry.file !== 'string')) throw new Error('Empty or invalid Vitest inventory');
    let changes: ChangedFile[] | null = null;
    let fullReason = values.full ? 'Scheduled or explicitly requested complete check.' : undefined;
    if (values.base && !values.full) {
      try {
        changes = parseGitChanges(execFileSync('git', ['diff', '--no-renames', '--name-status', '-z', values.base, values.head, '--'], { cwd: REPO_ROOT, encoding: 'utf8' }));
      } catch {
        fullReason = 'The comparison base is unavailable; select the complete inventory.';
      }
    }
    const plan = planClientTests({ changes, tests: inventory.map(entry => entry.file), base: values.base, head: values.head, fullReason });
    save(values.output, plan);
    summary(`### Client test selection (shadow only)\n\nActual CI still runs the complete suite. Would select **${plan.selectedTests.length}** / **${inventory.length}** files.\n\n| Group | Would run | Files |\n| --- | --- | --- |\n${Object.entries(plan.groups).map(([group, data]) => `| ${group} | ${data.selected ? 'yes' : 'no'} | ${data.tests.length} |`).join('\n')}\n\n${plan.reasons.map(reason => `- ${reason.replaceAll('|', '\\|')}`).join('\n')}`);
  } else if (positionals[0] === 'compare') {
    if (!values.plan?.length || !values.results?.length) throw new Error('compare requires --plan <plan JSON> --results <Vitest JSON report> (repeat both for shards)');
    const reports = values.results.map(path => JSON.parse(readFileSync(path, 'utf8')) as VitestReport);
    if (reports.some(report => !Array.isArray(report.testResults) || report.testResults.length === 0)) throw new Error('Missing Vitest result inventory');
    const plan = compatiblePlans(values.plan.map(path => JSON.parse(readFileSync(path, 'utf8'))), values.head === 'HEAD' ? undefined : values.head);
    const comparison = comparePlan(plan, { testResults: reports.flatMap(report => report.testResults) });
    if (values.output) save(values.output, comparison);
    summary(`### Client shadow selection comparison${values.partial ? ' (partial shard)' : ''}\n\n${values.partial ? 'This shard alone does not prove complete-suite coverage. ' : ''}Observed failing files: ${comparison.failedTests.length}; failures selection would miss: ${comparison.missedFailures.length}; ${values.partial ? 'files awaiting other shards' : 'missing results'}: ${comparison.missingResults.length}; unexpected results: ${comparison.unexpectedResults.length}.\n\n${comparison.missedFailures.map(path => `- Missed failure: \`${path}\``).join('\n')}`);
    if (comparison.missedFailures.length || (!values.partial && comparison.missingResults.length) || comparison.unexpectedResults.length) process.exitCode = 1;
  } else throw new Error('Usage: client-test-plan.ts plan|compare [options]');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
