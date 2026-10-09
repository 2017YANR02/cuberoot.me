'use client';

import HighOrderNxNInput from '@/components/HighOrderNxNInput';
import { use222Mode } from '@/lib/scramble-222-mode';
import { use333Mode } from '@/lib/scramble-333-mode';
import { use555Mode } from '@/lib/scramble-555-mode';
import { SCRAMBLE_222_UI_LABELS } from '@cuberoot/shared/timer';
import AppLink from '@/components/AppLink';
import { HelpCircle } from 'lucide-react';
import ScrambleRediModePicker from '@/components/ScrambleRediModePicker';
import { tr } from '@/i18n/tr';
import { nativeScramblePracticeHint } from '@/lib/native-scramble';
import '@/components/scramble-mode-picker-row.css';

interface Props {
  event: string;
  isZh: boolean;
  onAddOrder?: (n: number) => void;
  sq1Compact: boolean;
  onSq1CompactChange: (compact: boolean) => void;
}

function CubeModeSelect({ event }: { event: '222' | '333' | '555' }) {
  const [mode222, setMode222] = use222Mode();
  const [mode333, setMode333] = use333Mode();
  const [mode555, setMode555] = use555Mode();
  if (event === '222') return (
    <select className="gen-tn-format-select" aria-label={tr(SCRAMBLE_222_UI_LABELS.modeAriaLabel)}
      value={mode222} onChange={(e) => setMode222(e.target.value === 'optimal' ? 'optimal' : 'wca')}>
      <option value="wca">{tr(SCRAMBLE_222_UI_LABELS.wca11Move)}</option>
      <option value="optimal">{tr(SCRAMBLE_222_UI_LABELS.optimal)}</option>
    </select>
  );
  if (event === '333') return (
    <select className="gen-tn-format-select" aria-label={tr({ zh: '3x3 打乱引擎', en: '3x3 scramble engine' })}
      value={mode333} onChange={(e) => setMode333(e.target.value === 'm2p' ? 'm2p' : 'wca')}>
      <option value="wca">WCA</option>
      <option value="m2p">min2phase</option>
    </select>
  );
  return <>
    <select className="gen-tn-format-select" aria-label={tr({ zh: '5x5 打乱类型', en: '5x5 scramble type' })}
      value={mode555} onChange={(e) => setMode555(e.target.value === 'rs' ? 'rs' : 'rm')}>
      <option value="rm">{tr({ zh: '随机转动', en: 'random-move' })}</option>
      <option value="rs">{tr({ zh: '随机状态', en: 'random-state' })}</option>
    </select>
    <AppLink href="/scramble/555-about" className="scramble-mode-info"
      title={tr({ zh: '什么是随机状态 / 随机转动?', en: "What's random-state vs random-move?" })}
      aria-label={tr({ zh: '查看 5x5 打乱方法说明', en: 'About 5x5 scramble methods' })}>
      <HelpCircle size={16} />
    </AppLink>
  </>;
}

/** 项目菜单内的设置；已加载的比赛仅提供可立即应用的记号选项。 */
export default function EventScrambleOptions({ event, isZh, onAddOrder, sq1Compact, onSq1CompactChange }: Props) {
  let options;
  switch (event) {
    case '333':
      if (!onAddOrder) return null;
      options = <>
        <HighOrderNxNInput isZh={isZh} onAdd={onAddOrder} />
        <CubeModeSelect event="333" />
      </>;
      break;
    case '222':
      if (!onAddOrder) return null;
      options = <CubeModeSelect event="222" />;
      break;
    case 'sphere':
      if (!onAddOrder) return null;
      options = <CubeModeSelect event="333" />;
      break;
    case '555':
      if (!onAddOrder) return null;
      options = <CubeModeSelect event="555" />;
      break;
    case 'redi_cube':
      options = <ScrambleRediModePicker active />;
      break;
    case 'kilominx':
      options = <span title={tr({
        zh: '底面使用 DR / DL / DBL / DBR，与模拟器默认记号相同；支持 R++ / D++ 打乱。',
        en: 'Lower faces use DR / DL / DBL / DBR, matching the simulator default; R++ / D++ scrambles are supported.',
      })}>{tr({ zh: 'csTimer 记号', en: 'csTimer notation' })}</span>;
      break;
    case 'sq1':
      options = <select
        className="gen-tn-format-select"
        value={sq1Compact ? 'compact' : 'full'}
        onChange={(e) => onSq1CompactChange(e.target.value === 'compact')}
        aria-label={tr({ zh: 'SQ1 打乱记号:简写或完整', en: 'SQ1 scramble notation: compact or full' })}
      >
        <option value="compact">{tr({ zh: '简写', en: 'Compact' })}</option>
        <option value="full">{tr({ zh: '完整', en: 'Full' })}</option>
      </select>;
      break;
    case 'magic': case 'mmagic':
      options = <AppLink href={`/sim?puzzle=${event}`} prefetch={false} className="scramble-mode-info"
        title={tr(nativeScramblePracticeHint(event)!)}
        aria-label={tr({ zh: '打开折叠练习模拟器', en: 'Open the folding practice simulator' })}>
        <HelpCircle size={16} />
      </AppLink>;
      break;
    default:
      return null;
  }
  return <div className="gen-event-options">{options}</div>;
}
