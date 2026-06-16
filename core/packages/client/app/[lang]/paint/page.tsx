'use client';

import dynamic from 'next/dynamic';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './paint.css';

const PaintEditor = dynamic(() => import('./_components/PaintEditor'), {
  ssr: false,
});

export default function PaintPage() {
  useDocumentTitle('绘制', 'Paint');
  return <PaintEditor />;
}
