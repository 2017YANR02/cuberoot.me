'use client';
// 「详细成绩」逐把 PR 名次角标的显示开关 — 放在「全部成绩」标题右侧,所有人可用。
// 开(默认):每把单次后显示时间序 PR 名次;关:只显示成绩,隐藏全部角标。

import { Hash } from 'lucide-react';
import { tr } from '@/i18n/tr';

export function AttemptRanksToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`wp-editmode-toggle ${active ? 'is-active' : ''}`}
      onClick={onToggle}
      aria-label={tr({ zh: '详细成绩 PR 名次', en: 'Attempt PR ranks' })}
      title={tr({
        zh: '详细成绩 PR 名次 — 开:每把单次后显示当时的历史名次;关:隐藏角标',
        en: 'Attempt PR ranks — On: show each solve’s historical rank; Off: hide the badges',
      })}
    >
      <Hash size={14} />
    </button>
  );
}
