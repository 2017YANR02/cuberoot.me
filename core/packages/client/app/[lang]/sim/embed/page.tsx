'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseSimEmbedParams } from '@/lib/sim-embed';
import './embed.css';

const AlgPlayer = dynamic(() => import('@/components/AlgPlayer/AlgPlayer'), { ssr: false });

export default function SimEmbedPage() {
  const search = useSearchParams().toString();
  const props = useMemo(() => parseSimEmbedParams(new URLSearchParams(search)), [search]);
  return (
    <main className="sim-external-embed">
      <AlgPlayer key={search} {...props} controlMode="none" hideResetView={props.lockView || props.interactionMode === 'none'} fillPane />
    </main>
  );
}
