export const ADMISSION_CAPACITY:12;
export const SEARCH_CHUNK:128;
export const POLICY_VERSION:1;
export const CAMERA_CLOCK_HZ:1000;
export const MOVE_TPS_LIMIT:54;
export const TIMER_MOVE_TPS_LIMIT:40;
export function poseWorkerCount(cores?:number):number;
export interface SearchConfig {
  scramble:string;fps:number;max_tps:number;turning_start_frame:number|null;
  branch_widths:number[];branch_stage_expansions:number;state_limit:number;
  mismatch_window_weight:number;unrestricted_sticker_count:number|null;
  motion_cost_weight?:number;
  diagnostics?:boolean;
  bidirectional?:boolean;
  postprocess_identity_loops?:boolean;
  postprocess_color_tolerance?:number;
  postprocess_pose_cleanup?:boolean;
  pause_at_live_frontier?:boolean;expand_flagged_frames?:boolean;
  resolve_orientation_ambiguity?:boolean;max_rotation_tps?:number;
  source_origin_seconds?:number;source_end_seconds?:number;requested_start_seconds?:number;
  source_fps?:number;frame_clock?:'camera_milliseconds';
}
export function createSearchConfig(options:{scramble:string;fps?:number;camera?:boolean;openingHoldSeconds?:number;
  originSeconds?:number;startSeconds?:number;endSeconds?:number;motionCostWeight?:number;diagnostics?:boolean;bidirectional?:boolean;
  postprocessIdentityLoops?:boolean;postprocessColorTolerance?:number}):SearchConfig;
export function videoFrameIdentity(timestamp:number,config:Pick<SearchConfig,'fps'|'source_origin_seconds'>):{sourceFrame:number;sequence:number};
