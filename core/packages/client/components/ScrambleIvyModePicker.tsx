'use client';

import { useIvyMode } from '@/hooks/useIvyMode';
import { tr } from '@/i18n/tr';

export default function ScrambleIvyModePicker() {
  const [mode, setMode] = useIvyMode();
  return <select
    aria-label={tr({ zh: '枫叶打乱类型', en: 'Ivy scramble type' })}
    value={mode}
    onChange={event => setMode(event.target.value === 'rlub' ? 'rlub' : 'rldb')}
  >
    <option value="rldb">R L D B</option>
    <option value="rlub">R L U B</option>
  </select>;
}
