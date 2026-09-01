import { describe, expect, it } from 'vitest';
import {
  decodeMobileEmbedAuthRequest,
  decodeMobileEmbedAuthClear,
  decodeMobileEmbedBack,
  decodeMobileEmbedExternal,
  decodeMobileEmbedInit,
  decodeMobileEmbedNavigation,
  decodeMobileEmbedWebSession,
  decodeMobileEmbedWebSessionResult,
  MOBILE_EMBED_FRAME_NAMES,
  mobileEmbedAuthRequestMessage,
  mobileEmbedAuthClearMessage,
  mobileEmbedBackMessage,
  mobileEmbedExternalMessage,
  mobileEmbedInitMessage,
  mobileEmbedNavigationMessage,
  mobileEmbedWebSessionMessage,
  mobileEmbedWebSessionResultMessage,
  mobileEmbedSurfaceFromFrameName,
} from '@cuberoot/shared/mobile-embed';

const TICKET = 'T'.repeat(43);
const REQUEST_ID = 'request-1234';

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
    const init = mobileEmbedInitMessage('tools');
    expect(decodeMobileEmbedInit(init)).toEqual(init);
    const external = mobileEmbedExternalMessage('tools', 'https://github.com/2017YANR02');
    expect(decodeMobileEmbedExternal(external)).toEqual(external);
  });

  it('round-trips account auth and one-time web-session messages', () => {
    const auth = mobileEmbedAuthRequestMessage('wechat');
    expect(decodeMobileEmbedAuthRequest(auth)).toEqual(auth);
    const firstPartyAuth = mobileEmbedAuthRequestMessage();
    expect(decodeMobileEmbedAuthRequest(firstPartyAuth)).toEqual(firstPartyAuth);
    const clear = mobileEmbedAuthClearMessage();
    expect(decodeMobileEmbedAuthClear(clear)).toEqual(clear);
    const session = mobileEmbedWebSessionMessage(TICKET, REQUEST_ID);
    expect(decodeMobileEmbedWebSession(session)).toEqual(session);
    const result = mobileEmbedWebSessionResultMessage(true, REQUEST_ID);
    expect(decodeMobileEmbedWebSessionResult(result)).toEqual(result);
    expect(decodeMobileEmbedWebSession({
      surface: 'account',
      ticket: TICKET,
      type: 'cuberoot:mobile:web-session',
    })).toEqual({
      surface: 'account',
      ticket: TICKET,
      type: 'cuberoot:mobile:web-session',
    });
    expect(decodeMobileEmbedWebSessionResult({
      ok: true,
      surface: 'account',
      type: 'cuberoot:mobile:web-session-result',
    })).toEqual({
      ok: true,
      surface: 'account',
      type: 'cuberoot:mobile:web-session-result',
    });
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
      requestId: REQUEST_ID,
      surface: 'account',
      ticket: 'short',
      type: 'cuberoot:mobile:web-session',
    })).toBeNull();
    expect(decodeMobileEmbedExternal({
      href: 'javascript:alert(1)',
      surface: 'tools',
      type: 'cuberoot:mobile:external',
    })).toBeNull();
    expect(decodeMobileEmbedExternal({
      href: 'blob:https://cuberoot.me/cube-image',
      surface: 'tools',
      type: 'cuberoot:mobile:external',
    })).toBeNull();
  });
});
