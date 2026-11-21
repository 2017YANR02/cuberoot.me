export interface PipelineFrame {
  frame:number;width:number;height:number;pixel_scale:number;
  observations:{points:[number,number][];classes:number[];stickers:[number,number][];uncertainties:number[]};
  landmark_presence:number[];colors:string[];
}
export interface PipelineGeometry {
  axis:number;params:number[];angles:number[];score:number;flat_fallback:boolean;nearest:number[];valid:boolean[];
  [field:string]:unknown;
}
export interface PipelinePose {
  bank:PipelineGeometry[];wireframe:[number,number][][];pose:{rvec:number[];tvec:number[]}|null;
  elapsedMs:number;bootstrap:boolean;message:string;stage:string;depth_recovery:boolean;
  stageMs?:Record<string,number>;workerQueueMs?:number;
  wireframes?:[number,number][][][];
  wireframeFaces?:number[][];wireframeDepths?:number[][];
  continuity_core?:[number,number]|null;pose_flag_reason?:string|null;
  continuity_source_pose?:{rvec:number[];tvec:number[]}|null;
  continuity_source_geometry_flag_reason?:string|null;
  final_bank_diagnostics?:{attempted_materializations:number;qualified_variants:number;selected_replacements:number};
  startup_reference_core?:[number,number]|null;startup_motion_allowance?:number;
}
export interface PipelineConfig {fps:number;turningStartFrame:number|null;centers:{axis:number;side:number;color:string}[]}
export class BufferedPosePipeline {
  constructor(execute:(job:Record<string,unknown>)=>Promise<Record<string,any>>,config:PipelineConfig);
  readonly ended:boolean;
  push(frame:PipelineFrame):Promise<PipelinePose>;
  flush():Promise<void>;
  cancel(error?:Error):void;
}
