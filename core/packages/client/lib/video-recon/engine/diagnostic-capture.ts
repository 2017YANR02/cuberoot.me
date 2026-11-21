import type { DetectionRecording } from './detection-recording';
import type { MoveSearchResult } from './move-search-types';
import { RECONSTRUCTION_TIMEOUT_MS } from './move-search-types';

type Capture = ReturnType<DetectionRecording['toJSON']>;

export function searchSummary(result: MoveSearchResult | undefined) {
  if (!result) return;
  return {
    status: result.status,
    pipelineVersion: result.pipelineVersion,
    solved_frame_index: result.solved_frame_index,
    steps: result.steps.map(step => ({
      frame_index: step.frame_index,
      geometry_option_index: step.geometry_option_index,
      state_moves: step.state_moves,
      orientation_symmetry_index: step.orientation_symmetry_index,
      pose_flagged: step.pose_flagged,
    })),
  };
}

/** Raw observations and exact run provenance are sufficient to refit and search.
 * Keep the small operation journal: frame arrival/expansion order matters for
 * forward search and reproducing the last candidate at a timeout. Never export
 * fitted banks, render meshes, candidate states, or search frontiers. */
export function compactDetectionCapture(capture: Capture) {
  return {
    version: capture.version,
    format: 'replay-inputs',
    revision: capture.revision,
    startedAt: capture.startedAt,
    reconstructionTimeoutMs: RECONSTRUCTION_TIMEOUT_MS,
    confidenceFields: capture.confidenceFields,
    sources: capture.sources,
    frames: capture.frames.map(row => {
      const frame = row.result, fit = frame.fittedPose;
      return {
        sequence: row.sequence, sourceId: row.sourceId, segment: row.segment,
        timestampSeconds: row.timestampSeconds, backend: row.backend,
        settings: row.settings, runId: row.runId,
        result: {
          detections: frame.detections, transform: frame.transform,
          inputCrop: frame.inputCrop,
          detectorHashes: frame.detectorHashes,
          cube: frame.cube, roi: frame.roi, roiSource: frame.roiSource,
          trackingLost: frame.trackingLost, fittingError: frame.fittingError,
          inferenceMs: frame.inferenceMs, bboxMs: frame.bboxMs,
          poseMs: frame.poseMs, totalMs: frame.totalMs,
          profile: frame.profile, pipeline: frame.pipeline,
          // Retain fitting provenance in its existing location for replay tools.
          fittedPose: fit ? {
            sourceFrame: fit.sourceFrame, fittingConfig: fit.fittingConfig,
            pipelineVersion: fit.pipelineVersion, pipelineAssets: fit.pipelineAssets,
          } : undefined,
        },
      };
    }),
    runs: capture.runs.map(run => ({
      id: run.id, sourceId: run.sourceId, config: run.config,
      metadata: run.metadata, frameSequences: run.frameSequences,
      error: run.error, result: searchSummary(run.result), actions: run.actions,
    })),
  };
}
