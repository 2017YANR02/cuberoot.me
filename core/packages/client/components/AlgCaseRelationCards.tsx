'use client';

import type { AlgCase, AlgPuzzle } from '@cuberoot/shared/alg';
import Link from '@/components/AppLink';
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
        if (item.current || (!item.href && !item.onSelect)) {
          return <div key={item.key} className={className}>{content(item)}</div>;
        }
        if (item.href) {
          return (
            <Link key={item.key} href={item.href} className={className} prefetch={false} title={item.title}>
              {content(item)}
            </Link>
          );
        }
        return (
          <button key={item.key} type="button" className={className} onClick={item.onSelect} title={item.title}>
            {content(item)}
          </button>
        );
      })}
    </div>
  );
}
