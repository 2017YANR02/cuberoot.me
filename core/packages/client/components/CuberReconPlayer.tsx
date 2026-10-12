'use client';

import { useMemo, useState, type ComponentProps } from 'react';
import SharedCuberReconPlayer from '@cuberoot/timer-ui/CuberReconPlayer';
import { PlaybackAnchorSelect, PlaybackBackViewButton } from './PlaybackBar';
import StickeringSelect from '@/app/[lang]/sim/StickeringSelect';
import { useSimMasks } from '@/app/[lang]/sim/useSimMasks';
import { isPresetMask, presetMaskFn } from '@/app/[lang]/sim/engine/nxn/maskConfig';
import { tr } from '@/i18n/tr';
import '@/app/[lang]/sim/player-controls.css';
export * from '@cuberoot/timer-ui/CuberReconPlayer';

type Props = ComponentProps<typeof SharedCuberReconPlayer> & { showPlaybackOptions?: boolean };

/** Only the full reconstruction pane opts into the simulator's extra controls. */
export default function CuberReconPlayer({ showPlaybackOptions, ...props }: Props) {
  return showPlaybackOptions && !props.hideControls
    ? <CuberWithOptions {...props} />
    : <SharedCuberReconPlayer {...props} />;
}

function CuberWithOptions(props: ComponentProps<typeof SharedCuberReconPlayer>) {
  const [stage, setStage] = useState('full');
  const [orientation, setOrientation] = useState('');
  const [anchor, setAnchor] = useState<boolean | null>(null);
  const [backView, setBackView] = useState(props.backView ?? true);
  const { rows } = useSimMasks();
  const mask = useMemo(() => isPresetMask(stage) ? presetMaskFn(props.order, stage, rows) : undefined, [stage, rows, props.order]);
  return <SharedCuberReconPlayer {...props}
    anchorAtEnd={anchor ?? props.anchorAtEnd} backView={backView}
    stickering={stage} stickeringOrientation={orientation} stickeringOverride={mask}
    leadingControls={!props.mirror && <StickeringSelect puzzleKind={props.order as 2 | 3 | 4 | 5 | 6 | 7}
      value={stage} onChange={setStage} orientation={orientation} onOrientationChange={isPresetMask(stage) ? undefined : setOrientation} editable={false} />}
    trailingControls={<>
      <PlaybackAnchorSelect atEnd={anchor ?? props.anchorAtEnd ?? false} onChange={setAnchor}
        label={tr({ zh: '锚点:回放固定打乱起点还是解法终点', en: 'Anchor: keep the scramble start or the solve end fixed' })}
        startLabel={tr({ zh: '锚定起点', en: 'Anchored at start' })} endLabel={tr({ zh: '锚定终点', en: 'Anchored at end' })} />
      <PlaybackBackViewButton visible={backView} onClick={() => setBackView(value => !value)}
        showLabel={tr({ zh: '显示小窗', en: 'Show back view' })} hideLabel={tr({ zh: '关闭小窗', en: 'Hide back view' })} />
    </>}
    controlLabels={{
      skipStart: tr({ zh: '回到起点', en: 'Skip to start' }), stepBack: tr({ zh: '上一步', en: 'Step back' }),
      play: tr({ zh: '播放', en: 'Play' }), pause: tr({ zh: '暂停', en: 'Pause' }),
      stepForward: tr({ zh: '下一步', en: 'Step forward' }), skipEnd: tr({ zh: '跳到末尾', en: 'Skip to end' }),
      scrub: tr({ zh: '拖动播放进度', en: 'Scrub playback' }),
    }} />;
}
