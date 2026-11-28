import { useCallback, useEffect, useMemo, useState } from 'react';
import i18n from 'i18next';

import type { SegmentBase, StateSegment, UpdateSegAtIndex } from '../types';
import type { HandleError } from '../contexts';


export const FRAME_COUNT_TAG_INPUT = 'framecount.inputTime';
export const FRAME_COUNT_TAG_FPS = 'framecount.fps';
export const FRAME_COUNT_TAG_INDEX = 'framecount.solveIndex';


export interface FrameCountSolve {
  segment: StateSegment,
  index: number, // index in cutSegments
  solveIndex: number, // from tag, 1-based, monotonic per file
  inputTime: number, // seconds (as displayed on timer)
  fps: number,
  startTime: number,
  stopTime: number,
}


export function isFrameCountSegment(segment: { tags?: Record<string, string> | undefined }) {
  return segment.tags?.[FRAME_COUNT_TAG_INPUT] != null;
}


// WCA-style truncation to centiseconds: 0.688 → 0.68, 1.077 → 1.07.
// (Times are *truncated*, not rounded, per WCA Regulations 9f.)
function truncToCentiseconds(n: number): number {
  return Math.floor(n * 100) / 100;
}

// Extracts a solve time from a filename like "1 0.688.mp4" → 0.68,
// or "2x2 R1 1.07 avg.mp4" → 1.07. Returns the first decimal-bearing
// number with a 1–3 digit integer part in the basename (extension stripped),
// truncated to centiseconds.
export function parseSolveTimeFromFilename(pathOrName: string): number | undefined {
  const fname = pathOrName.replaceAll('\\', '/').split('/').at(-1) ?? pathOrName;
  const lastDot = fname.lastIndexOf('.');
  const stem = lastDot > 0 ? fname.slice(0, lastDot) : fname;
  const m = /(\d{1,3}):(\d{1,2}\.\d+)/.exec(stem);
  if (m && m[1] != null && m[2] != null) {
    const mins = Number(m[1]);
    const secs = Number(m[2]);
    if (Number.isFinite(mins) && Number.isFinite(secs)) {
      const total = mins * 60 + secs;
      if (total > 0 && total < 3600) return truncToCentiseconds(total);
    }
  }
  const d = /\d{1,3}\.\d+/.exec(stem);
  if (!d) return undefined;
  const n = Number(d[0]);
  return Number.isFinite(n) && n > 0 && n < 3600 ? truncToCentiseconds(n) : undefined;
}


function parseInputTimeString(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // accept "1.07", "01.07", or "mm:ss.ss"
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length !== 2) return undefined;
    const m = Number(parts[0]);
    const s = Number(parts[1]);
    if (!Number.isFinite(m) || !Number.isFinite(s)) return undefined;
    return m * 60 + s;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}


