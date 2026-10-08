'use client';

import { tr } from '@/i18n/tr';
import { useRediMode } from '@/lib/scramble-redi-mode';
import BoolToggle from './BoolToggle';

export default function ScrambleRediModePicker({ active }: { active: boolean }) {
  const [mode, setMode] = useRediMode();
  if (!active) return null;
  return (
    <BoolToggle
      value={mode === 'rotations'}
      onChange={(value) => setMode(value ? 'rotations' : 'timer')}
      label={tr({ zh: '转体', en: 'Rotations' })}
    />
  );
}
