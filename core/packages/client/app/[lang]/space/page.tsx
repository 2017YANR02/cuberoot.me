'use client';

import dynamic from 'next/dynamic';
import { ClientLoadStatus } from '@/components/StartupStatus';

const SpacePage = dynamic(() => import('./SpacePage'), {
  ssr: false,
  loading: () => <ClientLoadStatus label={{ zh: '正在打开魔方空间…', en: 'Opening Cube space…' }} />,
});

export default function Page() { return <SpacePage />; }
