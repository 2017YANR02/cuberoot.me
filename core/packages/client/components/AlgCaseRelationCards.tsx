'use client';

import type { AlgCase, AlgPuzzle } from '@cuberoot/shared/alg';
import { useState, type CSSProperties } from 'react';
import Link from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import AlgImageDownloadButton from '@/components/AlgImageDownloadButton';
import { CaseThumb } from '@/components/CaseThumb';
import type { CaseViewAngle } from '@/lib/alg_display';

export interface AlgCaseRelationCardItem {
  key: string;
  label: string;
  name: string;
  caseObj?: AlgCase;
  alg?: string;
  current?: boolean;
  href?: string;
  onSelect?: () => void;
  title?: string;
  onRotate?: () => Promise<void>;
}

export function AlgCaseRelationCards({
  items,
  puzzle,
  set,
  viewAngle = 'default',
  orientation,
  sq1BlackTop = true,
  training = false,
}: {
  items: readonly AlgCaseRelationCardItem[];
  puzzle: AlgPuzzle;
  set: string;
  viewAngle?: CaseViewAngle;
  orientation?: string;
  sq1BlackTop?: boolean;
  training?: boolean;
}) {
  const [excludedIds, setExcludedIds] = useState<number[]>([]);
  const selected = [...new Set(items.flatMap(item => item.caseObj?.id != null && !excludedIds.includes(item.caseObj.id) ? [item.caseObj.id] : []))];
  const trainHref = `/alg/${puzzle}/${set}/run?${new URLSearchParams({ cases: selected.join(','), mode: 'train' })}`;
  const content = (item: AlgCaseRelationCardItem) => item.caseObj ? (
    <>
      <CaseThumb
        // A detail view has only a few related cases; render together without an image request.
        local
        onRotate={item.onRotate}
        puzzle={puzzle}
        set={set}
        sticker={item.caseObj.sticker}
        alg={item.alg || item.caseObj.algs[0]?.[0]?.alg || item.caseObj.setup || ''}
        setup={item.caseObj.setup}
        size={76}
        sq1BlackTop={sq1BlackTop}
        viewAngle={viewAngle}
        orientation={orientation}
      />
      <span className="alg-meta-related-label">{item.label}</span>
      <span className="alg-meta-related-name">{item.name}</span>
    </>
  ) : (
    <>
      <span className="alg-meta-related-thumb-gap" aria-hidden="true" />
      <span className="alg-meta-related-label">{item.label}</span>
      <span className="alg-meta-related-name">{item.name}</span>
    </>
  );

  return (
    <div className={`alg-meta-related-grid alg-meta-top-grid${training ? ' alg-related-training-grid' : ''}`}
      style={training ? { '--alg-related-columns': items.length } as CSSProperties : undefined}>
    {training && <div className="alg-related-training-action">
      {selected.length > 0
        ? <Link className="alg-train-cta" href={trainHref} prefetch={false}>{tr({ zh: '训练', en: 'Train' })}</Link>
        : <span className="alg-train-cta" aria-disabled="true">{tr({ zh: '训练', en: 'Train' })}</span>}
    </div>}
      {items.map(item => {
        const className = `alg-meta-related-card${item.current ? ' is-self is-current' : ''}${item.caseObj ? '' : ' is-plain'}`;
        const card = item.current || (!item.href && !item.onSelect)
          ? <div className={className}>{content(item)}</div>
          : item.href
            ? <Link href={item.href} className={className} prefetch={false} title={item.title}>{content(item)}</Link>
            : <button type="button" className={className} onClick={item.onSelect} title={item.title}>{content(item)}</button>;
        return <div key={item.key} className="alg-related-download-card">{item.caseObj ? <AlgImageDownloadButton build={() => {
          const image = { name: `${puzzle}-${set}-${item.caseObj!.name}`, input: {
            puzzle, set, sticker: item.caseObj!.sticker,
            alg: item.alg || item.caseObj!.algs[0]?.[0]?.alg || item.caseObj!.setup || '',
            setup: item.caseObj!.setup, sq1BlackTop, viewAngle, orientation,
          } };
          return { filename: image.name, groups: [{ id: item.key, label: item.name, current: [image], all: [image] }] };
        }}>{card}</AlgImageDownloadButton> : card}
          {training && item.caseObj?.id != null && <label className="alg-related-train-select">
            {/* allow-checkbox: 用户明确要求关联情况默认全选，以复选框取消不想练的情况。 */}
            <input type="checkbox"
              aria-label={tr({ zh: `训练 ${item.name}`, en: `Train ${item.name}` })}
              checked={selected.includes(item.caseObj.id)}
              onChange={event => {
                const checked = event.currentTarget.checked;
                setExcludedIds(current => checked
                  ? current.filter(id => id !== item.caseObj!.id)
                  : [...new Set([...current, item.caseObj!.id!])]);
              }}
            />
          </label>}
        </div>;
      })}
    </div>
  );
}
