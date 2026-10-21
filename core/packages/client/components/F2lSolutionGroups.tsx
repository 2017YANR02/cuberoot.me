'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, Play } from '@app-foundation/icons/lucide';
import type { AlgCase, AlgEntry } from '@cuberoot/shared/alg';
import Link from '@/components/AppLink';
import { Tooltip } from '@/components/Tooltip';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';
import { algCaseDetailHref, buildCaseSlugMap } from '@/lib/alg_case_link';
import { displayCaseAlg } from '@/lib/alg_display';
import { groupF2lSolutions, type F2lGroupedSolutions } from '@/lib/f2l-solution-groups';

/** Reading projection only: the original rows remain the editor/save source. */
export default function F2lSolutionGroups({ cases, entries, setup, orientation, onSelect, children, editing = false }: {
  cases: readonly AlgCase[];
  entries: readonly AlgEntry[];
  setup: string;
  orientation: number;
  onSelect: (entry: AlgEntry) => void;
  children: ReactNode;
  editing?: boolean;
}) {
  const [result, setResult] = useState<F2lGroupedSolutions | null>(null);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const [originalsOpen, setOriginalsOpen] = useState(false);
  const entryKey = JSON.stringify(entries.map(e => e.alg));
  const stableEntries = useMemo(() => (JSON.parse(entryKey) as string[]).map(alg => ({ alg })), [entryKey]);
  const slugs = useMemo(() => buildCaseSlugMap([...cases], 'f2l'), [cases]);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const { copiedKey, copy } = useCopy();
  useEffect(() => {
    let live = true;
    setResult(null);
    void groupF2lSolutions(cases, setup, stableEntries, orientation)
      .then(next => { if (live) setResult(next); })
      .catch(() => { if (live) setResult(null); });
    return () => { live = false; };
  }, [cases, setup, stableEntries, orientation]);
  useEffect(() => {
    const group = result?.groups.find(g => g.key === active);
    const option = group && (group.options.find(o => o.fullAlg === selection[group.key]) ?? group.options[0]);
    if (option) selectRef.current({ alg: option.fullAlg });
  }, [result, active, selection]);

  const hasGroups = !!result?.groups.length;
  const showAlg = (alg: string) => displayCaseAlg('3x3', 'f2l', alg);
  return <div className="f2l-solution-groups">
    {result?.groups.map(group => {
      const option = group.options.find(o => o.fullAlg === selection[group.key]) ?? group.options[0];
      return <details key={group.key} className="f2l-solution-group"
        onToggle={event => { if (event.currentTarget.open) setActive(group.key); }}>
        <summary><span className="f2l-solution-prefix">{group.prefix}</span>
          <span className="f2l-solution-target">→ {tr({ zh: '标态', en: 'Standard' })} {group.standardName}</span>
        </summary>
        <div className="f2l-solution-choices">
          <label><span>{tr({ zh: '入槽方法', en: 'Insertion' })}</span>
            <select className="f2l-solution-select" value={option.fullAlg} onChange={event => {
              setSelection(previous => ({ ...previous, [group.key]: event.target.value }));
              setActive(group.key);
            }}>
              <optgroup label={tr({ zh: '标态公式库', en: 'Insertion library' })}>
                {group.options.filter(o => o.source === 'standard').map(o => <option key={o.fullAlg} value={o.fullAlg}>{showAlg(o.alg)}</option>)}
              </optgroup>
              {group.options.some(o => o.source === 'original') && <optgroup label={tr({ zh: '其他原有入槽法', en: 'Other original insertions' })}>
                {group.options.filter(o => o.source === 'original').map(o => <option key={o.fullAlg} value={o.fullAlg}>{showAlg(o.alg)}</option>)}
              </optgroup>}
            </select>
          </label>
          <div className="f2l-solution-composed">
            <button type="button" className="f2l-solution-play" onClick={() => onSelect({ alg: option.fullAlg })}
              aria-label={tr({ zh: '播放完整公式', en: 'Play complete algorithm' })}>
              <Play size={14} /><span>{group.prefix} <strong>{showAlg(option.alg)}</strong></span>
            </button>
            <Tooltip content={tr({ zh: '复制完整公式', en: 'Copy complete algorithm' })}>{tip =>
              <button {...tip} type="button" className="f2l-solution-copy" aria-label={tr({ zh: '复制完整公式', en: 'Copy complete algorithm' })} onClick={() => copy(option.fullAlg, group.key)}>
                {copiedKey === group.key ? <Check size={14} /> : <Copy size={14} />}
              </button>
            }</Tooltip>
          </div>
          <Link href={algCaseDetailHref('3x3', 'f2l', slugs.byId.get(group.standardId!) ?? group.standardName.toLowerCase())} prefetch={false} className="f2l-solution-source">
            {tr({ zh: '查看标态公式库', en: 'Open insertion library' })} · {group.standardName}
          </Link>
        </div>
      </details>;
    })}
    {hasGroups && result.ungrouped.map(i => <div className="f2l-solution-composed" key={i}>
      <button type="button" className="f2l-solution-play" onClick={() => onSelect(entries[i])}>
        <span>{showAlg(entries[i].alg)}</span>
      </button>
      <Tooltip content={tr({ zh: '复制', en: 'Copy' })}>{tip =>
        <button {...tip} type="button" className="f2l-solution-copy" aria-label={tr({ zh: '复制', en: 'Copy' })} onClick={() => copy(entries[i].alg, `row-${i}`)}>
          {copiedKey === `row-${i}` ? <Check size={14} /> : <Copy size={14} />}
        </button>
      }</Tooltip>
    </div>)}
    <details className="f2l-solution-originals" open={!hasGroups || originalsOpen}
      onToggle={event => { if (hasGroups) setOriginalsOpen(event.currentTarget.open); }}>
      <summary hidden={!hasGroups}>{editing ? tr({ zh: '编辑原始公式', en: 'Edit original algorithms' })
        : tr({ zh: '原始公式与出处', en: 'Original algorithms and sources' })}</summary>
      {children}
    </details>
  </div>;
}
