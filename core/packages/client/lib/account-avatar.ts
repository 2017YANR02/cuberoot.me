import {
  getAccountAvatarPreset,
  DEFAULT_CLAWD_AVATAR_PRESET,
  isClawdAvatarPreset,
  type AvatarSource,
  type ClawdAvatarPresetId,
} from '@cuberoot/shared/account-avatar';
import { installedPetAvailable } from '@/lib/installed-content';


export interface ResolvedAccountAvatar {
  src: string;
  isClawd: boolean;
}

export function clawdAvatarUrl(preset: ClawdAvatarPresetId): string {
  const item = getAccountAvatarPreset(preset) ?? getAccountAvatarPreset(DEFAULT_CLAWD_AVATAR_PRESET)!;
  if (!installedPetAvailable(item.petId)) return '/icons/CubeRoot.png';
  return item.src;
}

export function resolveAccountAvatar(
  avatarUrl: string | null | undefined,
  avatarPreset: string | null | undefined,
  avatarSource?: AvatarSource,
): ResolvedAccountAvatar {
  if (!installedPetAvailable(getAccountAvatarPreset(avatarPreset)?.petId ?? 'clawd') && (avatarSource === 'clawd' || !avatarUrl || /\/deskpet\/clawd[^/]*\.svg(?:[?#]|$)/.test(avatarUrl))) {
    return { src: '/icons/CubeRoot.png', isClawd: false };
  }
  if (avatarSource === 'clawd' || (!avatarUrl && isClawdAvatarPreset(avatarPreset))) {
    const preset = isClawdAvatarPreset(avatarPreset)
      ? avatarPreset
      : DEFAULT_CLAWD_AVATAR_PRESET;
    return { src: clawdAvatarUrl(preset), isClawd: getAccountAvatarPreset(preset)?.petId === 'clawd' };
  }
  if (avatarUrl) return { src: avatarUrl, isClawd: false };
  return { src: clawdAvatarUrl(DEFAULT_CLAWD_AVATAR_PRESET), isClawd: true };
}
