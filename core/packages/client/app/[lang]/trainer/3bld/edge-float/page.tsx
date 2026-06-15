'use client';

// 棱块浮动训练 (edge-float) — thin page over the shared FloatTrainer.
// Edge variant exposes the practice-timer handoff.

import type { JSX } from 'react';
import { FloatTrainer } from '../_components/FloatTrainer';

export default function EdgeFloatPage(): JSX.Element {
  return <FloatTrainer piece="edge" />;
}
