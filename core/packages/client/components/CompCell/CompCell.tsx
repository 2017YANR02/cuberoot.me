'use client';

// Ported from packages/client-vite/src/components/CompCell/CompCell.tsx.
import { useEffect, useState } from 'react';
import { Flag } from '@/components/Flag';
import { compFlagIso2, loadFlagData } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';

interface Props {
  compId: string;
  compName?: string | null;
  isZh: boolean;
  noFlag?: boolean;
  country?: string | null;
  /**
   * 同一行 / 同一卡片上已经显示的比赛日期或年份('2026-07-25' / '2026'):传入即从比赛名里
   * 剥掉重复的年号(全站规则,见 lib/comp-localize.ts 的 stripCompYear)。
   * 页面上没写日期的地方传 null —— 那里年号是唯一的区分信息,必须保留。必填以逼每个调用点表态。
   */
  date: string | null;
}

function useCompetitionCountry(compId: string, country?: string | null) {
  const [, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void loadFlagData({ persons: false }).then(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);
  // Imported recon rows may omit country even though their competition ID is valid.
  return country || compFlagIso2(compId);
}

export function CompetitionFlag({ compId, country }: Pick<Props, 'compId' | 'country'>) {
  const iso2 = useCompetitionCountry(compId, country);
  return iso2 ? <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" /> : null;
}

export function CompCell({ compId, compName, isZh, noFlag, date, country }: Props) {
  const iso2 = useCompetitionCountry(compId, country);
  const display = localizeCompName(compId, compName ?? compId, isZh, { date });
  return (
    <span className="comp-cell">
      {!noFlag && iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
      {!noFlag && iso2 && ' '}
      <span>{display}</span>
    </span>
  );
}
