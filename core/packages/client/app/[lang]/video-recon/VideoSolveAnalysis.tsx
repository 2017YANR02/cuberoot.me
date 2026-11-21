import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import CubeOrientationSelect from '@/components/CubeOrientationSelect';
import { ReconNotationBlock } from '@/components/ReconNotationBlock';
import { Tooltip } from '@/components/Tooltip';
import { useCopy } from '@/hooks/useCopy';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { CUBE_OPPOSITE_FACE } from '@/lib/cube-colors';
import { buildCaptionHeader } from '@/lib/recon-stats';
import { buildReconSubmitQuery } from '@/lib/sim-recon-link';
import type { Quaternion } from '@/lib/video-recon/engine/cube-motion';
import { openingGripView } from '@/lib/video-recon/engine/cube-orientation';
import type { MoveStep } from '@/lib/video-recon/engine/move-search-types';
import type { MeasuredCubeFrame } from '@/lib/video-recon/engine/projected-cube';
import { timecode } from '@/lib/video-recon/engine/solve-range';
import {
  analyzeVideoSolve, observeVideoSolve, playerGrip, videoGripOptions, videoNotationTimeline, type VideoSolveObservation,
} from '@/lib/video-recon/solve-analysis';

interface Props {
  scramble: string;
  steps: readonly MoveStep[];
  measured: readonly MeasuredCubeFrame[];
  fps: number;
  start: number;
  end: number;
  position: number;
  onSeek: (timestamp: number) => void;
  onOpeningView: (view: Quaternion) => void;
}

type Analysis = Awaited<ReturnType<typeof analyzeVideoSolve>>;

