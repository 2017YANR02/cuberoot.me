import {
  isMobileAuthProvider,
  isWebSessionTicket,
  type MobileAuthProvider,
} from './auth/web_session';
import { decodeAppearancePreferences, type AppearancePreferences } from './appearance';

export * from './installed_ble';
export * from './web_membership';

export const MOBILE_EMBED_FRAME_NAMES = {
  account: 'cuberoot-mobile-account',
  tools: 'cuberoot-mobile-tools',
} as const;

export const MOBILE_EMBED_NO_GENERATIVE_AI_FRAME_NAMES = {
  account: 'cuberoot-mobile-account-no-generative-ai',
  tools: 'cuberoot-mobile-tools-no-generative-ai',
} as const;

export type MobileEmbedSurface = keyof typeof MOBILE_EMBED_FRAME_NAMES;

export interface MobileEmbedChrome {
  insetByHost?: true;
  toolsSearch?: { expanded: boolean };
  top?: { left: number; right: number };
  bottom: number;
}

export interface MobileEmbedInitMessage {
  surface: MobileEmbedSurface;
  type: 'cuberoot:mobile:init';
  authProviders?: readonly MobileAuthProvider[];
  accountManagement?: boolean;
  appleMembership?: boolean;
  googleMembership?: boolean;
  webMembership?: boolean;
  bluetooth?: boolean;
  shellNavigation?: boolean;
  inlineAccountSettings?: boolean;
  appearance?: AppearancePreferences;
  chrome?: MobileEmbedChrome;
}

export interface MobileEmbedAppearanceMessage {
  surface: MobileEmbedSurface;
  type: 'cuberoot:mobile:appearance';
  preferences: AppearancePreferences;
}

export function mobileEmbedAppearanceMessage(surface: MobileEmbedSurface, preferences: AppearancePreferences): MobileEmbedAppearanceMessage {
  return { surface, type: 'cuberoot:mobile:appearance', preferences };
}

export function decodeMobileEmbedAppearance(value: unknown): MobileEmbedAppearanceMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedAppearanceMessage>;
  const preferences = decodeAppearancePreferences(candidate.preferences);
  if (candidate.type !== 'cuberoot:mobile:appearance'
    || (candidate.surface !== 'tools' && candidate.surface !== 'account') || !preferences) return null;
  return mobileEmbedAppearanceMessage(candidate.surface, preferences);
}

export interface MobileEmbedSelectTabMessage {
  surface: MobileEmbedSurface;
  type: 'cuberoot:mobile:select-tab';
  tab: 'timer' | 'tools' | 'account';
}

export interface MobileEmbedOpenSettingsMessage {
  surface: MobileEmbedSurface;
  type: 'cuberoot:mobile:open-settings';
  category: 'appearance';
}

export function mobileEmbedSelectTabMessage(surface: MobileEmbedSurface, tab: MobileEmbedSelectTabMessage['tab']): MobileEmbedSelectTabMessage {
  return { surface, type: 'cuberoot:mobile:select-tab', tab };
}

export function mobileEmbedOpenSettingsMessage(surface: MobileEmbedSurface): MobileEmbedOpenSettingsMessage {
  return { surface, type: 'cuberoot:mobile:open-settings', category: 'appearance' };
}

export function decodeMobileEmbedSelectTab(value: unknown): MobileEmbedSelectTabMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedSelectTabMessage>;
  if (candidate.type !== 'cuberoot:mobile:select-tab'
    || (candidate.surface !== 'tools' && candidate.surface !== 'account')
    || (candidate.tab !== 'timer' && candidate.tab !== 'tools' && candidate.tab !== 'account')) return null;
  return mobileEmbedSelectTabMessage(candidate.surface, candidate.tab);
}

export function decodeMobileEmbedOpenSettings(value: unknown): MobileEmbedOpenSettingsMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedOpenSettingsMessage>;
  if (candidate.type !== 'cuberoot:mobile:open-settings'
    || (candidate.surface !== 'tools' && candidate.surface !== 'account')
    || candidate.category !== 'appearance') return null;
  return mobileEmbedOpenSettingsMessage(candidate.surface);
}

