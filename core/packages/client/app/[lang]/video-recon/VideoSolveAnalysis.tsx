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
import { encodeUrlAlg } from '@/lib/cubedb-url';
import { deriveScrambleFromSolution } from '@/lib/scramble-from-solution';
import { buildReconSubmitQuery } from '@/lib/sim-recon-link';
import { checkReconCompletion } from '@cuberoot/shared/recon-completion';
import type { Quaternion } from '@/lib/video-recon/engine/cube-motion';
import { openingGripView } from '@/lib/video-recon/engine/cube-orientation';
import type { MoveStep } from '@/lib/video-recon/engine/move-search-types';
import type { MeasuredCubeFrame } from '@/lib/video-recon/engine/projected-cube';
import { timecode } from '@/lib/video-recon/engine/solve-range';
import {
  analyzeVideoSolve, matchVideoOpeningScramble, observeVideoSolve, playerGrip, videoGripOptions, videoNotationTimeline, type VideoSolveObservation,
} from '@/lib/video-recon/solve-analysis';

export interface VerifiedVideoDraft {
  solution: string;
  inferredScramble?: string;
}

export interface VideoSolveAnalysisProps {
  scramble: string;
  steps: readonly MoveStep[];
  measured: readonly MeasuredCubeFrame[];
  fps: number;
  clockFps?: number;
  start: number;
  end: number;
  position: number;
  onSeek: (timestamp: number) => void;
  onOpeningView: (view: Quaternion) => void;
  inferredScramble?: boolean;
  draftTarget?: {
    scramble: string;
    onReady: (draft: VerifiedVideoDraft) => void;
    onApply: (draft: VerifiedVideoDraft) => void;
  };
}

type Analysis = Awaited<ReturnType<typeof analyzeVideoSolve>>;

