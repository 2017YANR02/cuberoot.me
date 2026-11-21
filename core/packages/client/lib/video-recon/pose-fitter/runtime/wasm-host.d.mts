export interface OpenCvModule {
  HEAPF64:Float64Array;_malloc(bytes:number):number;_free(pointer:number):void;
  _pose_cv(...args:number[]):number;
}
export function loadCpuFitter(bytes:BufferSource,fixtureBytes:Uint8Array,cv:OpenCvModule,
  options?:{onDiagnostic?:(message:string)=>void}):Promise<{call(name:string,value:unknown):Record<string,any>;readonly memoryBytes:number}>;
