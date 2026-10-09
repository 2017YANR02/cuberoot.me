import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PET_GALLERY } from '@/lib/deskpet-gallery';
import { describe, expect, it } from 'vitest';
import {
  CLAWD_AVATAR_PRESETS, ACCOUNT_AVATAR_PRESETS,
  isAvatarSource,
  isClawdAvatarPreset,
} from '@cuberoot/shared/account-avatar';
import { decodeWebSessionUser } from '@cuberoot/shared/auth/web-session';
import { resolveAccountAvatar } from '@/lib/account-avatar';

describe('account avatar contract', () => {
  it('covers every gallery asset with a valid, unique, existing avatar and preserves legacy IDs', () => {
    const paths = new Set(ACCOUNT_AVATAR_PRESETS.map(p => p.sourceSrc));
    for (const group of PET_GALLERY) for (const anim of group.anims) {
      const src = anim.src ?? group.base + anim.file + (group.v ? '?v=' + group.v : '');
      expect(paths.has(src), src).toBe(true);
    }
    expect(new Set(ACCOUNT_AVATAR_PRESETS.map(p => p.id)).size).toBe(ACCOUNT_AVATAR_PRESETS.length);
    for (const preset of ACCOUNT_AVATAR_PRESETS) {
      expect(preset.id.length).toBeLessThanOrEqual(32);
      expect(isClawdAvatarPreset(preset.id)).toBe(true);
      expect(existsSync(resolve('public', '.' + preset.src.split('?')[0])), preset.src).toBe(true);
      expect(resolveAccountAvatar('', preset.id, 'clawd').src).toBe(preset.src);
      if (preset.petId === 'cloudling') {
        const svg = readFileSync(resolve('public', '.' + preset.src.split('?')[0]), 'utf8');
        expect(svg).not.toContain('<script');
        expect(svg).not.toContain('<lineargradient');
        expect(svg).toContain('<svg');
      }
    }
  });
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
      isAdmin: false,
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
    expect(decodeWebSessionUser({ ...legacy, isAdmin: 'yes' })).toBeNull();
  });
});
