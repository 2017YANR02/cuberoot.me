import type { ReconSnapshot, ReconTestRow } from '@cuberoot/shared/recon-ground-truth';

/** Revision-bound identity shared by the catalog, test title and capture file. */
export function intakeRegressionId(item: { id: string; revision: number }): string {
  if (!/^[0-9a-f-]{36}$/.test(item.id) || !Number.isSafeInteger(item.revision) || item.revision < 1) {
    throw new Error('Invalid intake regression identity');
  }
  return `intake-${item.id}-v${item.revision}`;
}

/** Report projection only; the regression still compares the full lossless snapshot. */
export function intakeRegressionRows(snapshot: ReconSnapshot): ReconTestRow[] {
  return [
    { moves: snapshot.inspection, label: '// inspection', colors: [], hrefs: [], diagrams: [] },
    ...snapshot.lines.map(line => ({ moves: line.moves.join(' '),
      label: `// ${line.label ?? line.kind} [${line.fromIdx + 1}–${line.toIdx + 1}]`,
      colors: [], hrefs: [], diagrams: [] })),
  ];
}
