'use client';

// /alg/roux — dedicated Roux-method trainer page. A static segment that
// shadows [puzzle] (same trick as /alg/skewb-trainer and /alg/3bld). Reached
// from the 333 hub's 桥式 card.
// RouxTrainer is heavy (three.js + in-browser Roux solver) and reads localStorage
// in its reducer init, so it's loaded client-only via next/dynamic (ssr: false).

import dynamic from 'next/dynamic';
import { ClientLoadStatus } from '@/components/StartupStatus';
import '@/app/[lang]/alg/_trainer/trainer.css';

const RouxTrainer = dynamic(() => import('../_roux/RouxTrainer'), {
  ssr: false,
  loading: () => <ClientLoadStatus />,
});

export default function RouxTrainerPage() {
  return (
    <div className="trainer-root">
      <RouxTrainer />
    </div>
  );
}
