import {
  decodeIdentityChoicePending,
  decodeWebSession,
  MOBILE_AUTH_PROVIDERS,
  type MobileAuthProvider,
  type PendingIdentity,
} from '@cuberoot/shared/auth/web-session';
import type { SupportedLanguage } from '../copy';

import { mobileApiUrl } from '../data/api-url';

export class InstalledAccountChoiceRequired extends Error {
  constructor(readonly pending: PendingIdentity) { super('ACCOUNT_CHOICE_REQUIRED'); }
}

export async function accountRequest(
  path: string,
  language: SupportedLanguage,
  options: { body?: object; token?: string; signal?: AbortSignal } = {},
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, 15_000);
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  try {
    const response = await fetch(mobileApiUrl(`/v1/auth${path}`), {
      method: options.body ? 'POST' : 'GET',
      headers: {
        'Accept-Language': language === 'zh' ? 'zh-CN' : 'en',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
    });
    const body = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (controller.signal.aborted) throw new DOMException('Request canceled', 'AbortError');
    if (!response.ok) {
      const pending = response.status === 409 ? decodeIdentityChoicePending(body) : null;
      if (pending) throw new InstalledAccountChoiceRequired(pending);
      throw new Error(typeof body?.error === 'string' ? body.error : `HTTP ${response.status}`);
    }
    return body;
  } catch (error) {
    if (!options.signal?.aborted && (controller.signal.aborted || error instanceof TypeError)) {
      throw new Error('account service unavailable');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}

export async function credentialSession(
  path: string,
  language: SupportedLanguage,
  body: object,
  signal: AbortSignal,
  token?: string,
) {
  const result = await accountRequest(path, language, { body, signal, token });
  const session = decodeWebSession(result);
  if (!session) throw new Error('invalid account session');
  return { ...session, isNew: result?.isNew === true };
}

export async function installedAuthProviders(language: SupportedLanguage, signal: AbortSignal) {
  const data = await accountRequest('/providers', language, { signal });
  const social = data?.social as Record<string, unknown> | undefined;
  const available = (provider: MobileAuthProvider) => {
    if (provider === 'wca') return data?.wca === true;
    if (provider === 'apple') return data?.apple === true;
    if (provider === 'google') return Boolean(data?.googleClientId && data?.googleRelayUrl);
    return Boolean(social?.[provider]);
  };
  return { email: data?.email === true, phone: data?.phone === true, social: MOBILE_AUTH_PROVIDERS.filter(available) };
}
