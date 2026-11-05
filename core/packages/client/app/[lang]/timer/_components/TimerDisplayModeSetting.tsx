'use client';

import { STACKMAT_GENERATIONS, STACKMAT_G5_SKINS, STACKMAT_G5_SKIN_LABELS } from '@/components/stackmat-catalog';
import { CompactSelect } from '@/components/CompactSelect';
import { tr } from '@/i18n/tr';
import { updateSettings, useSettings, type TimerDisplayMode } from '../_lib/settings';

export default function TimerDisplayModeSetting() {
  const { timerDisplayMode, stackmatSkin, stackmatInputMode } = useSettings();
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
      <div className="settings-row"><span className="settings-row-label">{tr({ zh: '计时方式', en: 'Timing input' })}</span>
        <span className="settings-row-control"><CompactSelect ariaLabel={tr({ zh: '计时方式', en: 'Timing input' })}
          label={stackmatInputMode === 'normal' ? tr({ zh: '普通', en: 'Normal' }) : stackmatInputMode === '2-pad' ? '2-Pad' : '4-Pad'}
          value={stackmatInputMode} items={[
            { value: 'normal', label: tr({ zh: '普通', en: 'Normal' }) },
            { value: '2-pad', label: '2-Pad' }, { value: '4-pad', label: '4-Pad' },
          ]} onChange={value => updateSettings({ stackmatInputMode: value })}/></span></div>
      {stackmatInputMode !== 'normal' && <p className="settings-hint">{tr({
        zh: '按齐感应区或标注按键 0.55 秒，绿灯后松开起表；再次按齐停表。',
        en: 'Hold all required pads or their labeled keys for 0.55 seconds, then release on green to start. Touch all required pads again to stop.',
      })}</p>}
    </>}
  </>;
}
