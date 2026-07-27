'use client';

// /alg/roux — dedicated Roux-method trainer page. A static segment that
// shadows [puzzle] (same trick as /alg/skewb-trainer and /alg/3bld). Reached
// from the 333 hub's 桥式 card.
// RouxTrainer is heavy (three.js + in-browser Roux solver) and reads localStorage
// in its reducer init, so it's loaded client-only via next/dynamic (ssr: false).

import dynamic from 'next/dynamic';
import '@/app/[lang]/alg/_trainer/trainer.css';

// loading 占位撑住页面主体的高度 —— 没有它,chunk 到达前整页是 0 高,内容一落地
// 页面猛地撑开(CLS)。空 div 比骨架屏便宜,而且训练器一到就替换掉。
const RouxTrainer = dynamic(() => import('../_roux/RouxTrainer'), {
  ssr: false,
  loading: () => <div style={{ minHeight: '70vh' }} aria-hidden="true" />,
});

export default function RouxTrainerPage() {
  return (
    <div className="trainer-root">
      <RouxTrainer />
    </div>
  );
}
