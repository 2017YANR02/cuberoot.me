'use client';

import { accountNavigationHref } from '@/lib/account-navigation';
import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { useLang } from '@/i18n/tr';

function LegacyHandbook() {
  const router = useRouter();
  const lang = useLang();
  const [section] = useQueryState('section', parseAsStringEnum(['onboarding', 'offboarding', 'sop']).withDefault('onboarding'));
  useEffect(() => {
    router.replace(accountNavigationHref(`${lang === 'zh' ? '/zh' : ''}/admin/team?section=${section}`, window.location.pathname + window.location.search));
  }, [lang, router, section]);
  return null;
}

export default function TeamPage() {
  return <Suspense><LegacyHandbook /></Suspense>;
}