export interface MobileEmbedAccountManageMessage {
  surface: 'account';
  type: 'cuberoot:mobile:account-manage';
  provider: 'apple';
  intent: 'link';
  expectedUid: number;
  requestId: string;
}

export interface MobileEmbedAccountManageResultMessage {
  surface: 'account';
  type: 'cuberoot:mobile:account-manage-result';
  requestId: string;
  ok: boolean;
}

export interface MobileEmbedNavigationMessage {
  usesChrome?: true;
  inlineAccountSettings?: true;
  depth: number;
  href: string;
  surface: MobileEmbedSurface;
  type: 'cuberoot:mobile:navigation';
}

export interface MobileEmbedBackMessage {
  surface: MobileEmbedSurface;
  type: 'cuberoot:mobile:back';
}

export interface MobileEmbedAuthRequestMessage {
  provider: MobileAuthProvider | null;
  surface: 'account';
  type: 'cuberoot:mobile:auth-request';
}

export interface MobileEmbedAuthClearMessage {
  surface: 'account';
  type: 'cuberoot:mobile:auth-clear';
}

export interface MobileEmbedWebSessionMessage {
  requestId?: string;
  surface: 'account';
  ticket: string;
  type: 'cuberoot:mobile:web-session';
}

export interface MobileEmbedWebSessionResultMessage {
  ok: boolean;
  requestId?: string;
  surface: 'account';
  type: 'cuberoot:mobile:web-session-result';
}

export interface MobileEmbedExternalMessage {
  href: string;
  surface: MobileEmbedSurface;
  type: 'cuberoot:mobile:external';
}

export function mobileEmbedSurfaceFromFrameName(value: string): MobileEmbedSurface | null {
  if (value === MOBILE_EMBED_FRAME_NAMES.tools || value === MOBILE_EMBED_NO_GENERATIVE_AI_FRAME_NAMES.tools) return 'tools';
  if (value === MOBILE_EMBED_FRAME_NAMES.account || value === MOBILE_EMBED_NO_GENERATIVE_AI_FRAME_NAMES.account) return 'account';
  return null;
}

export function mobileEmbedDisablesGenerativeAi(value: string): boolean {
  return value === MOBILE_EMBED_NO_GENERATIVE_AI_FRAME_NAMES.tools
    || value === MOBILE_EMBED_NO_GENERATIVE_AI_FRAME_NAMES.account;
}

export function mobileEmbedNavigationMessage(
  surface: MobileEmbedSurface,
  href: string,
  depth: number,
  usesChrome?: boolean,
  inlineAccountSettings?: boolean,
): MobileEmbedNavigationMessage {
  return {
    depth: Number.isSafeInteger(depth) && depth >= 0 ? depth : 0,
    href,
    surface,
    type: 'cuberoot:mobile:navigation',
    ...(usesChrome ? { usesChrome: true } : {}),
    ...(surface === 'account' && inlineAccountSettings ? { inlineAccountSettings: true } : {}),
  };
}

export function mobileEmbedBackMessage(surface: MobileEmbedSurface): MobileEmbedBackMessage {
  return { surface, type: 'cuberoot:mobile:back' };
}

export function mobileEmbedInitMessage(
  surface: MobileEmbedSurface,
  capabilities?: Pick<MobileEmbedInitMessage, 'authProviders' | 'accountManagement' | 'appleMembership' | 'googleMembership' | 'webMembership' | 'bluetooth' | 'shellNavigation' | 'appearance' | 'chrome' | 'inlineAccountSettings'>,
): MobileEmbedInitMessage {
  return { surface, type: 'cuberoot:mobile:init', ...capabilities };
}

export function mobileEmbedAccountManageMessage(expectedUid: number, requestId: string): MobileEmbedAccountManageMessage {
  return { surface: 'account', type: 'cuberoot:mobile:account-manage', provider: 'apple', intent: 'link', expectedUid, requestId };
}

export function mobileEmbedAccountManageResultMessage(ok: boolean, requestId: string): MobileEmbedAccountManageResultMessage {
  return { surface: 'account', type: 'cuberoot:mobile:account-manage-result', requestId, ok };
}

