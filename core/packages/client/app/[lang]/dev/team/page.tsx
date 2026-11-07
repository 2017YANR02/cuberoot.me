'use client';

import { Suspense, useEffect } from 'react';
import { useEntryRouter as useRouter } from '@/hooks/useEntryRouter';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { useLang } from '@/i18n/tr';

function LegacyHandbook() {
  const router = useRouter();
  const lang = useLang();
  const [section] = useQueryState('section', parseAsStringEnum(['onboarding', 'offboarding', 'sop']).withDefault('onboarding'));
  useEffect(() => {
    router.replace(`${lang === 'zh' ? '/zh' : ''}/admin/team?section=${section}`);
  }, [lang, router, section]);
  return null;
}

export default function TeamPage() {
  return <Suspense><LegacyHandbook /></Suspense>;
}
