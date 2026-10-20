/** @deprecated Canonical runtime-neutral stage producer lives in shared timer. */
export {
  computeStageAverages,
  computeStageSegments,
  stageSegmentsFor,
  STAGE_SEGMENT_EVENTS,
  type StageAverages,
  type StageSegments,
} from '../stage-segments-producer';
export type { SolveMove } from '../types';
export { applyOneToken } from './apply-token';
