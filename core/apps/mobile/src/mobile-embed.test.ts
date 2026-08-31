import { describe, expect, it } from 'vitest';
import {
  decodeMobileEmbedAuthRequest,
  decodeMobileEmbedAuthClear,
  decodeMobileEmbedBack,
  decodeMobileEmbedNavigation,
  decodeMobileEmbedWebSession,
  decodeMobileEmbedWebSessionResult,
  MOBILE_EMBED_FRAME_NAMES,
  mobileEmbedAuthRequestMessage,
  mobileEmbedAuthClearMessage,
  mobileEmbedBackMessage,
  mobileEmbedNavigationMessage,
  mobileEmbedWebSessionMessage,
  mobileEmbedWebSessionResultMessage,
  mobileEmbedSurfaceFromFrameName,
} from '@cuberoot/shared/mobile-embed';

const TICKET = 'T'.repeat(43);

describe('mobile embed navigation contract', () => {
  it('maps only the two named website surfaces', () => {
    expect(mobileEmbedSurfaceFromFrameName(MOBILE_EMBED_FRAME_NAMES.tools)).toBe('tools');
    expect(mobileEmbedSurfaceFromFrameName(MOBILE_EMBED_FRAME_NAMES.account)).toBe('account');
    expect(mobileEmbedSurfaceFromFrameName('other')).toBeNull();
  });

  it('round-trips navigation and back messages', () => {
    const navigation = mobileEmbedNavigationMessage('tools', 'https://cuberoot.me/zh/sim', 2);
    expect(decodeMobileEmbedNavigation(navigation)).toEqual(navigation);
    const back = mobileEmbedBackMessage('tools');
    expect(decodeMobileEmbedBack(back)).toEqual(back);
  });

  it('round-trips account auth and one-time web-session messages', () => {
    const auth = mobileEmbedAuthRequestMessage('wechat');
    expect(decodeMobileEmbedAuthRequest(auth)).toEqual(auth);
    const firstPartyAuth = mobileEmbedAuthRequestMessage();
    expect(decodeMobileEmbedAuthRequest(firstPartyAuth)).toEqual(firstPartyAuth);
    const clear = mobileEmbedAuthClearMessage();
    expect(decodeMobileEmbedAuthClear(clear)).toEqual(clear);
    const session = mobileEmbedWebSessionMessage(TICKET);
    expect(decodeMobileEmbedWebSession(session)).toEqual(session);
    const result = mobileEmbedWebSessionResultMessage(true);
    expect(decodeMobileEmbedWebSessionResult(result)).toEqual(result);
  });

  it('rejects malformed or negative navigation depth', () => {
    expect(decodeMobileEmbedNavigation({
      depth: -1,
      href: 'https://cuberoot.me/zh',
      surface: 'tools',
      type: 'cuberoot:mobile:navigation',
    })).toBeNull();
    expect(decodeMobileEmbedBack({ surface: 'other', type: 'cuberoot:mobile:back' })).toBeNull();
    expect(decodeMobileEmbedAuthRequest({
      provider: 'github',
      surface: 'account',
      type: 'cuberoot:mobile:auth-request',
    })).toBeNull();
    expect(decodeMobileEmbedWebSession({
      surface: 'account',
      ticket: 'short',
      type: 'cuberoot:mobile:web-session',
    })).toBeNull();
  });
});
