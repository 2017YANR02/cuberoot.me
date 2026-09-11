import type { WebSession } from '@cuberoot/shared/auth/web-session';
import type { MobileEmbedAccountManageMessage } from '@cuberoot/shared/mobile-embed';

/** Shorter than the embedded page's 15-second acknowledgement deadline. */
export const ACCOUNT_MANAGEMENT_OPEN_TIMEOUT_MS = 10_000;

/** Never transfer a session for linking: the Browser authenticates independently. */
export async function openInstalledAccountManagement(
  request: MobileEmbedAccountManageMessage,
  accountUrl: string,
  dependencies: {
    currentSession(): WebSession | null;
    openExternal(href: string): Promise<void>;
  },
): Promise<void> {
  const startingSession = dependencies.currentSession();
  if (!startingSession || startingSession.user.uid !== request.expectedUid) throw new Error('account changed');
  const account = new URL(accountUrl);
  if (account.origin !== 'https://cuberoot.me') throw new Error('invalid account origin');
  account.search = new URLSearchParams({ view: 'signin', link_provider: request.provider, expected_uid: String(request.expectedUid) }).toString();
  account.hash = '';
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      dependencies.openExternal(account.href),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('account browser open timed out')), ACCOUNT_MANAGEMENT_OPEN_TIMEOUT_MS);
      }),
    ]);
    if (dependencies.currentSession()?.user.uid !== request.expectedUid) throw new Error('account changed');
  } finally {
    clearTimeout(timeout);
  }
}
