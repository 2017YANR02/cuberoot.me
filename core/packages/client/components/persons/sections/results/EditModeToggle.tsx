'use client';
// 管理员「编辑模式」开关 — 放在「全部成绩」标题右侧。
// 开:点无复盘成绩进行内编辑;关(默认):点击跳 /recon/submit 复盘。

import { Pencil } from 'lucide-react';
import { tr } from '@/i18n/tr';

export function EditModeToggle({ active, onToggle, penaltyOnly }: { active: boolean; onToggle: () => void; penaltyOnly?: boolean }) {
  return (
    <button
      type="button"
      className={`wp-editmode-toggle ${active ? 'is-active' : ''}`}
      onClick={onToggle}
      aria-label={penaltyOnly ? tr({ zh: '罚时模式', en: 'Penalty mode' }) : tr({ zh: '编辑模式', en: 'Edit mode' })}
      title={penaltyOnly
        ? tr({ zh: '罚时模式 — 开:点自己的成绩标 +2;关:点成绩去复盘', en: 'Penalty mode — On: click your own solve to add +2; Off: click to reconstruct' })
        : tr({ zh: '编辑模式 — 开:点成绩改这一次;关:点成绩去复盘', en: 'Edit mode — On: click a solve to edit it; Off: click to reconstruct' })}
    >
      <Pencil size={14} />
    </button>
  );
}
