'use client';
import SharedCubeColorChip, { type CubeColorChipProps } from '@cuberoot/timer-ui/CubeColorChip';
import { tr } from '@/i18n/tr';
export * from '@cuberoot/timer-ui/CubeColorChip';
export default function CubeColorChip(props: CubeColorChipProps) {
  return <SharedCubeColorChip {...props} localize={tr} />;
}
