'use client';
// 「详细成绩」逐把 PR 名次角标的显示开关 — # 图标 + iOS 风 PillToggle,放在「全部成绩」标题右侧,所有人可用。
// 开(默认):每把单次后显示时间序 PR 名次;关:只显示成绩,隐藏全部角标。

import { Hash } from 'lucide-react';
import { tr } from '@/i18n/tr';
import PillToggle from '@/components/PillToggle/PillToggle';

export function AttemptRanksToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <span
      className={`wp-attempt-ranks-toggle ${active ? 'is-active' : ''}`}
      title={tr({
        zh: '详细成绩 PR 名次 — 开:每把单次后显示当时的历史名次;关:隐藏角标',
        en: 'Attempt PR ranks — On: show each solve’s historical rank; Off: hide the badges',
      })}
    >
      <Hash size={14} aria-hidden="true" />
      <PillToggle
        value={active}
        onChange={(v) => { if (v !== active) onToggle(); }}
        ariaLabel={tr({ zh: '详细成绩 PR 名次', en: 'Attempt PR ranks' })}
      />
    </span>
  );
}
