'use client';

import dynamic from 'next/dynamic';
const Player = dynamic(() => import('@/components/AlgPlayer/AlgPlayer'), { ssr: false });

export default function CubeModel({ n, alg }: { n: number; alg: string }) {
  return <Player engine="sim" puzzle="5x5" puzzleOrder={n} set="full" setup={alg} alg=""
    controlMode="none" interactionMode="view" fillPane hideResetView />;
}
