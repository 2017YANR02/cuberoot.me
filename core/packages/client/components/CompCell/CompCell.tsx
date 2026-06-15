'use client';

// Ported from packages/client-vite/src/components/CompCell/CompCell.tsx.
import { Flag } from '@/components/Flag';
import { compFlagIso2 } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';

interface Props {
  compId: string;
  compName?: string | null;
  isZh: boolean;
  noFlag?: boolean;
}

export function CompCell({ compId, compName, isZh, noFlag }: Props) {
  const iso2 = compFlagIso2(compId);
  const display = localizeCompName(compId, compName ?? compId, isZh);
  return (
    <span className="comp-cell">
      {!noFlag && iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
      {!noFlag && iso2 && ' '}
      <span>{display}</span>
    </span>
  );
}
