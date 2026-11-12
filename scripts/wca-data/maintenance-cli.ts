import { REPO, check, readReleaseBody, renderReleaseBody } from './common.ts';
import { api, endpoint, gh, release } from './github.ts';
import { cleanupPlan, type ReleaseAsset } from './maintenance.ts';

const apply = process.argv.includes('--apply');
if (apply) check(process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_WORKFLOW === 'Maintain WCA data Release', 'Apply through the serialized Release maintenance workflow');

function assets(id: number): ReleaseAsset[] {
  return JSON.parse(gh(['api', `${endpoint}/${id}/assets?per_page=100`, '--paginate', '--slurp'])).flat();
}
function publicationBusy(): boolean {
  // Include approvals and the concurrency queue, not only running jobs.
  return ['queued', 'in_progress', 'waiting', 'pending', 'requested'].some(status => {
    const result = api(`repos/${REPO}/actions/workflows/wca_data_release.yml/runs?event=workflow_dispatch&status=${status}&per_page=1`);
    check(Number.isSafeInteger(result.total_count), 'Cannot determine pending publications');
    return result.total_count > 0;
  });
}

function maintain() {
  if (publicationBusy()) { console.log('Publication pending: defer cleanup and notes until the next maintenance run.'); return; }
  const r = release(); check(!r.draft, 'Refusing maintenance of a draft Release');
  const plan = cleanupPlan(r.body, assets(r.id));
  console.log(JSON.stringify({ apply, remove: plan.map(a => ({ name: a.name, bytes: a.size })), retainedDays: 7 }, null, 2));
  if (!apply) return;
  // All publishers and maintenance share deploy-core-production. Re-read as an
  // additional guard against a manual edit or a newly queued publication.
  for (const asset of plan) {
    if (publicationBusy()) { console.log('Publication queued: stop cleanup.'); return; }
    const latest = release(); check(latest.id === r.id, 'Release changed during cleanup');
    const eligible = cleanupPlan(latest.body, assets(latest.id));
    if (!eligible.some(a => a.id === asset.id && a.name === asset.name)) continue;
    gh(['api', `${endpoint}/assets/${asset.id}`, '--method', 'DELETE']);
    console.log(`Deleted ${asset.name}`);
  }
  if (publicationBusy()) { console.log('Publication queued: defer notes refresh.'); return; }
  const latest = release(), body = renderReleaseBody(readReleaseBody(latest.body));
  if (latest.body !== body) api(`${endpoint}/${latest.id}`, { body });
  check(release().body === body, 'Release notes verification failed');
  console.log('Release notes and current data verified.');
}
maintain();
