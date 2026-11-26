'use client';

import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { useT } from '@/hooks/useT';
import { RegistrationConsent as SharedRegistrationConsent } from '@cuberoot/app-ui/account-forms';

function PolicyLinks() {
  const t = useT();
  return <>
    <AppLink href="/terms" target="_blank" rel="noopener noreferrer">{t('《用户协议》', 'User Agreement')}</AppLink>
    {t('及', ' and ')}
    <AppLink href="/privacy" target="_blank" rel="noopener noreferrer">{t('《隐私政策》', 'Privacy Policy')}</AppLink>
  </>;
}

export default function RegistrationConsent({ busy, onCreate }: { busy: boolean; onCreate: (accepted: true) => void }) {
  const t = useT();
  return <SharedRegistrationConsent busy={busy} onCreate={onCreate} links={<PolicyLinks />} t={t} Toggle={BoolToggle} />;
}