export function mobileEmbedAuthRequestMessage(
  provider: MobileAuthProvider | null = null,
): MobileEmbedAuthRequestMessage {
  return { provider, surface: 'account', type: 'cuberoot:mobile:auth-request' };
}

export function mobileEmbedAuthClearMessage(): MobileEmbedAuthClearMessage {
  return { surface: 'account', type: 'cuberoot:mobile:auth-clear' };
}

export function mobileEmbedWebSessionMessage(
  ticket: string,
  requestId: string,
): MobileEmbedWebSessionMessage {
  return requestId
    ? { requestId, surface: 'account', ticket, type: 'cuberoot:mobile:web-session' }
    : { surface: 'account', ticket, type: 'cuberoot:mobile:web-session' };
}

export function mobileEmbedWebSessionResultMessage(
  ok: boolean,
  requestId: string | undefined,
): MobileEmbedWebSessionResultMessage {
  return requestId
    ? { ok, requestId, surface: 'account', type: 'cuberoot:mobile:web-session-result' }
    : { ok, surface: 'account', type: 'cuberoot:mobile:web-session-result' };
}

export function mobileEmbedExternalMessage(
  surface: MobileEmbedSurface,
  href: string,
): MobileEmbedExternalMessage {
  return { href, surface, type: 'cuberoot:mobile:external' };
}

export function isMobileEmbedExternalHref(href: string): boolean {
  if (href.length > 2_048) return false;
  try {
    const protocol = new URL(href).protocol;
    return protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:';
  } catch {
    return false;
  }
}

export function decodeMobileEmbedNavigation(value: unknown): MobileEmbedNavigationMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedNavigationMessage>;
  if (candidate.type !== 'cuberoot:mobile:navigation'
    || (candidate.surface !== 'tools' && candidate.surface !== 'account')
    || typeof candidate.href !== 'string'
    || (candidate.usesChrome !== undefined && candidate.usesChrome !== true)
    || (candidate.inlineAccountSettings !== undefined && (candidate.surface !== 'account' || candidate.inlineAccountSettings !== true))
    || !Number.isSafeInteger(candidate.depth)
    || (candidate.depth ?? -1) < 0) {
    return null;
  }
  return candidate as MobileEmbedNavigationMessage;
}

export function decodeMobileEmbedBack(value: unknown): MobileEmbedBackMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedBackMessage>;
  if (candidate.type !== 'cuberoot:mobile:back'
    || (candidate.surface !== 'tools' && candidate.surface !== 'account')) {
    return null;
  }
  return candidate as MobileEmbedBackMessage;
}

function isMobileEmbedInset(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 512;
}

function isMobileEmbedChrome(value: unknown): value is MobileEmbedChrome {
  if (!value || typeof value !== 'object') return false;
  const { top, bottom, insetByHost, toolsSearch } = value as Partial<MobileEmbedChrome>;
  return (insetByHost === undefined || insetByHost === true) && isMobileEmbedInset(bottom)
    && (top === undefined || Boolean(top && isMobileEmbedInset(top.left) && isMobileEmbedInset(top.right)))
    && (toolsSearch === undefined || Boolean(toolsSearch && typeof toolsSearch.expanded === 'boolean'));
}

