'use client';

import { effectiveStackmatInput, STACKMAT_GENERATIONS, STACKMAT_G5_SKINS, STACKMAT_G5_SKIN_LABELS } from '@/components/stackmat-catalog';
import { CompactSelect } from '@/components/CompactSelect';
import { tr } from '@/i18n/tr';
import { updateSettings, useSettings, type TimerDisplayMode } from '../_lib/settings';

export default function TimerDisplayModeSetting() {
  const settings = useSettings();
  const { timerDisplayMode, stackmatSkin } = settings;
  const stackmatInputMode = effectiveStackmatInput(settings);
  const items: { value: TimerDisplayMode; label: string }[] = [
    { value: 'digits', label: tr({ zh: '数字', en: 'Digits' }) },
    { value: 'stackmat', label: tr({ zh: '大显', en: 'Tournament display' }) },
    ...STACKMAT_GENERATIONS.map(generation => ({ value: `stackmat-g${generation}` as TimerDisplayMode, label: tr({ zh: `史塔克${['一', '二', '三', '四', '五'][generation - 1]}代`, en: `StackMat G${generation}` }) })),
  ];
  const label = tr({ zh: '计时显示', en: 'Timer display' });
  return <><div className="settings-row">
    <span className="settings-row-label">{label}</span>
    <span className="settings-row-control">
      <CompactSelect ariaLabel={label} label={items.find(item => item.value === timerDisplayMode)!.label}
        items={items} value={timerDisplayMode} onChange={value => updateSettings({ timerDisplayMode: value })} />
    </span>
  </div>
    {timerDisplayMode === 'stackmat-g5' && <>
      <div className="settings-row"><span className="settings-row-label">{tr({ zh: '涂装', en: 'Design' })}</span>
        <span className="settings-row-control"><CompactSelect ariaLabel={tr({ zh: '涂装', en: 'Design' })}
          label={tr(STACKMAT_G5_SKIN_LABELS[stackmatSkin])} value={stackmatSkin}
          items={STACKMAT_G5_SKINS.map(value => ({ value, label: tr(STACKMAT_G5_SKIN_LABELS[value]) }))}
          onChange={value => updateSettings({ stackmatSkin: value })}/></span></div>
    </>}
    {timerDisplayMode.startsWith('stackmat-g') && <>
      <div className="settings-row"><span className="settings-row-label">{tr({ zh: '计时方式', en: 'Timing input' })}</span>
        <span className="settings-row-control"><CompactSelect ariaLabel={tr({ zh: '计时方式', en: 'Timing input' })}
          label={stackmatInputMode === 'normal' ? tr({ zh: '普通', en: 'Normal' }) : stackmatInputMode === '2-pad' ? '2-Pad' : '4-Pad'}
          value={stackmatInputMode} items={[
            { value: 'normal', label: tr({ zh: '普通', en: 'Normal' }) },
            { value: '2-pad', label: '2-Pad' },
            ...(timerDisplayMode === 'stackmat-g5' ? [{ value: '4-pad' as const, label: '4-Pad' }] : []),
          ]} onChange={value => updateSettings({ stackmatInputMode: value })}/></span></div>
      {stackmatInputMode !== 'normal' && <p className="hint">{tr(stackmatInputMode === '4-pad' ? {
        zh: '可用键盘的 A S/ D F 模拟拍表', en: 'Use A S / D F on your keyboard to simulate the pads.',
      } : {
        zh: '可用键盘的 A/F 模拟拍表', en: 'Use A / F on your keyboard to simulate the pads.',
      })}</p>}
    </>}
  </>;
}
