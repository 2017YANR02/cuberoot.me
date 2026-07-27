'use client';

// 棱块公式训练 (edge) — faithful port of spooncuber edge.html + edge.js.
// Thin wrapper over the shared <CodeTrainer pieceType='edge'/>.

import type { JSX } from 'react';
import { CodeTrainer } from '../_components/CodeTrainer';

export default function EdgeTrainerPage(): JSX.Element {
  return <CodeTrainer pieceType="edge" />;
}
