'use client';

import { useT } from '@/hooks/useT';
import { PlatformState } from '@/components/platform/PlatformState';

export default function PlatformError({ reset }: { error: Error; reset: () => void }) {
  const t = useT();
  return <PlatformState kind="error" message={t('页面加载失败，请重试。', 'The page failed to load. Please try again.')} onRetry={reset} />;
}
