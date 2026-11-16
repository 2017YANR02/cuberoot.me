import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { JsonReader, ToolResult } from './site_assistant_tools.js';

const repo = '2017YANR02/cuberoot.me';
const github = `https://api.github.com/repos/${repo}`;
const workflowUrl = `https://github.com/${repo}/actions/workflows/stats.yml`;
const inventoryUrl = 'https://static.cuberoot.me/stats/.stats-data/current/_inventory.json';
const publicationUrl = 'https://static.cuberoot.me/stats/.stats-data/current/publication.json';
const historicalUrl = 'https://api.cuberoot.me/v1/wca/historical-ranks/meta';
const binaryMetaUrl = 'https://static.cuberoot.me/stats/nemesizer/meta.json';
const doubleUrl = 'https://next.cuberoot.me/data/double-zbll/manifest.json';
const iso = z.string().datetime({ offset: true });
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const runSchema = z.object({ id: z.number().int().positive(), run_attempt: z.number().int().positive(),
  event: z.enum(['schedule', 'workflow_dispatch']), head_branch: z.literal('main'),
  path: z.string().regex(/^\.github\/workflows\/stats\.yml(?:@.*)?$/),
  status: z.string().max(40), conclusion: z.string().max(40).nullable(),
  created_at: iso, run_started_at: iso.nullable(), head_sha: z.string().regex(/^[a-f0-9]{40}$/),
});
type Run = z.infer<typeof runSchema>;
const stepSchema = z.object({ name: z.string().max(200), status: z.string().max(40), conclusion: z.string().max(40).nullable(), completed_at: iso.nullable() });
const jobsSchema = z.object({ total_count: z.number().int().min(0).max(100), jobs: z.array(z.object({
  name: z.string().max(200), status: z.string().max(40), conclusion: z.string().max(40).nullable(), completed_at: iso.nullable(), steps: z.array(stepSchema).max(100),
})).max(100) });
type Job = z.infer<typeof jobsSchema>['jobs'][number];
const requiredSteps: Record<string, string[]> = {
  'wca-heavy': ['Compute all statistics', 'Publish latest statistics snapshot'],
  'wca-history': ['Build historical ranks snapshot', 'Build SOR over-time DAILY race JSON', 'Apply historical ranks on server', 'Publish latest statistics snapshot'],
};
const cache = new Map<string, { at: number; value: unknown }>();
const ttl = 15 * 60_000;

export function requestsStatisticsRuntime(question: string): boolean {
  return /最近|上次|当前.*(?:版本|发布)|最新|成功|失败|运行状态|跑完|完成了吗|\b(?:latest|last|current.*version|success\w*|fail\w*|run status|finished)\b/i.test(question);
}

/** Focus named-family status questions; broad inventories keep all families. */
export function statisticsRuntimePrefetchIds(question: string): Array<string | undefined> {
  if (/哪些|所有|全部|全站|这些|它们|其他|\b(?:all|which|these|other)\b/i.test(question)) return [undefined];
  const ids: string[] = [];
  if (/\bWCA\b|历史排名|SOR|纪录演化/i.test(question)) ids.push('wca-heavy', 'wca-history');
  if (/双底|double.?bottom|double.?zbll/i.test(question)) ids.push('double-zbll');
  if (/LSLL/i.test(question)) ids.push('lsll');
  if (/打乱|scramble/i.test(question)) ids.push('scramble');
  if (/全状态|精确分布|exact.*distribution/i.test(question)) ids.push('exact-distributions');
  if (/预计算表|剪枝表|距离表|pruning table/i.test(question)) ids.push('solver-tables');
  return ids.length && ids.length <= 3 ? ids : [undefined];
}

/** Preserve verified runtime facts when prose/JSON generation fails. Values come
 * only from the already validated observations, never a maintained answer text. */
