'use client';

import { AlgEditorPrefix } from '@/components/AlgEditorProjectedInput';
import { AlgFormulaReadRow } from '@/components/AlgFormulaRow';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AlgCase, AlgEntry } from '@cuberoot/shared/alg';
import { tr } from '@/i18n/tr';
import { displayCaseAlg } from '@/lib/alg_display';
import { groupF2lSolutions, type F2lGroupedSolutions, type F2lSolutionGroup } from '@/lib/f2l-solution-groups';

/** Reading projection only: the original rows remain the editor/save source. */
export default function F2lSolutionGroups({ cases, entries, setup, orientation, onSelect, children, editing = false, editableRows, selectedAlgorithm }: {
  cases: readonly AlgCase[];
  entries: readonly AlgEntry[];
  setup: string;
  orientation: number;
  onSelect: (entry: AlgEntry) => void;
  children: ReactNode;
  editing?: boolean;
  editableRows?: { key: string; node: ReactNode }[];
  selectedAlgorithm?: string | null;
}) {
  const [resolved, setResolved] = useState<{ entryKey: string; value: F2lGroupedSolutions } | null>(null);
  const [localSelectedAlg, setSelectedAlg] = useState<string | null>(null);
  const selectedAlg = selectedAlgorithm === undefined ? localSelectedAlg : selectedAlgorithm;
  const entryKey = JSON.stringify(entries.map(e => e.alg));
  // Async grouping indices belong to one order only; never apply them to a new order.
  const result = resolved?.entryKey === entryKey ? resolved.value : null;
  const stableEntries = useMemo(() => (JSON.parse(entryKey) as string[]).map(alg => ({ alg })), [entryKey]);
  useEffect(() => {
    if (editing && !editableRows) return;
    let live = true;
    if (!editing) setResolved(null);
    void groupF2lSolutions(cases, setup, stableEntries, orientation)
      .then(next => { if (live) setResolved({ entryKey, value: next }); })
      .catch(() => { if (live) setResolved(null); });
    return () => { live = false; };
  }, [cases, setup, stableEntries, entryKey, orientation, editing, !!editableRows]);

  // Collect each prefix at its first occurrence, including nonadjacent sources.
  // Both modes share this display order; storage indices stay unchanged.
  const rowGroup = (i: number) => result?.groups.find(g => g.sourceIndices.length > 1 && g.sourceIndices.includes(i));
  const blocks: { indices: number[]; group?: F2lSolutionGroup }[] = [];
  entries.forEach((_, i) => {
    const group = rowGroup(i);
    const existing = group && blocks.find(block => block.group?.key === group.key);
    if (existing) existing.indices.push(i);
    else blocks.push({ indices: [i], group });
  });
  const displayRows = new Map(blocks.flatMap(block => block.indices).map((source, i) => [source, i + 1]));

  if (editing && !editableRows) return <>{children}</>;
  if (!editing && !result) return <>{children}</>;

  // Use one grid and the same source rows in both modes. Only the row control
  // changes; grouping never creates extra library choices absent from the editor.
  const headings = blocks.map(({ indices, group }) => {
    if (!group) return null;
    const start = displayRows.get(indices[0])!;
    const selected = indices.some(i => entries[i].alg === selectedAlg);
    return <div key={group.key} className={`f2l-edit-group-prefix${selected ? ' is-selected' : ''}`} style={{ gridRow: `${start} / ${start + indices.length}` }}>
      <span>{group.prefix}</span>
      <svg className="f2l-solution-brace" viewBox="0 0 16 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M15 1 C6 1 6 8 6 15 V38 C6 46 3 50 1 50 C3 50 6 54 6 62 V85 C6 92 6 99 15 99" />
      </svg>
    </div>;
  });
  const rowStyle = (i: number) => ({ gridRow: displayRows.get(i), gridColumn: '1 / -1' });
  // Each row reserves only its own prefix width. Keep the same keyed row parent
  // so regrouping or dragging never remounts an uncontrolled editing input.
  const prefixSpacer = (i: number) => {
    const group = rowGroup(i);
    if (!group) return null;
    const selected = group.sourceIndices.some(index => entries[index].alg === selectedAlg);
    return <span aria-hidden="true" className={`f2l-prefix-spacer${selected ? ' is-selected' : ''}`}>{group.prefix}</span>;
  };
  return <div className="f2l-edit-groups">
    {editing ? editableRows!.map((row, i) => <div key={row.key} className="f2l-edit-source-row" data-grouped={!!rowGroup(i)} style={rowStyle(i)}>
      {prefixSpacer(i)}
      <AlgEditorPrefix value={rowGroup(i)?.prefix ?? ''}>{row.node}</AlgEditorPrefix>
    </div>) : blocks.flatMap(block => block.indices).map(i => {
      const entry = entries[i];
      const prefix = rowGroup(i)?.prefix ?? '';
      const fullText = displayCaseAlg('3x3', 'f2l', entry.alg);
      const suffix = prefix && fullText.startsWith(prefix + ' ') ? fullText.slice(prefix.length + 1) : fullText;
      return <div key={i} className="f2l-edit-source-row" data-grouped={!!rowGroup(i)} style={rowStyle(i)}>
        {prefixSpacer(i)}
          <AlgFormulaReadRow tags={entry.tags} selected={selectedAlg === entry.alg} role="button" tabIndex={0} className="f2l-solution-play" aria-pressed={selectedAlg === entry.alg}
            onClick={() => { setSelectedAlg(entry.alg); onSelect(entry); }}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedAlg(entry.alg); onSelect(entry); } }}
            aria-label={tr({ zh: '播放完整公式：', en: 'Play complete algorithm: ' }) + entry.alg}>
            {suffix}
          </AlgFormulaReadRow>
      </div>;
    })}
    {headings}
  </div>;
}
