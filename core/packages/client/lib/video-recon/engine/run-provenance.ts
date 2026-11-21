import {videoFrameIdentity,POLICY_VERSION} from '../pose-fitter/runtime/reconstruction-policy.mjs';
import type {MoveSearchConfig} from './move-search-types';
import type {Settings} from './detector';
export interface RunMetadata {
  policyVersion:number;appOrigin:string;poseWorkers:number;admissionCapacity:number;
  detector:{poseSize:number;backend:string;preprocessing:string;settings:Settings;
    models?:{pose:{file:string;size:number;bytes:number;sha256:string};bbox:{file:string;size:number;bytes:number;sha256:string}}};
  source?:{name:string;bytes:number;lastModified:number;sha256?:string};
  fingerprints?:{scheduler:string;policy:string;searchDriver:string;frameAdapter:string;colors:string};
  timer?:{solveId:string;startClockMs:number;cameraClockOriginMs:number};
}
const canonical=(value:any):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export function recordingRows(recording:any,run:any):any[] {
  const rows=run.frameSequences?run.frameSequences.map((sequence:number)=>recording.frames[sequence])
    :recording.frames.filter((row:any)=>row.sourceId===run.sourceId&&(!run.id||row.runId===run.id));
  if(rows.some((row:any)=>!row||row.sourceId!==run.sourceId))throw Error('Run references an absent/different source frame');
  if(!rows.length)throw Error('The selected run contains no raw detections');
  if(new Set(rows.map((row:any)=>row.segment)).size!==1)throw Error('Run spans multiple source segments');
  return rows;
}
export function validateRun(recording:any,run:any,options:{diagnostic?:boolean;expectedSize?:number;
  runtime?:string;fingerprints?:RunMetadata['fingerprints']}={}) {
  const rows=recordingRows(recording,run),config:MoveSearchConfig=run.config,meta:RunMetadata|undefined=run.metadata;
  if(Math.abs(rows[0].timestampSeconds-(config.source_origin_seconds??0))>1e-6)throw Error('First source frame differs from recorded trim origin');
  if(rows.some((r:any)=>r.timestampSeconds<(config.requested_start_seconds??0)-1e-6||
    config.source_end_seconds!=null&&r.timestampSeconds>=config.source_end_seconds+1e-6))throw Error('Raw frames lie outside the recorded solve range');
  const source=recording.sources.find((s:any)=>s.id===run.sourceId);
  if(!source||Math.abs(source.fps-(config.source_fps??config.fps))>1e-6)throw Error('Source FPS differs from the reconstruction clock');
  const sizes=[...new Set<number>(rows.map((r:any)=>r.result.transform.size))];
  if(new Set(rows.map((r:any)=>`${r.result.transform.sourceWidth}x${r.result.transform.sourceHeight}`)).size!==1)
    throw Error('Source dimensions changed inside the run');
  if(new Set(rows.map((r:any)=>r.result.fittedPose?.fittingConfig?.segment).filter((s:any)=>s!=null)).size>1)
    throw Error('Fitting reset inside the recorded run; replay each fitting segment explicitly');
  if(sizes.length!==1)throw Error('Detector resolution changed inside the run');
  const size=sizes[0];
  if(options.expectedSize!=null&&size!==options.expectedSize)throw Error(`Capture uses ${size}px; requested test uses ${options.expectedSize}px`);
  if(meta&&size!==meta.detector.poseSize)throw Error(`Capture uses ${size}px; saved run declares ${meta.detector.poseSize}px`);
  if(!options.diagnostic&&(!meta||meta.policyVersion!==POLICY_VERSION||!meta.source?.sha256||!meta.fingerprints))
    throw Error('Recording lacks complete run provenance. Use an automatically saved current run, or explicitly mark a legacy ablation --diagnostic');
  if(!options.diagnostic&&(!meta?.detector.models?.pose.sha256||!meta.detector.models.bbox.sha256))
    throw Error('Recording lacks the actual loaded ONNX model hashes');
  const settings=canonical(meta?.detector.settings??rows[0].settings),backend=meta?.detector.backend??rows[0].backend;
  rows.forEach((row:any,index:number)=>{
    if(canonical(row.settings)!==settings||row.backend!==backend)throw Error('Detector settings/backend changed inside the run');
    if(!options.diagnostic&&(!row.result.detectorHashes||row.result.detectorHashes.pose!==meta?.detector.models?.pose.sha256||
      row.result.detectorHashes.bbox!==meta?.detector.models?.bbox.sha256))throw Error('Loaded detector model differs from captured run');
    if(meta&&row.result.profile?.pose?.preprocessing&&row.result.profile.pose.preprocessing!==meta.detector.preprocessing)
      throw Error('Preprocessing differs from saved run configuration');
    const identity=videoFrameIdentity(row.timestampSeconds,config);
    if(config.frame_clock==='camera_milliseconds') {
      if(index&&identity.sourceFrame<=videoFrameIdentity(rows[index-1].timestampSeconds,config).sourceFrame)
        throw Error(`Camera source timestamps do not increase at ordinal ${index}`);
    } else if(identity.sequence!==index)throw Error(`Missing/duplicated source frame at ordinal ${index}: got ${identity.sequence}`);
    const fit=row.result.fittedPose;
    if(fit?.fittingConfig&&(fit.fittingConfig.fps!==config.fps||fit.fittingConfig.turningStartFrame!==config.turning_start_frame))
      throw Error('Recorded fitting and search used different source clocks or holds');
  });
  const versions=[...new Set<string>([run.result?.pipelineVersion,...rows.map((r:any)=>r.result.fittedPose?.pipelineVersion)].filter(Boolean))];
  const assets=rows.map((r:any)=>r.result.fittedPose?.pipelineAssets).filter(Boolean);
  if(assets.some((value:any)=>canonical(value)!==canonical(assets[0])))throw Error('OpenCV/geometry assets changed inside the run');
  if(versions.length>1)throw Error('Fitting/search runtime changed inside the recorded run');
  if(!options.diagnostic&&(!versions.length||options.runtime&&versions[0]!==options.runtime))throw Error('WASM runtime differs from captured run');
  if(!options.diagnostic&&options.fingerprints&&canonical(meta?.fingerprints)!==canonical(options.fingerprints))
    throw Error('Shared scheduler, policy or search driver differs from captured run');
  return {source:source.name,sourceFps:source.fps,poseSize:size,backend,settings:JSON.parse(settings),
    firstTimestamp:rows[0].timestampSeconds,lastTimestamp:rows.at(-1).timestampSeconds,frames:rows.length,
    config,runtime:versions[0],assets:assets[0],metadata:meta,mode:options.diagnostic?'diagnostic-ablation':'recorded-browser-reproduction'};
}