export function statisticsRuntimeFactFallback(question: string, lang: 'zh' | 'en', results: ToolResult[]) {
  const sources=new Map(results.flatMap(result=>result.sources).filter(source=>source.read).map(source=>[source.id,source]));
  type Entry={sourceId?:string;kind?:string;displayTimes?:Record<string,string>;publishedDataVersion?:string;lastRun?:{status?:string;conclusion?:string;failedStage?:unknown};sourceDataCutoff?:string};
  const views=results.map(result=>result.evidence as {view?:string;entries?:Entry[];gaps?:Array<{scope:string;reason:string}>}).filter(view=>view?.view==='runtime');
  if(!views.length)return undefined;
  const entries=[...new Map(views.flatMap(view=>view.entries??[]).filter(entry=>entry.sourceId && sources.has(entry.sourceId)).map(entry=>[entry.sourceId!,entry])).values()];
  const zh=lang==='zh';
  const wantsRun=/运行|执行|失败|\b(?:runs?|execution|attempt|fail\w*)\b/i.test(question);
  const wantsSuccess=/最近(?:一次)?成功|上次成功|最后(?:一次)?成功|\b(?:last|latest)\s+(?:\w+\s+){0,2}success(?:ful)?\b/i.test(question);
  const wantsVersion=/版本|发布|\b(?:versions?|publish\w*|publication)\b/i.test(question);
  const wantsImport=/导入|数据库|\b(?:import\w*|database)\b/i.test(question);
  const rows=new Map<string,Set<string>>();
  const add=(text:string,id?:string)=>{const ids=rows.get(text)??new Set<string>();if(id&&sources.has(id))ids.add(id);rows.set(text,ids);};
  const time=(entry:Entry,key:string)=>entry.displayTimes?.[key];
  for(const entry of entries) {
    const id=entry.sourceId!;
    if(entry.kind==='last-run' && wantsRun && entry.lastRun) {
      const raw=entry.lastRun.conclusion??entry.lastRun.status??'unknown';
      const states:Record<string,string>={success:'成功',failure:'失败',in_progress:'运行中',queued:'排队中',cancelled:'已取消',timed_out:'超时',unknown:'未知'};
      let text=(zh?'最近运行：':'Latest run: ')+(zh?states[raw]??raw:raw);
      if(time(entry,'lastRun.startedAt'))text+=(zh?'；开始于 ':'; started ')+time(entry,'lastRun.startedAt');
      if(time(entry,'lastRun.finishedAt'))text+=(zh?'；结束于 ':'; finished ')+time(entry,'lastRun.finishedAt');
      const failed=entry.lastRun.failedStage;
      if(Array.isArray(failed)&&failed.length&&failed.every(value=>typeof value==='string'))text+=(zh?'；失败步骤：':'; failed steps: ')+failed.join('、');
      add(text,id);
    }
    if(entry.kind==='last-success' && wantsSuccess && time(entry,'lastSuccessAt'))add((zh?'最近已核实的成功计算及发布流程：':'Last verified successful computation-and-publication workflow: ')+time(entry,'lastSuccessAt'),id);
    if(entry.kind==='publication' && wantsVersion && typeof entry.publishedDataVersion==='string') {
      const corpus=id==='statistics-runtime:double-zbll-publication';
      let text=(zh?(corpus?'当前双底 ZBLL 题库版本：':'当前静态统计快照版本：'):(corpus?'Current double-ZBLL corpus version: ':'Current static statistics snapshot version: '))+entry.publishedDataVersion;
      const generated=time(entry,corpus?'generatedAt':'snapshotGeneratedAt');
      if(generated)text+=(zh?'；生成于 ':'; generated ')+generated;
      const receipt=entries.find(item=>item.kind==='publication-receipt'&&item.publishedDataVersion===entry.publishedDataVersion);
      if(receipt&&time(receipt,'lastPublishedAt'))text+=(zh?'；发布于 ':'; published ')+time(receipt,'lastPublishedAt');
      else text+=zh?'。生成时间不等于发布时间，精确发布时间暂无可核验回执。':'. Generation time is not publication time; no matching publication receipt is available.';
      add(text,id);if(receipt?.sourceId)add(text,receipt.sourceId);
    }
    if(entry.kind==='database-import' && wantsImport && time(entry,'lastImportedAt'))add((zh?'历史排名数据库最近导入：':'Historical ranking database last imported: ')+time(entry,'lastImportedAt')+(zh?'。这是独立的数据库导入时间，不代表整个工作流成功或静态快照发布。':'. This independent database import does not establish whole-workflow success or static publication.'),id);
    if(entry.kind==='source-cutoff' && /截点|截至|\bcutoff\b/i.test(question) && entry.sourceDataCutoff)add((zh?'已发布 WCA 二进制数据截点（不代表所有统计或 PG）：':'Published WCA binary cutoff (not all statistics or PG): ')+entry.sourceDataCutoff,id);
  }
  if(wantsRun&&!entries.some(entry=>entry.kind==='last-run')&&views.some(view=>view.gaps?.some(gap=>gap.scope==='wca-last-run')))add(zh?'最近运行：未取得完整、可核验的运行记录，无法确认。':'Latest run: complete verifiable run records are unavailable.');
  if(wantsSuccess&&!entries.some(entry=>entry.kind==='last-success')&&views.some(view=>view.gaps?.some(gap=>gap.scope.endsWith('-last-success'))))add(zh?'最近成功：当前有界历史记录未能确认，不能用数据库导入时间代替。':'Last success: not established by the bounded history; database import time is not a substitute.');
  if(wantsRun||wantsSuccess)for(const scope of new Set(views.flatMap(view=>view.gaps??[]).filter(gap=>gap.reason==='local_run_receipts_not_uploaded').map(gap=>gap.scope))) {
    const source=sources.get('statistics-metadata:'+scope.replace(/-local-runs$/,''));
    add((source?source.title+'：':'')+(zh?'最近本地运行及成功时间未知，当前未接入可核验的本地运行回执。':'Local run and success times are unknown; verifiable local run receipts are not connected.'),source?.id);
  }
  if(wantsImport && /相同|一样|\bsame\b/i.test(question)) {
    const imported=entries.find(entry=>entry.kind==='database-import');
    const other=entries.flatMap(entry=>entry.kind==='last-run'&&wantsRun?[time(entry,'lastRun.startedAt')]:entry.kind==='last-success'&&wantsSuccess?[time(entry,'lastSuccessAt')]:entry.kind==='publication'&&wantsVersion?[time(entry,'snapshotGeneratedAt')]:[]).filter(Boolean);
    if(imported&&time(imported,'lastImportedAt')&&other.length&&other.every(value=>value!==time(imported,'lastImportedAt')))add(zh?'数据库导入时间与上述已核实时间均不相同。':'The database import time differs from the verified times shown above.',imported.sourceId);
  }
  if(!rows.size)return undefined;
  const used=new Set([...rows.values()].flatMap(ids=>[...ids]));
  return {answer:(zh?'已核实的运行信息：':'Verified runtime information:')+'\n\n'+[...rows].map(([text,ids])=>text+([...ids].map(id=>' [['+id+']]').join(''))).join('\n\n'),sources:[...used].map(id=>sources.get(id)!),actions:[],artifacts:[]};
}

