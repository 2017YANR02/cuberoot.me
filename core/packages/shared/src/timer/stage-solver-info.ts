export interface StageSolverTableSize {
  name: string;
  bytes: number;
}

export const STAGE_SOLVER_INFO_TITLE = { zh: '求解器信息', en: 'Solver info' };

export function formatStageSolverBytes(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function summarizeStageSolverTables(tables: readonly StageSolverTableSize[]) {
  return {
    rows: [...tables].sort((left, right) => right.bytes - left.bytes),
    total: tables.reduce((sum, table) => sum + table.bytes, 0),
  };
}

function formatStageSolverTime(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

export function stageSolverInfoModel({ workers, totalMs, enumerationMs, tables, bundledCross }: {
  workers: number | null;
  totalMs?: number | null;
  enumerationMs?: number;
  tables: ReturnType<typeof summarizeStageSolverTables>;
  bundledCross?: boolean;
}, language: 'zh' | 'en') {
  const tr = (copy: { zh: string; en: string }) => copy[language];
  const entries = [{ key: 'engine', label: tr({ zh: '引擎', en: 'Engine' }),
    value: `Rust → WASM · ${tr({ zh: `${workers ?? '…'} 路并行`, en: `${workers ?? '…'}-way` })}` }];
  if (totalMs != null) entries.push({ key: 'grid', label: tr({ zh: '6 视角总耗时', en: '6-face total' }), value: formatStageSolverTime(totalMs) });
  if (enumerationMs != null) entries.push({ key: 'moves', label: tr({ zh: '当前解法枚举', en: 'This enumeration' }), value: formatStageSolverTime(enumerationMs) });
  const size = formatStageSolverBytes(tables.total);
  return {
    entries,
    tableHeading: tr({ zh: `剪枝表 ${tables.rows.length} 张 ≈ ${size}`, en: `Pruning tables: ${tables.rows.length} ≈ ${size}` }),
    perWorker: tr({ zh: '每路 worker 各装一份', en: 'one copy per worker' }),
    tableRows: tables.rows.map(table => ({ name: table.name, size: formatStageSolverBytes(table.bytes) })),
    note: bundledCross ? tr({
      zh: '基础十字剪枝表随小程序打包。其余预计算表按需下载，解压后装入 WASM。移动表现场生成。',
      en: 'The basic cross pruning table is bundled. Other precomputed tables are downloaded as needed and unpacked into WASM. Move tables are generated locally.',
    }) : tr({
      zh: '预计算的 BFS 剪枝表解压后装入 WASM。移动表在运行时生成。',
      en: 'Precomputed BFS pruning tables are unpacked into WASM. Move tables are generated locally.',
    }),
  };
}