export function VideoSolveAnalysis({ scramble, steps, measured, fps, start, end, position, onSeek, onOpeningView }: Props) {
  const t = useT();
  const language = useLang();
  const observation = useMemo(() => observeVideoSolve(scramble, steps, measured, fps, start, end),
    [scramble, steps, measured, fps, start, end]);
  const [confirmed, setConfirmed] = useState<{ observation: VideoSolveObservation; rotation: string }>();
  const selection = confirmed?.observation === observation ? confirmed.rotation : undefined;
  const grip = selection ?? observation.estimatedGrip?.rotation;
  const [analysis, setAnalysis] = useState<{
    observation: VideoSolveObservation; grip?: string; language: typeof language; value?: Analysis;
  }>();
  const { copiedKey, copy } = useCopy();
  const current = analysis?.observation === observation && analysis.grip === grip && analysis.language === language
    ? analysis : undefined;

  useEffect(() => {
    let active = true;
    void analyzeVideoSolve(observation, grip, language).then(value => {
      if (active) setAnalysis({ observation, grip, language, value });
    }, () => {
      if (active) setAnalysis({ observation, grip, language });
    });
    return () => { active = false; };
  }, [observation, grip, language]);

  const { result, method, solved, fallback } = current?.value ?? {};
  const relativeMs = Math.round((position - start) * 1000);
  const openingMs = Math.round(((observation.opening?.timestamp ?? start) - start) * 1000);
  const timeline = useMemo(() => result ? videoNotationTimeline(result, openingMs) : [], [result, openingMs]);
  const activeOffset = timeline.findLast(move => move.timestampMs <= relativeMs)?.offset ?? null;
  const displayMethod = method === 'roux' ? 'Roux' : method?.toUpperCase();
  const captionHeader = useMemo(() => result ? buildCaptionHeader(result.text, result.seconds, '3x3') : '', [result]);
  const clipboard = result ? [captionHeader, result.scramble, result.text].filter(Boolean).join('\n') : '';
  const copied = copiedKey === clipboard;
  const copyLabel = t('复制分段复盘', 'Copy stage breakdown');
  const editorHref = result && displayMethod && solved
    ? `/recon/submit?${buildReconSubmitQuery('3x3', result.scramble, result.text, { method: displayMethod })}`
    : undefined;
  function showOpeningView(rotation: string) {
    if (observation.opening) onOpeningView(openingGripView(observation.opening.pose.rotation, rotation));
  }
  return <div className="video-recon-notation">
    {observation.opening && observation.estimatedGrip ? (
      <OpeningGrip key={`${scramble}/${start}/${end}/${observation.opening.frame}`}
        initial={observation.estimatedGrip} accepted={selection} centers={observation.centers}
        onSelect={showOpeningView}
        onConfirm={rotation => {
          showOpeningView(rotation);
          setConfirmed({ observation, rotation });
        }} />
    ) : <span className="video-recon-muted">{t('起手姿态未拍清，按固定朝向分段。', 'The opening grip is unavailable. Stages use a fixed orientation.')}</span>}
    {!current && <ContentSkeleton variant="text" label={t('正在识别解法和分段…', 'Identifying the method and stages…')} />}
    {current && !result && <span role="status" className="video-recon-muted">{t('无法生成局面一致的分段复盘。', 'Could not generate a reconstruction consistent with the recognized states.')}</span>}
    {result && <>
      <strong>{t('分段复盘', 'Stage breakdown')} · {displayMethod}</strong>
      {fallback && <span className="video-recon-muted">{t('转体换算未通过局面核对，以下使用固定朝向。',
        'The reoriented moves failed state verification. The steps below use a fixed orientation.')}</span>}
      {!fallback && observation.uncertain.length > 0 && <details className="video-recon-muted">
        <summary>{t('有些区间的转体待核对', 'Some intervals need rotation review')}</summary>
        <div className="video-recon-actions">
          {observation.uncertain.map(({ startMs, endMs }, index) => (
            <button type="button" className="btn-secondary" key={index} onClick={() => onSeek(start + startMs / 1000)}>
              {timecode(startMs / 1000)}–{timecode(endMs / 1000)}
            </button>
          ))}
        </div>
      </details>}
      <div className="detail-scramble-solution">
        <ReconNotationBlock captionHeader={captionHeader} scramble={result.scramble} scrambleCubeOrder={3}
          displayScramble={result.scramble} solutionText={result.text} displayText={result.text} rawDisplayText={result.text}
          solve={{ event: '3x3' }} playback={{ offset: activeOffset, onSeek: offset => {
            const move = timeline.findLast(item => item.offset <= offset);
            onSeek(start + (move?.timestampMs ?? openingMs) / 1000);
          } }} />
      </div>
      <div className="video-recon-actions">
        <Tooltip content={copied ? t('已复制', 'Copied') : copyLabel}>{tip =>
          <button {...tip} type="button" className="btn-secondary" aria-label={copyLabel} onClick={() => copy(clipboard, clipboard)}>
            {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
          </button>
        }</Tooltip>
        {editorHref && <AppLink className="btn-secondary" href={editorHref}>
          <ExternalLink size={15} aria-hidden />{t('在复盘中编辑', 'Edit in Reconstruction')}
        </AppLink>}
        <span className="sr-only" role="status">{copied && t('已复制', 'Copied')}</span>
      </div>
    </>}
  </div>;
}

function OpeningGrip({ initial, accepted, centers, onSelect, onConfirm }: {
  initial: NonNullable<VideoSolveObservation['estimatedGrip']>;
  accepted?: string;
  centers: VideoSolveObservation['centers'];
  onSelect: (rotation: string) => void;
  onConfirm: (rotation: string) => void;
}) {
  const t = useT();
  const options = useMemo(() => videoGripOptions(centers), [centers]);
  const [selected, setSelected] = useState(initial);
  const value = options.find(option => option.grip.rotation === selected.rotation)?.value ?? '';
  return <div className="video-recon-actions">
    <div className="video-recon-inline-label">
      <span>{t('朝向', 'Orientation')}</span>
      <CubeOrientationSelect value={value} ariaLabel={t('起手朝向', 'Opening orientation')}
        onChange={next => {
          const grip = options.find(option => option.value === next)?.grip;
          if (grip) {
            setSelected(grip);
            onSelect(grip.rotation);
          }
        }} />
    </div>
    <button type="button" className="btn-secondary" disabled={accepted === selected.rotation}
      onClick={() => onConfirm(selected.rotation)}>{t('确认朝向', 'Confirm orientation')}</button>
    <button type="button" className="btn-secondary" onClick={() => {
      const opposite = playerGrip(selected.top, CUBE_OPPOSITE_FACE[selected.front]);
      if (!opposite) return;
      setSelected(opposite);
      onConfirm(opposite.rotation);
    }}>{t('前后转 180°（y2）', 'Turn 180° (y2)')}</button>
  </div>;
}
