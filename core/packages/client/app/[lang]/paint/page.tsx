'use client';

import dynamic from 'next/dynamic';
import './paint.css';

const PaintEditor = dynamic(() => import('./_components/PaintEditor'), {
  ssr: false,
  // 页面主体:占位撑高,免得 chunk 落地时整页从 0 高猛撑开。
  loading: () => <div style={{ minHeight: '70vh' }} aria-hidden="true" />,
});

export default function PaintPage() {
  return <PaintEditor />;
}
