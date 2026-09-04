'use client';

/**
 * 公式库与教程页共用的项目下拉,交互与样式复用 PuzzlePicker。
 *
 * 每一项都是真链接(AppLink),中键 / Ctrl 点能新开;当前项高亮但仍可点(回到自己)。
 * 三盲 / 换位子不是 ALG_PUZZLES 里的魔方阶,但各自是一个独立项目(整套编码体系 /
 * 一类构造法,不是某个魔方的一套公式),所以排在魔方之后、同一个下拉里。
 */
import { ALG_PUZZLES } from '@cuberoot/shared';
import PuzzlePicker, { type PuzzlePickerGroup } from '@/components/PuzzlePicker/PuzzlePicker';
import { eventDisplayName } from '@/lib/wca-events';
import { tr } from '@/i18n/tr';
import { toWcaEventId } from '@/lib/wca-events';

export const ALG_PUZZLE_PICKER_IDS = [...ALG_PUZZLES, '3bld', 'commutator'] as const;
export type AlgPuzzlePickerId = (typeof ALG_PUZZLE_PICKER_IDS)[number];
export const TUTORIAL_PUZZLE_PICKER_IDS = [...ALG_PUZZLE_PICKER_IDS, 'ivy'] as const;

function algPuzzleGroups(isZh: boolean, groupLabel?: string, includeIvy = false): readonly PuzzlePickerGroup[] {
  return [{
    id: 'algorithm-puzzles',
    label: groupLabel ?? tr({ zh: '公式库项目', en: 'Algorithm puzzles' }),
    items: [
      ...ALG_PUZZLES.map((p) => ({
        id: p,
        label: eventDisplayName(p, isZh),
        iconClass: p === 'fto' ? 'unofficial-fto' : `event-${toWcaEventId(p)}`,
      })),
      ...(includeIvy ? [{ id: 'ivy', label: eventDisplayName('ivy', isZh), iconClass: 'unofficial-ivy' }] : []),
      { id: '3bld', label: tr({ zh: '三盲', en: '3BLD' }), iconClass: 'event-333bf' },
      { id: 'commutator', label: tr({ zh: '换位子', en: 'Commutator' }), textLabel: '[,]' },
    ],
  }];
}

interface Props {
  current: string;
  isZh: boolean;
  groupLabel?: string;
  includeIvy?: boolean;
  linkFor: (id: string) => { href: string };
}

export default function AlgPuzzlePicker({ current, isZh, groupLabel, includeIvy, linkFor }: Props) {
  return (
    <PuzzlePicker
      isZh={isZh}
      selectedEvent={current}
      groups={algPuzzleGroups(isZh, groupLabel, includeIvy)}
      linkFor={linkFor}
    />
  );
}
