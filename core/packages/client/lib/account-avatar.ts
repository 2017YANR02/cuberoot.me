import {
  CLAWD_AVATAR_PRESETS,
  DEFAULT_CLAWD_AVATAR_PRESET,
  isClawdAvatarPreset,
  type AvatarSource,
  type ClawdAvatarPresetId,
} from '@cuberoot/shared/account-avatar';

const CLAWD_FILE_BY_PRESET = new Map<string, string>(
  CLAWD_AVATAR_PRESETS.map((preset) => [preset.id, preset.file]),
);

export interface ResolvedAccountAvatar {
  src: string;
  isClawd: boolean;
}

export function clawdAvatarUrl(preset: ClawdAvatarPresetId): string {
  const file = CLAWD_FILE_BY_PRESET.get(preset)
    ?? CLAWD_FILE_BY_PRESET.get(DEFAULT_CLAWD_AVATAR_PRESET)!;
  return `/deskpet/${file}`;
}

export function resolveAccountAvatar(
  avatarUrl: string | null | undefined,
  avatarPreset: string | null | undefined,
  avatarSource?: AvatarSource,
): ResolvedAccountAvatar {
  if (avatarSource === 'clawd' || (!avatarUrl && isClawdAvatarPreset(avatarPreset))) {
    const preset = isClawdAvatarPreset(avatarPreset)
      ? avatarPreset
      : DEFAULT_CLAWD_AVATAR_PRESET;
    return { src: clawdAvatarUrl(preset), isClawd: true };
  }
  if (avatarUrl) return { src: avatarUrl, isClawd: false };
  return { src: clawdAvatarUrl(DEFAULT_CLAWD_AVATAR_PRESET), isClawd: true };
}
