'use client';

// 角块公式训练 (corner) — faithful port of spooncuber corner.html + corner.js.
// Thin wrapper over the shared <CodeTrainer pieceType='corner'/>.

import type { JSX } from 'react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { CodeTrainer } from '../_components/CodeTrainer';

export default function CornerTrainerPage(): JSX.Element {
  useDocumentTitle('角块公式训练', 'Corner Algorithm Trainer', "角塊公式訓練");
  return <CodeTrainer pieceType="corner" />;
}