export function VideoSolveAnalysis({ scramble, steps, measured, fps, clockFps, start, end, position, onSeek, onOpeningView, draftTarget, inferredScramble }: VideoSolveAnalysisProps) {
  const t = useT();
  const language = useLang();
  const observation = useMemo(() => observeVideoSolve(scramble, steps, measured, fps, start, end, clockFps),
    [scramble, steps, measured, fps, start, end, clockFps]);
  const [openingSelection, setOpeningSelection] = useState<{ observation: VideoSolveObservation; rotation: string }>();
  const selection = openingSelection?.observation === observation ? openingSelection.rotation : undefined;
  const grip = selection ?? observation.estimatedGrip?.rotation;
  const [analysis, setAnalysis] = useState<{
    observation: VideoSolveObservation; grip?: string; language: typeof language; value?: Analysis;
    draftScramble?: string; draft?: VerifiedVideoDraft; inferred?: boolean; verifiedInferredScramble?: string;
  }>();
  const { copiedKey, copy } = useCopy();
  const draftScramble = draftTarget?.scramble;
  const current = analysis?.observation === observation && analysis.grip === grip && analysis.language === language
    && analysis.draftScramble === draftScramble && analysis.inferred === inferredScramble
    ? analysis : undefined;

  useEffect(() => {
    let active = true;
    void analyzeVideoSolve(observation, grip, language).then(async value => {
      let draft: VerifiedVideoDraft | undefined;
      let verifiedInferredScramble: string | undefined;
      const solution = value?.result.text;
      // analyzeVideoSolve replays raw turns and checks every published stage against them.
      // Verify that exact stage notation against the original state before deriving any replacement scramble.
      const original = inferredScramble ? observation.scramble : draftScramble;
      if (active && value?.solved && solution?.trim() && original) {
        const completion = await checkReconCompletion({ event: '3x3', scramble: original, solution });
        if (completion.status === 'solved' && active) {
          if (inferredScramble) {
            verifiedInferredScramble = original;
            try {
              const candidate = await deriveScrambleFromSolution(solution);
              if (active) verifiedInferredScramble = await matchVideoOpeningScramble(original, candidate);
            } catch { /* The recognized opening already passed verification. */ }
            if (draftScramble === '') draft = { solution, inferredScramble: verifiedInferredScramble };
          } else if (draftScramble) {
            draft = { solution };
          }
        }
      }
      if (active) setAnalysis({ observation, grip, language, value, draftScramble, draft, inferred: inferredScramble, verifiedInferredScramble });
    }).catch(() => {
      if (active) setAnalysis({ observation, grip, language, draftScramble, inferred: inferredScramble });
    });
    return () => { active = false; };
  }, [observation, grip, language, draftScramble, inferredScramble]);

  const verifiedDraft = current?.draft;
  const onDraftReady = draftTarget?.onReady;
  useEffect(() => {
    if (verifiedDraft) onDraftReady?.(verifiedDraft);
  }, [verifiedDraft, onDraftReady]);

  const { result, method, solved, fallback } = current?.value ?? {};
  const relativeMs = Math.round((position - start) * 1000);
  const openingMs = Math.round(((observation.opening?.timestamp ?? start) - start) * 1000);
  const timeline = useMemo(() => result ? videoNotationTimeline(result, openingMs) : [], [result, openingMs]);
  const activeOffset = timeline.findLast(move => move.timestampMs <= relativeMs)?.offset ?? null;
  const displayMethod = method === 'roux' ? 'Roux' : method?.toUpperCase();
  const displayScramble = current?.verifiedInferredScramble ?? result?.scramble ?? '';
  const captionHeader = useMemo(() => result ? buildCaptionHeader(result.text, result.seconds, '3x3') : '', [result]);
  const clipboard = result ? [captionHeader, displayScramble, result.text].filter(Boolean).join('\n') : '';
  const copied = copiedKey === clipboard;
  const copyLabel = t('复制分段复盘', 'Copy stage breakdown');
  let editorHref: string | undefined;
  if (!draftTarget && result && displayScramble && displayMethod && solved && (!inferredScramble || current?.verifiedInferredScramble)) {
    const params = new URLSearchParams(buildReconSubmitQuery('3x3', inferredScramble ? '' : displayScramble, result.text, { method: displayMethod }));
    if (inferredScramble) params.set('generic', encodeUrlAlg(displayScramble));
    editorHref = `/recon/submit?${params}`;
  }
  function applyOpeningGrip(rotation: string) {
    if (observation.opening) onOpeningView(openingGripView(observation.opening.pose.rotation, rotation));
    setOpeningSelection({ observation, rotation });
  }
  return <div className="video-recon-notation">
    {observation.opening && observation.estimatedGrip ? (
      <OpeningGrip key={`${scramble}/${start}/${end}/${observation.opening.frame}`}
        initial={observation.estimatedGrip} rotation={selection} centers={observation.centers}
        onSelect={applyOpeningGrip} />
    ) : <span className="video-recon-muted">{t('起手姿态未拍清，按固定朝向分段。', 'The opening grip is unavailable. Stages use a fixed orientation.')}</span>}
    {!current && <ContentSkeleton variant="text" label={t('正在识别解法和分段…', 'Identifying the method and stages…')} />}
    {current && !result && <span role="status" className="video-recon-muted">{t('无法生成局面一致的分段复盘。', 'Could not generate a reconstruction consistent with the recognized states.')}</span>}
    {draftTarget && solved && !verifiedDraft && <span role="status" className="video-recon-muted">
      {t('这份解法与打乱未通过还原校验。', 'The scramble and solution could not be verified together.')}
    </span>}
    {result && <>
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
      {inferredScramble && <span className="video-recon-muted">{t('推定打乱', 'Inferred scramble')}</span>}
      <div className="detail-scramble-solution">
        <ReconNotationBlock captionHeader={captionHeader} scramble={displayScramble} scrambleCubeOrder={3}
          displayScramble={displayScramble} solutionText={result.text} displayText={result.text} rawDisplayText={result.text}
          solve={{ event: '3x3' }} playback={{ offset: activeOffset, onSeek: offset => {
            const move = timeline.findLast(item => item.offset <= offset);
            onSeek(start + (move?.timestampMs ?? openingMs) / 1000);
          } }} />
      </div>
      <div className="video-recon-actions">
        <Tooltip content={copied ? t('已复制', 'Copied') : copyLabel}>{tip =>
          <button {...tip} type="button" className="playback-bar-btn" aria-label={copyLabel} onClick={() => copy(clipboard, clipboard)}>
            {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
          </button>
        }</Tooltip>
        {editorHref && <AppLink className="btn-secondary" href={editorHref}>
          <ExternalLink size={15} aria-hidden />{t('在复盘中编辑', 'Edit in Reconstruction')}
        </AppLink>}
        {draftTarget && verifiedDraft && <button type="button" className="btn-primary" onClick={() => draftTarget.onApply(verifiedDraft)}>
          {t('使用这份解法', 'Use this solution')}
        </button>}
        <span className="sr-only" role="status">{copied && t('已复制', 'Copied')}</span>
      </div>
    </>}
  </div>;
}

function OpeningGrip({ initial, rotation, centers, onSelect }: {
  initial: NonNullable<VideoSolveObservation['estimatedGrip']>;
  rotation?: string;
  centers: VideoSolveObservation['centers'];
  onSelect: (rotation: string) => void;
}) {
  const t = useT();
  const options = useMemo(() => videoGripOptions(centers), [centers]);
  const choice = options.find(option => option.grip.rotation === (rotation ?? initial.rotation));
  const selected = choice?.grip ?? initial;
  const label = t('起手朝向', 'Opening orientation');
  return <div className="video-recon-actions">
    <div className="video-recon-inline-label">
      <span>{label}</span>
      <CubeOrientationSelect value={choice?.value ?? ''} ariaLabel={label} layout="grid"
        onChange={next => {
          const grip = options.find(option => option.value === next)?.grip;
          if (grip) onSelect(grip.rotation);
        }} />
    </div>
    <button type="button" className="btn-secondary" aria-label={t('前后转 180°（y2）', 'Turn 180° (y2)')} onClick={() => {
      const opposite = playerGrip(selected.top, CUBE_OPPOSITE_FACE[selected.front]);
      if (opposite) onSelect(opposite.rotation);
    }}>y2</button>
  </div>;
}
