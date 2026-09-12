/** Compatibility entry; the website and installed clients use one implementation. */
export {
  computeStageAverages,
  computeStageSegments,
  stageSegmentsFor,
  STAGE_SEGMENT_EVENTS,
  type SolveMove,
  type StageAverages,
  type StageSegments,
} from '@cuberoot/shared/timer';
export { applyOneToken } from '@cuberoot/shared/timer/reconstruct/apply-token';
