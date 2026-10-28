'use client';

import { useEffect, useState } from 'react';
import { resolveWebMembershipCheckout } from '@cuberoot/shared/mobile-embed';
import { tr } from '@/i18n/tr';
import CubeRootLogo from '@/components/CubeRootLogo';
import '../membership.css';

/** Merchant-origin hop for H5 Referer, with no browser login or account-token transfer. */
export default function AppCheckoutPage() {
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const checkout = params.get('checkout');
    if (!checkout) {
      setInvalid(new URLSearchParams(window.location.search).get('returned') !== '1');
      return;
    }
    // allow-raw-history: consume the one-time cashier fragment synchronously before
    // navigation; nuqs only handles query state and must not retain this secret.
    // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
    window.history.replaceState(null, '', window.location.pathname + '?returned=1');
    const destination = resolveWebMembershipCheckout(checkout);
    if (!destination) { setInvalid(true); return; }
    window.location.replace(destination);
  }, []);

  return <main className="mem-page">
    <CubeRootLogo />
    <h1>{tr({ zh: '会员支付', en: 'Membership payment' })}</h1>
    <p role="status">{invalid
      ? tr({ zh: '支付链接无效，请返回 App 重新打开收银台。', en: 'Invalid payment link. Return to the app and reopen checkout.' })
      : tr({ zh: '完成或取消支付后，请关闭此窗口返回 CubeRoot，App 会查询支付结果。', en: 'After paying or cancelling, close this window to return to CubeRoot. The app will check your payment status.' })}</p>
  </main>;
}
