import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Copy, ExternalLink } from '@app-foundation/icons/lucide';
import type { CubeFace } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import AppLink from '@/components/AppLink';
import { ReconNotationBlock } from '@/components/ReconNotationBlock';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { CUBE_OPPOSITE_FACE } from '@/lib/cube-colors';
import { buildCaptionHeader } from '@/lib/recon-stats';
import { buildReconSubmitQuery } from '@/lib/sim-recon-link';
import type { CubeColor } from '@/lib/video-recon/engine/cube-colors';
import type { MoveStep } from '@/lib/video-recon/engine/move-search-types';
import type { MeasuredCubeFrame } from '@/lib/video-recon/engine/projected-cube';
import { timecode } from '@/lib/video-recon/engine/solve-range';
import {
  analyzeVideoSolve, observeVideoSolve, playerGrip, videoNotationTimeline, VIDEO_FACES, type VideoSolveObservation,
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
}

const colorNames: Record<CubeColor, { zh: string; en: string }> = {
  white: { zh: '白', en: 'White' },
  yellow: { zh: '黄', en: 'Yellow' },
  red: { zh: '红', en: 'Red' },
  orange: { zh: '橙', en: 'Orange' },
  blue: { zh: '蓝', en: 'Blue' },
  green: { zh: '绿', en: 'Green' },
};

type Analysis = Awaited<ReturnType<typeof analyzeVideoSolve>>;

export function VideoSolveAnalysis({ scramble, steps, measured, fps, start, end, position, onSeek }: Props) {
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
  const [copied, setCopied] = useState<{ text: string; ok: boolean }>();
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
  const editorHref = result && displayMethod && solved
    ? `/recon/submit?${buildReconSubmitQuery('3x3', result.scramble, result.text, { method: displayMethod })}`
    : undefined;
  const option = (face: CubeFace) => {
    const color = observation.centers.get(face);
    const name = color ? colorNames[color] : undefined;
    return <option key={face} value={face}>{name ? t(name.zh, name.en) : face}</option>;
  };

  return <div className="video-recon-notation">
    {observation.opening && observation.estimatedGrip ? (
      <OpeningGrip key={`${scramble}/${start}/${end}/${observation.opening.frame}`}
        initial={observation.estimatedGrip} accepted={selection} option={option}
        onPreview={() => onSeek(observation.opening!.timestamp)}
        onConfirm={rotation => setConfirmed({ observation, rotation })} />
    ) : <span className="video-recon-muted">{t('起手姿态未拍清，按固定朝向分段。', 'The opening grip is unavailable. Stages use a fixed orientation.')}</span>}
    {!current && <span role="status" className="video-recon-muted">{t('正在识别解法和分段…', 'Identifying the method and stages…')}</span>}
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
      <span className="video-recon-muted">{t('时间按视频帧估算。', 'Timing is estimated from video frames.')}</span>
      <div className="video-recon-actions">
        <button type="button" className="btn-secondary" onClick={async () => {
          try { await navigator.clipboard.writeText(clipboard); setCopied({ text: clipboard, ok: true }); }
          catch { setCopied({ text: clipboard, ok: false }); }
        }}><Copy size={15} aria-hidden />{t('复制分段复盘', 'Copy stage breakdown')}</button>
        {editorHref && <AppLink className="btn-secondary" href={editorHref}>
          <ExternalLink size={15} aria-hidden />{t('在复盘中编辑', 'Edit in Reconstruction')}
        </AppLink>}
        <span role="status">{copied?.text === clipboard && (copied.ok ? t('已复制', 'Copied') : t('无法复制', 'Could not copy'))}</span>
      </div>
    </>}
  </div>;
}

function OpeningGrip({ initial, accepted, option, onPreview, onConfirm }: {
  initial: NonNullable<VideoSolveObservation['estimatedGrip']>;
  accepted?: string;
  option: (face: CubeFace) => ReactNode;
  onPreview: () => void;
  onConfirm: (rotation: string) => void;
}) {
  const t = useT();
  const [top, setTop] = useState(initial.top);
  const [front, setFront] = useState(initial.front);
  const fronts = VIDEO_FACES.filter(face => playerGrip(top, face));
  const selectedFront = fronts.includes(front) ? front : fronts[0];
  const selected = playerGrip(top, selectedFront)!;
  return <>
    <span className="video-recon-muted">{accepted === undefined
      ? t('按选手视角确认视频开头的顶面和前面。当前是相机视角的估计。',
        'Confirm the top and front faces from the solver’s view at the start. The current selection is a camera-based estimate.')
      : t('已确认选手起手视角。', 'Solver’s opening grip confirmed.')}</span>
    <div className="video-recon-actions">
      <label className="video-recon-inline-label">{t('顶面', 'Top face')}
        <select value={top} onChange={event => setTop(event.target.value as CubeFace)}>{VIDEO_FACES.map(option)}</select>
      </label>
      <label className="video-recon-inline-label">{t('前面', 'Front face')}
        <select value={selectedFront} onChange={event => setFront(event.target.value as CubeFace)}>{fronts.map(option)}</select>
      </label>
      <button type="button" className="btn-secondary" onClick={onPreview}>{t('看起手帧', 'View opening frame')}</button>
      <button type="button" className="btn-secondary" disabled={accepted === selected.rotation}
        onClick={() => onConfirm(selected.rotation)}>{t('确认视角', 'Confirm grip')}</button>
      <button type="button" className="btn-secondary" onClick={() => {
        const opposite = CUBE_OPPOSITE_FACE[selectedFront];
        setFront(opposite);
        onConfirm(playerGrip(top, opposite)!.rotation);
      }}>{t('前后转 180°（y2）', 'Turn 180° (y2)')}</button>
    </div>
  </>;
}
