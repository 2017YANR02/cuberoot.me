export interface FittedGeometry {
  axis: number;
  params: number[];
  angles: number[];
  score: number;
  recovery_score_components?: { observation_loss: number; pose_prior_loss: number;
    active_layers: number; observation_count: number; reprojection_weight: number };
  flat_fallback: boolean;
  nearest: number[];
  valid: boolean[];
  [field: string]: unknown;
}

export interface FittedPose {
  bank: FittedGeometry[];
  wireframe: [number, number][][];
  wireframes?: [number, number][][][];
  wireframeFaces?: number[][];
  wireframeDepths?: number[][];
  pose: { rvec: number[]; tvec: number[] } | null;
  bootstrap: boolean;
  message: string;
  elapsedMs: number;
  stageMs?: Record<string,number>;
  workerQueueMs?: number;
  stage?: string;
  pipelineVersion?: string;
  pipelineAssets?:{rust:string;geometry:string;opencvWasm:string;opencvModule:string};
  sourceFrame?: number;
  pose_flag_reason?: string | null;
  pose_geometry_flag_reason?: string | null;
  continuity_core?: [number, number] | null;
  continuity_source_pose?: { rvec: number[]; tvec: number[] } | null;
  continuity_source_geometry_flag_reason?: string | null;
  final_bank_diagnostics?: { attempted_materializations: number; qualified_variants: number;
    selected_replacements: number };
  startup_reference_core?: [number, number] | null;
  startup_motion_allowance?: number;
  fittingConfig?: { segment: number; fps: number; turningStartFrame: number | null;
    sourceFps?:number;frameClock?:'camera_milliseconds';
    centers: { axis: number; side: number; color: string }[] };
}

export interface PoseObservations {
  width: number;
  height: number;
  observations: {
    points: [number, number][];
    classes: number[];
    stickers: [number, number][];
    uncertainties: number[];
  };
}
