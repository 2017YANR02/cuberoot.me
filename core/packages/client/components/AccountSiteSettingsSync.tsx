'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { startAccountSiteSettings } from '@/lib/account-site-settings';

export default function AccountSiteSettingsSync() {
  const router = useRouter();
  useEffect(() => startAccountSiteSettings(path => router.replace(path, { scroll: false })), [router]);
  return null;
}
