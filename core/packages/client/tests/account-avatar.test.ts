import { describe, expect, it } from 'vitest';
import {
  CLAWD_AVATAR_PRESETS,
  isAvatarSource,
  isClawdAvatarPreset,
} from '@cuberoot/shared/account-avatar';
import { decodeWebSessionUser } from '@cuberoot/shared/auth/web-session';
import { resolveAccountAvatar } from '@/lib/account-avatar';

describe('account avatar contract', () => {
  it('keeps the Clawd gallery as one validated canonical list', () => {
    expect(CLAWD_AVATAR_PRESETS).toHaveLength(21);
    expect(new Set(CLAWD_AVATAR_PRESETS.map((preset) => preset.id)).size).toBe(21);
    expect(CLAWD_AVATAR_PRESETS.every((preset) => isClawdAvatarPreset(preset.id))).toBe(true);
    expect(isClawdAvatarPreset('not-a-real-clawd')).toBe(false);
    expect(isAvatarSource('auto')).toBe(true);
    expect(isAvatarSource('remote-url')).toBe(false);
  });

  it('uses idle Clawd when a non-WCA account has no avatar', () => {
    expect(resolveAccountAvatar('', null, 'auto')).toEqual({
      src: '/deskpet/clawd-idle-look.svg',
      isClawd: true,
    });
  });

  it('prefers the verified WCA or uploaded URL when one is present', () => {
    expect(resolveAccountAvatar('https://example.test/avatar.png', null, 'auto')).toEqual({
      src: 'https://example.test/avatar.png',
      isClawd: false,
    });
  });

  it('accepts legacy sessions but rejects invalid source and preset combinations', () => {
    const legacy = { uid: 1, wcaId: null, name: 'Old', avatar: '' };
    expect(decodeWebSessionUser(legacy)).toEqual({
      ...legacy,
      avatarSource: 'auto',
      avatarPreset: null,
    });
    expect(decodeWebSessionUser({
      ...legacy,
      avatarSource: 'clawd',
      avatarPreset: 'typing',
    })?.avatarPreset).toBe('typing');
    expect(decodeWebSessionUser({
      ...legacy,
      avatarSource: 'clawd',
      avatarPreset: null,
    })).toBeNull();
    expect(decodeWebSessionUser({
      ...legacy,
      avatarSource: 'upload',
      avatarPreset: 'typing',
    })).toBeNull();
  });
});
