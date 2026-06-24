'use client';

// /trainer/roux — dedicated Roux-method trainer page. A static segment that
// shadows [puzzle] (same trick as /trainer/skewb and /trainer/3bld). Reached
// from the 333 hub's 桥式 card.
// RouxTrainer is heavy (three.js + in-browser Roux solver) and reads localStorage
// in its reducer init, so it's loaded client-only via next/dynamic (ssr: false).

import dynamic from 'next/dynamic';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '@/app/[lang]/alg/_trainer/trainer.css';

const RouxTrainer = dynamic(() => import('../_roux/RouxTrainer'), { ssr: false });

export default function RouxTrainerPage() {
  useDocumentTitle('桥式训练器', 'Roux Trainer');
  return (
    <div className="trainer-root">
      <RouxTrainer />
    </div>
  );
}
