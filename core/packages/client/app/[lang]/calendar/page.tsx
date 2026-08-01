'use client';

// 页面标题在同目录的 server layout.tsx(lib/page-meta.ts 的 'calendar' 键)。
// Suspense 包一层是 nuqs 的要求:useQueryState 在首帧要读 search params。

import { Suspense } from 'react';
import CalendarClient from './CalendarClient';

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="cal-page" />}>
      <CalendarClient />
    </Suspense>
  );
}
