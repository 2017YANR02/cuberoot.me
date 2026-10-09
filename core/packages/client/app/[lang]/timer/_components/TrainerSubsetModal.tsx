'use client';
import { TimerTrainerSubsetModal } from '@cuberoot/timer-ui';
import { getSettings, updateSettings } from '../_lib/settings';
export default function TrainerSubsetModal({ kind, isZh, onClose }: { kind: 'oll' | 'pll'; isZh: boolean; onClose(): void }) {
  return <TimerTrainerSubsetModal kind={kind} language={isZh ? 'zh' : 'en'} value={kind === 'oll' ? getSettings().ollSubset : getSettings().pllSubset} onClose={onClose} onSave={value => updateSettings(kind === 'oll' ? { ollSubset: value } : { pllSubset: value })} />;
}
