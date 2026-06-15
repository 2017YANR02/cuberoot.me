'use client';

// 角块浮动训练 (corner-float) — thin page over the shared FloatTrainer.
// No timer handoff (per upstream cornerfloat.html).

import type { JSX } from 'react';
import { FloatTrainer } from '../_components/FloatTrainer';

export default function CornerFloatPage(): JSX.Element {
  return <FloatTrainer piece="corner" />;
}
