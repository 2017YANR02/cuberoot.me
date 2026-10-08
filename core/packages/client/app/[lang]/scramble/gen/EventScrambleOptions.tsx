'use client';

import HighOrderNxNInput from '@/components/HighOrderNxNInput';
import Scramble222ModePicker from '@/components/Scramble222ModePicker';
import Scramble333ModePicker from '@/components/Scramble333ModePicker';
import Scramble555ModePicker from '@/components/Scramble555ModePicker';
import ScrambleRediModePicker from '@/components/ScrambleRediModePicker';
import PillToggle from '@/components/PillToggle/PillToggle';
import { tr } from '@/i18n/tr';

interface Props {
  event: string;
  isZh: boolean;
  onAddOrder?: (n: number) => void;
  sq1Compact: boolean;
  onSq1CompactChange: (compact: boolean) => void;
}

/** 项目菜单内的设置；已加载的比赛仅提供可立即应用的记号选项。 */
export default function EventScrambleOptions({ event, isZh, onAddOrder, sq1Compact, onSq1CompactChange }: Props) {
  let options;
  switch (event) {
    case '333':
      if (!onAddOrder) return null;
      options = <>
        <HighOrderNxNInput isZh={isZh} onAdd={onAddOrder} />
        <Scramble333ModePicker active333 isZh={isZh} showLabel={false} />
      </>;
      break;
    case '222':
      if (!onAddOrder) return null;
      options = <Scramble222ModePicker active222 showLabel={false} />;
      break;
    case '555':
      if (!onAddOrder) return null;
      options = <Scramble555ModePicker active555 isZh={isZh} showLabel={false} />;
      break;
    case 'redi_cube':
      options = <ScrambleRediModePicker active />;
      break;
    case 'sq1':
      options = <PillToggle
        value={sq1Compact}
        onChange={onSq1CompactChange}
        onLabel={tr({ zh: '简写', en: 'Compact' })}
        offLabel={tr({ zh: '完整', en: 'Full' })}
        ariaLabel={tr({ zh: 'SQ1 打乱记号:简写或完整', en: 'SQ1 scramble notation: compact or full' })}
      />;
      break;
    default:
      return null;
  }
  return <div className="gen-event-options">{options}</div>;
}
