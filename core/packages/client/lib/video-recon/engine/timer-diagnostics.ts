import { DetectionRecording } from './detection-recording';
import type { MoveSearchConfig, MoveSearchResult } from './move-search-types';
import type { RunMetadata } from './run-provenance';
import type { TimerReconstructionResult } from './cube-timer';
import type { SearchAction } from '../pose-fitter/runtime/incremental-search.mjs';

/** Each timer solve has its own diagnostic run, including pre-search failures.
 * Only frame sequences admitted by the timer's source-time window are linked. */
export class TimerDiagnostics {
  private runs = new Map<string, { id: string; sourceId: number; config: MoveSearchConfig; lastSavedAt: number;released?:boolean;finishing?:Promise<void> }>();
  constructor(private recording: DetectionRecording, private persist: (runId: string) => Promise<void|boolean>,
    private now = () => performance.now()) {}
  start(solveId: string, sourceId: number, config: MoveSearchConfig, metadata: RunMetadata): string {
    const id = this.recording.startRun(sourceId, config, metadata);
    this.runs.set(solveId, { id, sourceId, config, lastSavedAt: this.now() });
    void this.persist(id);
    return id;
  }
  runId(solveId: string) { return this.runs.get(solveId)?.id; }
  released(solveId:string){return this.runs.get(solveId)?.released??false;}
  /** Search disposal acknowledges both final input and its complete journal.
   * Save that checkpoint before releasing detector results and fitting banks. */
  finish(solveId:string):Promise<void>{
    const run=this.runs.get(solveId);if(!run||run.released)return Promise.resolve();
    return run.finishing??=(async()=>{
      try{
        if(await this.persist(run.id)===false)throw Error('Final diagnostics could not be saved; working frames were released');
      }finally{this.recording.releaseRun(run.id);run.released=true;}
    })().finally(()=>{run.finishing=undefined;});
  }
  async forget(solveId:string){try{await this.finish(solveId);}finally{this.runs.delete(solveId);}}
  frame(solveId: string, sequence: number) {
    const run = this.runs.get(solveId); if (!run||run.released) return;
    this.recording.linkFrame(run.id, sequence);
    if (this.now() - run.lastSavedAt >= 1000) {
      run.lastSavedAt = this.now();
      this.recording.updateRunConfig(run.id, run.config);
      void this.persist(run.id);
    }
  }
  update(solveId: string, value: TimerReconstructionResult): TimerReconstructionResult {
    const run = this.runs.get(solveId); if (!run||run.released) return value;
    this.recording.updateRunConfig(run.id, run.config);
    if (value.status === 'failed') this.recording.saveError(run.id, value.message ?? 'Timer reconstruction failed');
    if (['waiting', 'queued', 'failed', 'solved'].includes(value.status)) void this.persist(run.id);
    return { ...value, diagnosticRunId: run.id };
  }
  search(solveId: string, config: MoveSearchConfig, result: MoveSearchResult, actions: SearchAction[], _ended: boolean) {
    const run = this.runs.get(solveId); if (!run||run.released) return;
    run.config = config;
    this.recording.updateRunConfig(run.id, config);
    this.recording.saveSearch(run.sourceId, config, result, run.id, actions);
    // `ended` means input closed, and stays true on EVERY later progress report.
    // Terminal/lifecycle checkpoints are saved by update(); progress stays in memory.
  }
  export(solveId: string) {
    const run = this.runs.get(solveId);
    if (!run) throw Error('Diagnostics are unavailable for this solve in this page session');
    return this.recording.exportRun(run.id);
  }
}