export default function useFrameCount({
  enabled,
  filePath,
  getRelevantTime,
  detectedFps,
  cutSegments,
  loadCutSegments,
  removeSegment,
  updateSegAtIndex,
  fileDuration,
  seekAbs,
  handleError,
}: {
  enabled: boolean,
  filePath: string | undefined,
  getRelevantTime: () => number,
  detectedFps: number | undefined,
  cutSegments: StateSegment[],
  loadCutSegments: (opts: {
    segments: SegmentBase[],
    append: boolean,
    clampDuration?: number,
    getNextCurrentSegIndex?: (newEdl: SegmentBase[]) => number,
  }) => void,
  removeSegment: (index: number, wholeSegment?: true) => void,
  updateSegAtIndex: UpdateSegAtIndex,
  fileDuration: number | undefined,
  seekAbs: (val: number | undefined) => void,
  handleError: HandleError,
}) {
  const [inputTimeStr, setInputTimeStr] = useState('');

  useEffect(() => {
    if (!filePath) return;
    const parsed = parseSolveTimeFromFilename(filePath);
    if (parsed != null) setInputTimeStr(String(parsed));
  }, [filePath]);

  const solves = useMemo<FrameCountSolve[]>(() => (
    cutSegments.flatMap((segment, index) => {
      const { tags } = segment;
      if (!tags || tags[FRAME_COUNT_TAG_INPUT] == null) return [];
      const inputTime = Number(tags[FRAME_COUNT_TAG_INPUT]);
      const fps = Number(tags[FRAME_COUNT_TAG_FPS]);
      const solveIndex = Number(tags[FRAME_COUNT_TAG_INDEX]);
      if (!Number.isFinite(inputTime) || !Number.isFinite(fps) || !Number.isFinite(solveIndex)) return [];
      const startTime = segment.start;
      const stopTime = segment.end ?? segment.start;
      return [{ segment, index, solveIndex, inputTime, fps, startTime, stopTime }];
    })
  ), [cutSegments]);

  const nextSolveIndex = useMemo<number>(() => (
    solves.reduce<number>((max, s) => Math.max(max, s.solveIndex), 0) + 1
  ), [solves]);

  const addSolve = useCallback(() => {
    if (!enabled) return;
    try {
      const inputTime = parseInputTimeString(inputTimeStr);
      if (inputTime == null) {
        throw new Error(i18n.t('Please enter the solve time (seconds) first, e.g. 1.07'));
      }
      const fps = detectedFps;
      if (fps == null || !Number.isFinite(fps) || fps <= 0) {
        throw new Error(i18n.t('Could not detect video frame rate; open a video first'));
      }
      const stopTime = getRelevantTime();
      const framesBack = Math.round(inputTime * fps);
      const startTime = Math.max(0, stopTime - framesBack / fps);

      const newSolveIndex = nextSolveIndex;
      const name = `Solve ${newSolveIndex} (${inputTime}s)`;
      // loadCutSegments' segment type doesn't statically declare `tags`, but
      // tags are honored at runtime (createSegment forwards them through).
      const segmentWithTags = {
        start: startTime,
        end: stopTime,
        name,
        tags: {
          [FRAME_COUNT_TAG_INPUT]: String(inputTime),
          [FRAME_COUNT_TAG_FPS]: String(fps),
          [FRAME_COUNT_TAG_INDEX]: String(newSolveIndex),
        },
      };
      loadCutSegments({
        segments: [segmentWithTags as SegmentBase],
        append: true,
        ...(fileDuration != null && { clampDuration: fileDuration }),
        getNextCurrentSegIndex: (edl) => edl.length - 1,
      });
      seekAbs(startTime);
      setInputTimeStr('');
    } catch (err) {
      handleError({ err, title: i18n.t('Failed to add solve') });
    }
  }, [enabled, inputTimeStr, detectedFps, getRelevantTime, nextSolveIndex, loadCutSegments, fileDuration, seekAbs, handleError]);

  const removeSolve = useCallback((solveIndex: number) => {
    const idx = cutSegments.findIndex((s) => s.tags?.[FRAME_COUNT_TAG_INDEX] === String(solveIndex));
    if (idx !== -1) removeSegment(idx, true);
  }, [cutSegments, removeSegment]);

  const updateSolveTime = useCallback((solveIndex: number, newInputTimeStr: string) => {
    try {
      const newInputTime = parseInputTimeString(newInputTimeStr);
      if (newInputTime == null) {
        throw new Error(i18n.t('Please enter a valid solve time'));
      }
      const idx = cutSegments.findIndex((s) => s.tags?.[FRAME_COUNT_TAG_INDEX] === String(solveIndex));
      if (idx === -1) return;
      const seg = cutSegments[idx];
      if (!seg || seg.end == null || !seg.tags) return;
      const fps = Number(seg.tags[FRAME_COUNT_TAG_FPS]);
      if (!Number.isFinite(fps) || fps <= 0) return;
      const stopTime = seg.end;
      const framesBack = Math.round(newInputTime * fps);
      const newStart = Math.max(0, stopTime - framesBack / fps);
      updateSegAtIndex(idx, {
        start: newStart,
        name: `Solve ${solveIndex} (${newInputTime}s)`,
        tags: { ...seg.tags, [FRAME_COUNT_TAG_INPUT]: String(newInputTime) },
      });
    } catch (err) {
      handleError({ err, title: i18n.t('Failed to update solve') });
    }
  }, [cutSegments, updateSegAtIndex, handleError]);

  return {
    inputTimeStr,
    setInputTimeStr,
    solves,
    nextSolveIndex,
    addSolve,
    removeSolve,
    updateSolveTime,
  };
}
