import catalog from '../generated/statistics-metadata.json' with { type: 'json' };
import type { ToolResult } from './site_assistant_tools.js';

/** Result queries and maintenance queries have different evidence contracts. */
export function requestsStatisticsMetadata(question: string): boolean {
  const subject = /统计|榜单|排名榜|平均榜|题库|预计算表|剪枝表|距离表|全状态|精确分布|LSLL|ZBLL|\b(?:statistics?|stats|rankings?|leaderboards?|corpus|precomputed|pruning tables?|distance tables?|distributions?)\b/i.test(question);
  const maintenance = /运行|执行状态|最近.{0,8}(?:成功|失败)|(?:当前|最新|线上).{0,8}版本|计算量|计算成本|耗时|耗内存|耗\s*(?:CPU|算力)|最耗|重计算|离线|生成|更新|刷新|全量|增量|续算|发布|上线|打开页面.*计算|\b(?:cost|expensive|CPU|memory|offline|generat\w*|updat\w*|refresh\w*|incremental|recomput\w*|publish\w*|pipeline|runs?)\b/i.test(question);
  return subject && maintenance;
}

/** History resolves a referent only; the current request still reads fresh metadata. */
export function statisticsMetadataFollowUp(question: string, previousQuestion: string): string {
  return requestsStatisticsMetadata(previousQuestion)
    && /^(?:那|这些|它们|它|这个|该|所以|最近|上次|当前版本|\s*(?:so\b|these\b|those\b|they\b|does it\b|do they\b|are these\b))/i.test(question)
    && requestsStatisticsMetadata('统计 ' + question) ? '统计 ' + question : question;
}

export function assistantPageAudience(question: string): 'user' | 'developer' {
  return requestsStatisticsMetadata(question) || /实现原理|如何实现|技术实现|数据管道|离线计算|计算成本|生成流程|更新机制|\b(?:implementation|pipeline|offline computation)\b/i.test(question) ? 'developer' : 'user';
}

/** Bundled small metadata only: no network, SQL, filesystem, commands or tables. */
export function readStatisticsMetadata(call: { id?: string; scope?: 'all' }, lang: 'zh' | 'en'): ToolResult {
  const selected = catalog.entries.filter(entry => !call.id || entry.id === call.id);
  const entries = selected.map(entry => {
    const { artifacts, sources, ...summary } = entry;
    return { ...summary, name: entry.name[lang], sourceId: `statistics-metadata:${entry.id}`,
      artifactIds: artifacts.map(artifact => artifact.id),
      // Full artifact contracts/provenance are available on a focused read.
      ...(call.id ? { artifacts, provenance: catalog.provenance.filter(source => sources.includes(source.path)) } : {}),
    };
  });
  return {
    evidence: {
      version: catalog.version, versionKind: 'source-content-sha256', coverage: catalog.coverage,
      total: catalog.entries.length, returned: entries.length, completeRegisteredCatalog: !call.id,
      entries, runtime: { status: 'not_loaded', view: 'runtime', instruction: 'Request runtime view only for actual run or published-version questions.' },
      instruction: 'Maintenance configuration snapshot bundled with this API, not live execution evidence. A configured schedule is not proof of success; success is not proof of publication. This configuration view does not load runtime status; use statistics_metadata view runtime for Actions, active snapshot and published corpus evidence. Local runs without uploaded receipts remain unknown. Never rank CPU costs from memory classifications or state counts. Inventory: cover registered families, distinguish solver-table dependencies and conditionally expensive exact enumeration; do NOT describe all seven as proven heavy statistics. Explicitly separate double-ZBLL heavy upstream solving from cheap summary refresh. For a focused question use only relevant families, not the entire catalog. Preserve verified families when another source fails. Cite each supported bullet/sentence with its entry sourceId, not a citation dump at the end; use pages for UI operation claims. Source links on main may advance; version identifies the bundled source content. Full contracts/provenance are available by id.',
      ...(!selected.length ? { notEvidence: true, error: 'metadata_missing', availableIds: catalog.entries.map(entry => entry.id) } : {}),
    },
    sources: entries.map(entry => ({ id: entry.sourceId, title: entry.name,
      href: 'https://github.com/2017YANR02/cuberoot.me/blob/main/core/apps/api/src/generated/statistics-metadata.json', read: true })),
    artifacts: [], outcome: selected.length ? { state: 'success' } : { state: 'empty', reason: 'metadata_missing' },
  };
}
