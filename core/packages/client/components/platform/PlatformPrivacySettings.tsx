'use client';

import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import type { PlatformRouteDefinition } from '@/lib/platform-types';

export function PlatformPrivacySettings(_props: { definition: PlatformRouteDefinition }) {
  const t = useT();
  return <section className="platform-domain-form platform-domain-content">
    <AppLink href="/privacy" prefetch={false}>{t('隐私政策', 'Privacy policy')}</AppLink>
  </section>;
}
