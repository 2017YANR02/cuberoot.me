'use client';

/**
 * /alg 页首的项目下拉 —— 只提供公式库 catalog,交互与样式完全复用 PuzzlePicker。
 *
 * 每一项都是真链接(AppLink),中键 / Ctrl 点能新开;当前项高亮但仍可点(回到自己)。
 * 三盲 / 换位子不是 ALG_PUZZLES 里的魔方阶,但各自是一个独立项目(整套编码体系 /
 * 一类构造法,不是某个魔方的一套公式),所以排在魔方之后、同一个下拉里。
 */
import { ALG_PUZZLES } from '@cuberoot/shared';
import PuzzlePicker, { type PuzzlePickerGroup } from '@/components/PuzzlePicker/PuzzlePicker';
import { eventDisplayName } from '@/lib/wca-events';
import { PUZZLE_EVENT } from '../_trainer/events';
import { tr } from '@/i18n/tr';

function algPuzzleGroups(isZh: boolean): readonly PuzzlePickerGroup[] {
  return [{
    id: 'algorithm-puzzles',
    label: tr({ zh: '公式库项目', en: 'Algorithm puzzles' }),
    items: [
      ...ALG_PUZZLES.map((p) => ({
        id: p,
        label: eventDisplayName(p, isZh),
        iconClass: p === 'fto' ? 'unofficial-fto' : `event-${PUZZLE_EVENT[p]}`,
      })),
      { id: '3bld', label: tr({ zh: '三盲', en: '3BLD' }), iconClass: 'event-333bf' },
      { id: 'commutator', label: tr({ zh: '换位子', en: 'Commutator' }), textLabel: '[,]' },
    ],
  }];
}

export default function AlgPuzzleSelect({ current, isZh }: { current: string; isZh: boolean }) {
  return (
    <PuzzlePicker
      isZh={isZh}
      selectedEvent={current}
      groups={algPuzzleGroups(isZh)}
      linkFor={(id) => ({ href: `/alg/${id}` })}
    />
  );
}
