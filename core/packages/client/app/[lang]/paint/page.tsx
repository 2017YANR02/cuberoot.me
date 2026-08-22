'use client';

import dynamic from 'next/dynamic';
import { ClientLoadStatus } from '@/components/StartupStatus';
import './paint.css';

const PaintEditor = dynamic(() => import('./_components/PaintEditor'), {
  ssr: false,
  loading: () => <ClientLoadStatus />,
});

export default function PaintPage() {
  return <PaintEditor />;
}
