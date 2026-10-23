'use client';

import { useMemo, useState, type ComponentProps } from 'react';
import SharedCuberReconPlayer from '@cuberoot/timer-ui/CuberReconPlayer';
import { PlaybackBackViewButton } from './PlaybackBar';
import StickeringSelect from '@/app/[lang]/sim/StickeringSelect';
import { useSimMasks } from '@/app/[lang]/sim/useSimMasks';
import { isPresetMask, presetMaskFn } from '@/app/[lang]/sim/engine/nxn/maskConfig';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { reconPlaybackOrientation } from '@/lib/recon-alg-utils';
import '@/app/[lang]/sim/player-controls.css';
import './cuber-recon-player.css';
export * from '@cuberoot/timer-ui/CuberReconPlayer';

type Props = ComponentProps<typeof SharedCuberReconPlayer> & { showPlaybackOptions?: boolean; reconText?: string };

/** Only the full reconstruction pane opts into the simulator's extra controls. */
export default function CuberReconPlayer({ showPlaybackOptions, reconText, ...props }: Props) {
  return showPlaybackOptions && !props.hideControls
    ? <CuberWithOptions {...props} reconText={reconText} />
    : <SharedCuberReconPlayer {...props} />;
}

function CuberWithOptions({ reconText, ...props }: ComponentProps<typeof SharedCuberReconPlayer> & { reconText?: string }) {
  const [stage, setStage] = useState('full');
  const text = reconText ?? props.alg;
  const source = `${props.scramble}\n${text}`;
  const automaticOrientation = useMemo(() => reconPlaybackOrientation(text), [text]);
  const [manualOrientation, setManualOrientation] = useState<{ source: string; value: string } | null>(null);
  const orientation = manualOrientation?.source === source ? manualOrientation.value : automaticOrientation;
  const setOrientation = (value: string) => setManualOrientation({ source, value });
  const [backView, setBackView] = useState(props.backView ?? true);
  const { rows } = useSimMasks();
  const mask = useMemo(() => isPresetMask(stage) ? presetMaskFn(props.order, stage, rows) : undefined, [stage, rows, props.order]);
  return <div className="cuber-recon-preview">
    <SharedCuberReconPlayer {...props}
    backView={backView}
    stickering={stage} stickeringOrientation={orientation} stickeringOverride={mask}
    leadingControls={!props.mirror && <StickeringSelect puzzleKind={props.order as 2 | 3 | 4 | 5 | 6 | 7}
      value={stage} onChange={setStage} orientation={orientation} onOrientationChange={isPresetMask(stage) ? undefined : setOrientation} editable={false} />}
    trailingControls={<span className="cuber-recon-backview-control">
      <PlaybackBackViewButton visible={backView} onClick={() => setBackView(value => !value)}
        showLabel={tr({ zh: '显示小窗', en: 'Show back view' })} hideLabel={tr({ zh: '关闭小窗', en: 'Hide back view' })} />
    </span>}
    controlLabels={{
      skipStart: tr({ zh: '回到起点', en: 'Skip to start' }), stepBack: tr({ zh: '上一步', en: 'Step back' }),
      play: tr({ zh: '播放', en: 'Play' }), pause: tr({ zh: '暂停', en: 'Pause' }),
      stepForward: tr({ zh: '下一步', en: 'Step forward' }), skipEnd: tr({ zh: '跳到末尾', en: 'Skip to end' }),
      scrub: tr({ zh: '拖动播放进度', en: 'Scrub playback' }),
    }} />
    {!props.mirror && props.scramble.trim() && <div className="cuber-recon-scramble-net"
      role="img" aria-label={tr({ zh: '打乱平面展开图', en: 'Scramble net' })}>
      <ScramblePreview2D event={String(props.order).repeat(3)} scramble={props.scramble} size={44} />
    </div>}
  </div>;
}
