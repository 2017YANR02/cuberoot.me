'use client';

import { Crop, MoveHorizontal, MoveVertical, RotateCcw } from '@app-foundation/icons/lucide';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/components/Tooltip';
import type { VideoRotation } from '@/lib/video-tools/orientation';
import './video-tools.css';

export interface VideoImageTransform {
  rotation: VideoRotation;
  flipH: boolean;
  flipV: boolean;
}

export const INITIAL_VIDEO_TRANSFORM: VideoImageTransform = { rotation: 0, flipH: false, flipV: false };

export function videoImageTransformCss({ rotation, flipH, flipV }: VideoImageTransform) {
  return [rotation && `rotate(${rotation}deg)`, flipH && 'scaleX(-1)', flipV && 'scaleY(-1)'].filter(Boolean).join(' ');
}

const NEXT_ROTATION: Record<VideoRotation, VideoRotation> = { 0: 90, 90: 180, 180: 270, 270: 0 };

export function VideoImageTools({ transform, onTransform, onCrop, cropping, cropDisabled, disabled }: {
  transform: VideoImageTransform;
  onTransform: (next: VideoImageTransform) => void;
  onCrop: () => void;
  cropping?: boolean;
  cropDisabled?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { rotation, flipH, flipV } = transform;
  const actions = [
    { Icon: MoveVertical, label: t('frameCount.toolbar.flipV'), pressed: flipV, activate: () => onTransform({ ...transform, flipV: !flipV }) },
    { Icon: MoveHorizontal, label: t('frameCount.toolbar.flipH'), pressed: flipH, activate: () => onTransform({ ...transform, flipH: !flipH }) },
    { Icon: RotateCcw, label: t('frameCount.toolbar.rotate', { angle: rotation }), activate: () => onTransform({ ...transform, rotation: NEXT_ROTATION[rotation] }) },
    { Icon: Crop, label: t(cropping ? 'frameCount.toolbar.cropExit' : 'frameCount.toolbar.crop'), pressed: cropping, activate: onCrop, disabled: cropDisabled },
  ];
  return <div className="video-image-tools">
    {actions.map(({ Icon, label, pressed, activate, disabled: unavailable }) => (
      <Tooltip key={Icon.displayName ?? label} content={label}>{tip =>
        <button {...tip} type="button" className="video-image-tool" aria-label={label} aria-pressed={pressed}
          disabled={disabled || unavailable} onClick={activate}>
          <Icon size={16} aria-hidden />
        </button>
      }</Tooltip>
    ))}
  </div>;
}