export function decodeMobileEmbedInit(value: unknown): MobileEmbedInitMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedInitMessage>;
  if (candidate.type !== 'cuberoot:mobile:init'
    || (candidate.surface !== 'tools' && candidate.surface !== 'account')
    || (candidate.authProviders !== undefined && (!Array.isArray(candidate.authProviders)
      || !candidate.authProviders.every(isMobileAuthProvider)
      || new Set(candidate.authProviders).size !== candidate.authProviders.length))
    || (candidate.appleMembership !== undefined && typeof candidate.appleMembership !== 'boolean')
    || (candidate.googleMembership !== undefined && typeof candidate.googleMembership !== 'boolean')
    || (candidate.webMembership !== undefined && typeof candidate.webMembership !== 'boolean')
    || (candidate.bluetooth !== undefined && typeof candidate.bluetooth !== 'boolean')
    || (candidate.shellNavigation !== undefined && typeof candidate.shellNavigation !== 'boolean')
    || (candidate.inlineAccountSettings !== undefined && (candidate.surface !== 'account' || typeof candidate.inlineAccountSettings !== 'boolean'))
    || (candidate.appearance !== undefined && !decodeAppearancePreferences(candidate.appearance))
    || (candidate.chrome !== undefined && !isMobileEmbedChrome(candidate.chrome))
    || (candidate.accountManagement !== undefined && typeof candidate.accountManagement !== 'boolean')) {
    return null;
  }
  return { ...candidate, ...(candidate.appearance ? { appearance: decodeAppearancePreferences(candidate.appearance)! } : {}) } as MobileEmbedInitMessage;
}

export function decodeMobileEmbedAccountManage(value: unknown): MobileEmbedAccountManageMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedAccountManageMessage>;
  if (candidate.type !== 'cuberoot:mobile:account-manage' || candidate.surface !== 'account'
    || candidate.provider !== 'apple' || candidate.intent !== 'link'
    || !Number.isSafeInteger(candidate.expectedUid) || (candidate.expectedUid ?? 0) <= 0
    || !isMobileEmbedRequestId(candidate.requestId)) return null;
  return mobileEmbedAccountManageMessage(candidate.expectedUid!, candidate.requestId);
}

export function decodeMobileEmbedAccountManageResult(value: unknown): MobileEmbedAccountManageResultMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedAccountManageResultMessage>;
  if (candidate.type !== 'cuberoot:mobile:account-manage-result' || candidate.surface !== 'account'
    || typeof candidate.ok !== 'boolean' || !isMobileEmbedRequestId(candidate.requestId)) return null;
  return mobileEmbedAccountManageResultMessage(candidate.ok, candidate.requestId);
}

export function decodeMobileEmbedAuthRequest(value: unknown): MobileEmbedAuthRequestMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedAuthRequestMessage>;
  if (candidate.type !== 'cuberoot:mobile:auth-request'
    || candidate.surface !== 'account'
    || (candidate.provider !== null && !isMobileAuthProvider(candidate.provider))) {
    return null;
  }
  return candidate as MobileEmbedAuthRequestMessage;
}

export function decodeMobileEmbedAuthClear(value: unknown): MobileEmbedAuthClearMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedAuthClearMessage>;
  if (candidate.type !== 'cuberoot:mobile:auth-clear' || candidate.surface !== 'account') {
    return null;
  }
  return candidate as MobileEmbedAuthClearMessage;
}

export function decodeMobileEmbedWebSession(value: unknown): MobileEmbedWebSessionMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedWebSessionMessage>;
  if (candidate.type !== 'cuberoot:mobile:web-session'
    || candidate.surface !== 'account'
    || (candidate.requestId !== undefined && !isMobileEmbedRequestId(candidate.requestId))
    || !isWebSessionTicket(candidate.ticket)) {
    return null;
  }
  return candidate as MobileEmbedWebSessionMessage;
}

export function decodeMobileEmbedWebSessionResult(
  value: unknown,
): MobileEmbedWebSessionResultMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedWebSessionResultMessage>;
  if (candidate.type !== 'cuberoot:mobile:web-session-result'
    || candidate.surface !== 'account'
    || (candidate.requestId !== undefined && !isMobileEmbedRequestId(candidate.requestId))
    || typeof candidate.ok !== 'boolean') {
    return null;
  }
  return candidate as MobileEmbedWebSessionResultMessage;
}

export function decodeMobileEmbedExternal(value: unknown): MobileEmbedExternalMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedExternalMessage>;
  if (candidate.type !== 'cuberoot:mobile:external'
    || (candidate.surface !== 'tools' && candidate.surface !== 'account')
    || typeof candidate.href !== 'string'
    || !isMobileEmbedExternalHref(candidate.href)) {
    return null;
  }
  return candidate as MobileEmbedExternalMessage;
}

function isMobileEmbedRequestId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128;
}
