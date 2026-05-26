/**
 * BattleEventPicker — 中间栏内的 trigger 按钮(图标)。
 * 点击后切换 store.eventPickerOpen[playerId];真正的网格 overlay 由 TimerArea 渲染,
 * 充满该玩家的 player-area,不再是悬浮 popup(避免溢出 / 屏幕适配问题)。
 */

'use client';

import { useTranslation } from 'react-i18next';
import { EventIcon } from '@/components/EventIcon';
import { isWcaEvent } from '@/lib/wca-events';
import { PUZZLES } from './engine/constants';
import { useBattleStore } from './engine/battle_store';

interface BattleEventPickerProps {
  playerId: 0 | 1;
}

export default function BattleEventPicker({ playerId }: BattleEventPickerProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const value = useBattleStore(s => s.puzzleIds[playerId]);
  const isOpen = useBattleStore(s => s.eventPickerOpen[playerId]);
  const setOpen = useBattleStore(s => s.setEventPickerOpen);

  const renderIcon = (id: string) => {
    if (isWcaEvent(id)) return <EventIcon event={id} />;
    const p = PUZZLES.find(x => x.id === id);
    return <span className="event-fallback">{p?.name.en || id}</span>;
  };

  const currentName = (() => {
    const p = PUZZLES.find(x => x.id === value);
    return p ? (p.name[isZh ? 'zh' : 'en'] || p.name.en) : value;
  })();

  return (
    <button
      type="button"
      className={`event-btn${isOpen ? ' active' : ''}`}
      onClick={(e) => { e.stopPropagation(); setOpen(playerId, !isOpen); }}
      aria-label={currentName}
      title={currentName}
    >
      {renderIcon(value)}
    </button>
  );
}
