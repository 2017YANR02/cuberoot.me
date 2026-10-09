'use client';
// 「详细成绩」逐把 PR 名次角标的显示开关 — # 图标 + 原生开关菜单,放在「全部成绩」标题右侧,所有人可用。
// 开(默认):每把单次后显示时间序 PR 名次;关:只显示成绩,隐藏全部角标。

import '@cuberoot/timer-ui/compact-select.css';
import { Hash } from 'lucide-react';
import { tr } from '@/i18n/tr';

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
      <select className="native-select" value={String(active)} onChange={event => { const v = event.currentTarget.value === 'true'; if (v !== active) onToggle(); }} aria-label={tr({ zh: '详细成绩 PR 名次', en: 'Attempt PR ranks' })}>
        <option value="true">{tr({ zh: '开启', en: 'On' })}</option>
        <option value="false">{tr({ zh: '关闭', en: 'Off' })}</option>
      </select>
    </span>
  );
}