/** Public fixed endpoints only. Cache has explicit observation times; never serve
 * expired success as fresh after an outage. Tests inject a read without sharing cache. */
async function readObserved(url: string, read: JsonReader, now: () => number) {
  const old = process.env.VITEST ? undefined : cache.get(url);
  if (old && now() - old.at < ttl) return { ...old, cached: true };
  const value = await read(url), at = now();
  if (!process.env.VITEST) {
    if (cache.size >= 40) cache.delete(cache.keys().next().value!);
    cache.set(url, { at, value });
  }
  return { value, at, cached: false };
}

/** No log downloads, archives, SQL, local processes or user-selected URLs. */
export async function readStatisticsRuntime(call: { id?: string; scope?: 'all' }, lang: 'zh' | 'en', read: JsonReader, now = Date.now, timeZone = 'UTC'): Promise<ToolResult> {
  const allIds = ['wca-heavy', 'wca-history', 'scramble', 'exact-distributions', 'lsll', 'double-zbll', 'solver-tables'];
  const families = call.id ? allIds.filter(id => id === call.id) : allIds;
  if (!families.length) return { evidence: { notEvidence: true, error: 'metadata_missing', availableIds: allIds }, sources: [], artifacts: [], outcome: { state: 'empty', reason: 'metadata_missing' } };
  // Preserve raw instants and provide exact local presentation beside them.
  // Models must not do timezone arithmetic or relabel UTC dates as local dates.
  const options: Intl.DateTimeFormatOptions = { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset' };
  let formatter: Intl.DateTimeFormat;
  try { formatter = new Intl.DateTimeFormat('en-GB', options); }
  catch { formatter = new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }); }
  const displayTimeZone = formatter.resolvedOptions().timeZone;
  const displayTimes = (value: Record<string, unknown>, prefix = ''): Record<string, string> => Object.fromEntries(Object.entries(value).flatMap(([key, field]): Array<[string, string]> => {
    const path = prefix + key;
    if (typeof field === 'string' && iso.safeParse(field).success) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(field)).map(part => [part.type, part.value]));
      return [[path, parts.year+'-'+parts.month+'-'+parts.day+' '+parts.hour+':'+parts.minute+':'+parts.second+' '+parts.timeZoneName+' ('+displayTimeZone+')']];
    }
    return field && typeof field === 'object' && !Array.isArray(field) ? Object.entries(displayTimes(field as Record<string, unknown>, path+'.')) : [];
  }));
  const entries: Array<Record<string, unknown>> = [];
  const sources: ToolResult['sources'] = [];
  const gaps: Array<{ scope: string; reason: string }> = [];
  const add = (id: string, title: string, href: string, value: Record<string, unknown>, at: number) => {
    entries.push({ id, sourceId: id, ...value, displayTimes: displayTimes(value), observedAt: new Date(at).toISOString(), cacheMaxAgeSeconds: ttl / 1000 });
    sources.push({ id, title, href, read: true });
  };
  const attempt = async (scope: string, run: () => Promise<void>) => {
    try { await run(); } catch { gaps.push({ scope, reason: 'source_unavailable_or_invalid' }); }
  };
  const wca = families.filter(id => id in requiredSteps);
  if (wca.length) await attempt('wca-workflow', async () => {
    const fetchRuns = async (event: string, success: boolean) => {
      const result = await readObserved(`${github}/actions/workflows/stats.yml/runs?branch=main&event=${event}${success ? '&status=success' : ''}&per_page=10`, read, now);
      const list = z.object({ workflow_runs: z.array(z.unknown()).max(10) }).parse(result.value);
      return { at: result.at, runs: list.workflow_runs.flatMap(value => {
        // Ignore explicitly unrelated events, but malformed eligible records
        // invalidate this listing: skipping one could invent a "latest" result.
        if (value && typeof value === 'object' && 'event' in value && value.event !== event) return [];
        const run = runSchema.parse(value);
        return !success || run.conclusion === 'success' ? [run] : [];
      }) };
    };
    // Query events independently: a push-only syntax success cannot enter either list.
    const recent = await Promise.allSettled(['schedule', 'workflow_dispatch'].map(event => fetchRuns(event, false)));
    const success = await Promise.allSettled(['schedule', 'workflow_dispatch'].map(event => fetchRuns(event, true)));
    const runs = (results: typeof recent) => results.flatMap(result => result.status === 'fulfilled' ? result.value.runs : [])
      .sort((a, b) => (b.run_started_at ?? b.created_at).localeCompare(a.run_started_at ?? a.created_at));
    const observedAt = (results: typeof recent) => Math.min(...results.flatMap(result => result.status === 'fulfilled' ? [result.value.at] : []));
    const jobs = new Map<string, Promise<{ build: Job; at: number }>>();
    const job = (run: Run) => {
      const key = `${run.id}/${run.run_attempt}`;
      if (!jobs.has(key)) jobs.set(key, (async () => {
        const result = await readObserved(`${github}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`, read, now);
        const parsed = jobsSchema.parse(result.value);
        if (parsed.total_count !== parsed.jobs.length) throw new Error('Incomplete jobs');
        const build = parsed.jobs.find(job => job.name === 'build');
        if (!build) throw new Error('Missing build job');
        return { build, at: result.at };
      })());
      return jobs.get(key)!;
    };
    const runFields = (run: Run) => ({ runId: run.id, attempt: run.run_attempt, event: run.event, sourceCommit: run.head_sha, startedAt: run.run_started_at ?? 'unknown' });
    const latest = runs(recent)[0];
    // Incomplete event reads cannot prove which run was latest.
    if (latest && recent.every(r => r.status === 'fulfilled')) {
      let detail: { build: Job; at: number } | undefined;
      await attempt('wca-last-run-jobs', async () => { detail = await job(latest); });
      const build = detail?.build;
        add('statistics-runtime:wca-last-run', lang === 'zh' ? 'WCA 最近运行' : 'Latest WCA run', `https://github.com/${repo}/actions/runs/${latest.id}/attempts/${latest.run_attempt}`, {
          families: wca, kind: 'last-run', lastRun: { ...runFields(latest), status: latest.status, conclusion: latest.conclusion,
            finishedAt: build?.completed_at ?? 'unknown', failedStage: build ? build.steps.filter(step => step.conclusion === 'failure').map(step => step.name) : 'unknown',
            familySteps: Object.fromEntries(wca.map(id => [id, requiredSteps[id].map(name => ({ name, conclusion: build?.steps.find(step => step.name === name)?.conclusion ?? 'unknown' }))])),
          },
        }, Math.min(observedAt(recent), detail?.at ?? Infinity));
    } else gaps.push({ scope: 'wca-last-run', reason: 'no_verified_latest_run' });
    // Bound history reads. A workflow_dispatch of wca_stats_extra can succeed
    // while skipping the requested family; verify actual steps before accepting it.
    for (const family of wca) {
      let found = false, complete = success.every(r => r.status === 'fulfilled');
      if (complete) for (const candidate of runs(success).slice(0, 5)) {
        try {
          const { build, at } = await job(candidate);
          if (build.conclusion !== 'success' || !build.completed_at || !requiredSteps[family].every(name => build.steps.some(step => step.name === name && step.conclusion === 'success'))) continue;
          add(`statistics-runtime:${family}-last-success`, lang === 'zh' ? `${family} 最近成功流程` : `${family} last successful pipeline`, `https://github.com/${repo}/actions/runs/${candidate.id}/attempts/${candidate.run_attempt}`, {
            families: [family], kind: 'last-success', lastSuccessAt: build.completed_at, ...runFields(candidate),
            confirmedSteps: requiredSteps[family],
            scope: 'Successful computation-and-publication workflow, NOT merely a syntax/compilation check. stats_filter may restrict individual statistics; this is not proof every statistic was recomputed or that this version remains active.',
          }, Math.min(observedAt(success), at)); found = true; break;
        } catch { complete = false; break; }
      }
      if (!found) gaps.push({ scope: `${family}-last-success`, reason: complete ? 'not_found_in_bounded_history' : 'history_incomplete' });
    }
  });
  if (families.some(id => ['wca-heavy', 'wca-history', 'scramble'].includes(id))) await attempt('active-statistics-snapshot', async () => {
    const result = await readObserved(inventoryUrl, read, now);
    const file = z.object({ path: z.string().regex(/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/).refine(path => !path.split('/').some(p => !p || p === '.' || p === '..')), bytes: z.number().int().nonnegative(), sha256 });
    const inventory = z.object({ schema: z.literal(1), kind: z.literal('snapshot'), sourceCommit: z.string().regex(/^[a-f0-9]{40}$/), generatedAt: iso, files: z.array(file).min(1).max(20000) }).parse(result.value);
    if (new Set(inventory.files.map(f => f.path)).size !== inventory.files.length) throw new Error('Duplicate files');
    const digest = (files: typeof inventory.files) => createHash('sha256').update(JSON.stringify([...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0))).digest('hex');
    const inventoryVersion = digest(inventory.files);
    add('statistics-runtime:active-snapshot', lang === 'zh' ? '当前静态统计快照' : 'Active statistics snapshot', inventoryUrl, {
      families: families.filter(id => ['wca-heavy', 'wca-history', 'scramble'].includes(id)), kind: 'publication',
      publishedDataVersion: inventoryVersion, versionKind: 'active-file-inventory-sha256', fileCount: inventory.files.length,
      snapshotGeneratedAt: inventory.generatedAt, snapshotSourceCommit: inventory.sourceCommit,
      lastPublishedAt: 'unknown', sourceDataCutoff: 'unknown',
      scope: 'Currently served static snapshot containing multiple owners, including upcoming competitions. Its timestamp/commit may come from another owner. This is NOT an archive hash, WCA update time, database version, local run success or proof that all channels agree.',
    }, result.at);
    // Older publishers have no receipt. A race, missing receipt or mismatch must
    // leave time unknown while preserving the successfully read active inventory.
    await attempt('snapshot-publication-receipt', async () => {
      const receiptResult = await readObserved(publicationUrl, read, now);
      const receipt = z.object({ schema: z.literal(1), archiveSha256: sha256, inventoryVersion: sha256, publishedAt: iso,
        timestampBasis: z.literal('publication-finalized'), sourceCommit: z.string().regex(/^[a-f0-9]{40}$/) }).parse(receiptResult.value);
      if (receipt.inventoryVersion !== inventoryVersion || receipt.sourceCommit !== inventory.sourceCommit) throw new Error('Publication changed or receipt mismatched');
      add('statistics-runtime:publication-receipt', lang === 'zh' ? '当前快照发布回执' : 'Current snapshot publication receipt', publicationUrl, {
        families: families.filter(id => ['wca-heavy', 'wca-history', 'scramble'].includes(id)), kind: 'publication-receipt',
        lastPublishedAt: receipt.publishedAt, publishedDataVersion: receipt.inventoryVersion, archiveSha256: receipt.archiveSha256,
        timestampBasis: receipt.timestampBasis, scope: 'Finalization time for this exact shared snapshot, possibly confirmed by recovery. It does not establish per-family recomputation time or the database version.',
      }, receiptResult.at);
    });
  });
  if (families.includes('wca-history')) await attempt('historical-database', async () => {
    const result = await readObserved(historicalUrl, read, now);
    const meta = z.object({ lastImportedAt: iso.nullable() }).parse(result.value);
    add('statistics-runtime:historical-database', lang === 'zh' ? '历史排名数据库导入' : 'Historical ranking database import', historicalUrl, {
      families: ['wca-history'], kind: 'database-import', lastImportedAt: meta.lastImportedAt ?? 'unknown',
      scope: 'Historical ranking database import only. A later workflow step may fail; import time does not establish whole-pipeline success, static publication or source cutoff.',
    }, result.at);
  });
  if (wca.length) await attempt('published-wca-binary-cutoff', async () => {
    const result = await readObserved(binaryMetaUrl, read, now);
    const meta = z.object({ generatedAt: iso, exportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(result.value);
    add('statistics-runtime:wca-binary-cutoff', lang === 'zh' ? '已发布 WCA 二进制数据截点' : 'Published WCA binary data cutoff', binaryMetaUrl, {
      families: wca, kind: 'source-cutoff', sourceDataCutoff: meta.exportDate, generatedAt: meta.generatedAt,
      scope: 'Published search/Nemesizer binary dataset only; do not propagate this cutoff to all statistical tables or the independent PG import.',
    }, result.at);
  });
  if (families.includes('double-zbll')) await attempt('double-zbll-publication', async () => {
    const result = await readObserved(doubleUrl, read, now);
    const manifest = z.object({ schema: z.literal(1), version: z.string().regex(/^[a-f0-9]{16,64}$/), dataSha256: sha256, casesSha256: sha256, generatedAt: iso }).parse(result.value);
    add('statistics-runtime:double-zbll-publication', lang === 'zh' ? '线上双底 ZBLL 题库清单' : 'Published double-ZBLL manifest', doubleUrl, {
      families: ['double-zbll'], kind: 'publication', publishedDataVersion: manifest.version, dataSha256: manifest.dataSha256, casesSha256: manifest.casesSha256,
      generatedAt: manifest.generatedAt, lastPublishedAt: 'unknown',
      scope: 'Manifest currently served by the website. Generation time is not publication time. No local solver run/progress is implied; binary payloads were not downloaded.',
    }, result.at);
  });
  for (const family of families.filter(id => !id.startsWith('wca-'))) gaps.push({ scope: `${family}-local-runs`, reason: 'local_run_receipts_not_uploaded' });
  for (const family of families.filter(id => ['lsll', 'exact-distributions', 'solver-tables'].includes(id))) gaps.push({ scope: `${family}-publication`, reason: 'publication_status_not_connected' });
  return { evidence: { view: 'runtime', displayTimeZone, entries, returned: entries.length, requestedFamilies: families, gaps,
    historyCoverage: 'Latest 10 runs per schedule/dispatch event; last-success search checks at most 5 successful candidates. Push syntax checks are excluded. Unknown or missing receipts do not mean no run or no published data.',
    instruction: 'Cite runtime entry sourceIds for run/version claims, metadata IDs only for configuration. Keep last attempt, last successful pipeline, active static snapshot, PG import and corpus version separate. Preserve known fields when another source fails. Inventory generatedAt, manifest generatedAt and GitHub updated_at are NOT publication timestamps. Report unconnected local run/publication fields as unknown; do not infer CPU rankings from elapsed run time. For version questions include the full publishedDataVersion identifier; generation/import timestamps are never substitutes. Versions refer only to the channel and scope stated in each entry. Use the exact preformatted displayTimes for dates/times in displayTimeZone, identifying that zone. Do not recalculate from raw UTC instants or relabel UTC calendar dates as local dates. Raw timestamp fields remain the lossless source values. Explain gaps naturally without dumping internal reason codes; run IDs and raw internal field names are unnecessary unless requested. ObservedAt is when the source was read; reads may be cached for 15 minutes.',
  }, sources, artifacts: [], outcome: gaps.some(g => g.reason === 'source_unavailable_or_invalid') ? { state: 'partial', reason: 'runtime_source_unavailable' } : { state: 'success' } };
}
