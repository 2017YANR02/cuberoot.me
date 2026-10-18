'use client';

import type { AlgCase, AlgPuzzle } from '@cuberoot/shared/alg';
import Link from '@/components/AppLink';
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
}: {
  items: readonly AlgCaseRelationCardItem[];
  puzzle: AlgPuzzle;
  set: string;
  viewAngle?: CaseViewAngle;
  orientation?: string;
  sq1BlackTop?: boolean;
}) {
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
    <div className="alg-meta-related-grid alg-meta-top-grid">
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
        }}>{card}</AlgImageDownloadButton> : card}</div>;
      })}
    </div>
  );
}
