'use client';

// 角块公式训练 (corner) — faithful port of spooncuber corner.html + corner.js.
// Thin wrapper over the shared <CodeTrainer pieceType='corner'/>.

import type { JSX } from 'react';
import { CodeTrainer } from '../_components/CodeTrainer';

export default function CornerTrainerPage(): JSX.Element {
  return <CodeTrainer pieceType="corner" />;
}
