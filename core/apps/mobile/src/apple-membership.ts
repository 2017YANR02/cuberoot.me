import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { mobileApiUrl } from '@cuberoot/app-ui';
import { createAppleMembershipHandler, type NativeAppleMembership } from '@cuberoot/app-ui/apple-membership';
import { nativeMobileAuth } from './mobile-auth';

interface AppleMembershipPlugin extends NativeAppleMembership {
  addListener(event: 'transactionAvailable', listener: () => void): Promise<PluginListenerHandle>;
}

const native = registerPlugin<AppleMembershipPlugin>('AppleMembership');

export const handleAppleMembership = createAppleMembershipHandler({
  apiBase: mobileApiUrl('/v1/membership/apple'),
  native,
  restoreSession: () => nativeMobileAuth.restore(),
  sandboxOnly: import.meta.env.VITE_APPLE_IAP_SANDBOX_ONLY === '1',
});

export function listenForAppleMembership(listener: () => void) {
  return native.addListener('transactionAvailable', listener);
}
