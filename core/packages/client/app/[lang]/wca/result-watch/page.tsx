import { Suspense } from 'react';
import ResultWatchClient from './ResultWatchClient';

// /wca/result-watch — 关注选手「往期成绩变更」监控页(成绩取消 / 修正 / 纪录标记变动)。
// 数据来自 /v1/wca/result-watch/*,后台 monitors/wca_past_results.ts diff 写入。
// useQueryState(?wcaId=)需 Suspense 包裹(SSG 约束)。

export default function ResultWatchPage() {
  return (
    <Suspense fallback={<div className="result-watch-page" />}>
      <ResultWatchClient />
    </Suspense>
  );
}
