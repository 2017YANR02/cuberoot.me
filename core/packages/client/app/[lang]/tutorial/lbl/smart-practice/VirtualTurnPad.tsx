import { useEffect, useEffectEvent, useState } from 'react';
import { Keyboard } from '@app-foundation/icons/lucide';
import { T, tr } from '@/i18n/tr';

const faces = 'URFDLB';
const amounts = [
  { suffix: '', label: { zh: '顺时针', en: 'Clockwise' } },
  { suffix: "'", label: { zh: '逆时针', en: 'Counterclockwise' } },
  { suffix: '2', label: { zh: '半圈', en: 'Half turn' } },
] as const;

export type VirtualCubeControls = {
  onTurn: (move: string, pose: string) => void;
  onReset: (solved: boolean) => void;
};

export default function VirtualTurnPad({ onTurn, onReset, moveHint, helpOpen }: {
  onTurn: (move: string) => void;
  onReset: VirtualCubeControls['onReset'];
  moveHint?: string;
  helpOpen?: boolean;
}) {
  const [amount, setAmount] = useState<(typeof amounts)[number]['suffix']>('');
  const turnFromKeyboard = useEffectEvent((move: string) => onTurn(move));
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (helpOpen || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable], dialog')) return;
      const face = event.key.toUpperCase();
      if (face.length !== 1 || !faces.includes(face)) return;
      event.preventDefault();
      turnFromKeyboard(`${face}${event.shiftKey ? "'" : amount}`);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [amount, helpOpen]);

  return <div className="lbl-smart-keyboard" aria-label={tr({ zh: '虚拟魔方测试键盘', en: 'Virtual cube test keyboard' })} role="group">
    <div className="lbl-smart-keyboard-label"><Keyboard size={17} aria-hidden="true" /><T zh="虚拟键盘" en="Virtual keyboard" /></div>
    <div className="lbl-smart-keys" role="group" aria-label={tr({ zh: '转动方向', en: 'Turn direction' })}>
      {amounts.map(({ suffix, label }, index) => <button className="lbl-smart-key" key={suffix} type="button" aria-label={tr(label)} aria-pressed={amount === suffix} onClick={() => setAmount(suffix)}>
        {index === 0 ? <T zh="顺" en="CW" /> : suffix === "'" ? '′' : '2'}
      </button>)}
    </div>
    <div className="lbl-smart-keys lbl-smart-face-keys">
      {Array.from(faces, face => <button className="lbl-smart-key" key={face} type="button" onClick={() => onTurn(`${face}${amount}`)}>{face}{amount === "'" ? '′' : amount}</button>)}
    </div>
    <div className="lbl-smart-keys lbl-smart-test-actions">
      {moveHint && <button className="lbl-smart-key" type="button" onClick={() => onTurn(moveHint)}>
        <T zh={<>执行 {moveHint.replaceAll("'", '′')}</>} en={<>Apply {moveHint.replaceAll("'", '′')}</>} />
      </button>}
      <button className="lbl-smart-key" type="button" onClick={() => onReset(false)}><T zh="打乱" en="Scramble" /></button>
      <button className="lbl-smart-key" type="button" onClick={() => onReset(true)}><T zh="复原" en="Solve" /></button>
    </div>
  </div>;
}
