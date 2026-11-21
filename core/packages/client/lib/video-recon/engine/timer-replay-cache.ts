import {replayWithoutImages,type TimerReplay} from './timer-replay';
import type {TimerReconstructionResult} from './cube-timer';

export interface ReplayStorage {
  save(clip:TimerReplay):Promise<void>;
  load(id:string):Promise<TimerReplay|undefined>;
  remove(id:string):Promise<void>;
}
export class LocalReplayStorage implements ReplayStorage {
  private database?:Promise<IDBDatabase>;
  private open(){return this.database??=new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('live-recognition-replays',2);
    request.onupgradeneeded=event=>{
      if(event.oldVersion===0)request.result.createObjectStore('clips',{keyPath:'id'});
      else {
        // Migrate existing replays without losing their projected-cube geometry.
        const cursor=request.transaction!.objectStore('clips').openCursor();
        cursor.onsuccess=()=>{const row=cursor.result;if(!row)return;row.update(replayWithoutImages(row.value));row.continue();};
      }
    };
    request.onsuccess=()=>{
      const db=request.result;db.onversionchange=()=>{db.close();this.database=undefined;};resolve(db);
    };request.onerror=()=>reject(request.error);
  });}
  private async transaction<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
    const db=await this.open();return new Promise((resolve,reject)=>{
      const transaction=db.transaction('clips',mode),request=run(transaction.objectStore('clips'));
      transaction.oncomplete=()=>resolve(request.result);
      transaction.onabort=transaction.onerror=()=>reject(transaction.error??request.error??new Error('Replay storage failed'));
    });
  }
  async save(clip:TimerReplay){await this.transaction('readwrite',store=>store.put(replayWithoutImages(clip)));}
  load(id:string):Promise<TimerReplay|undefined>{return this.transaction('readonly',store=>store.get(id));}
  async remove(id:string){await this.transaction('readwrite',store=>store.delete(id));}
}

/** Persist geometry-only replays. Keep camera frames for the latest solve in
 * memory only, releasing them as soon as another solve starts. */
export class TimerReplayCache {
  private pending=new Map<string,{clip?:TimerReplay;finished:boolean;saving?:Promise<void>;reconstruction?:TimerReconstructionResult}>();
  private selected?:string;
  private latestId?:string;
  private latest?:TimerReplay;
  private version=0;
  private removed=new Set<string>();
  constructor(private storage:ReplayStorage,private display:(clip?:TimerReplay,loading?:boolean,error?:string)=>void){}
  begin(id:string){
    if(this.latest&&this.selected===this.latest.id)this.display(replayWithoutImages(this.latest));
    for(const entry of this.pending.values())if(entry.clip)entry.clip=replayWithoutImages(entry.clip);
    this.latestId=id;this.latest=undefined;
    this.removed.delete(id);this.pending.set(id,{finished:false});
  }
  publish(clip:TimerReplay){
    const entry=this.pending.get(clip.id);if(!entry)return;
    if(clip.id===this.latestId)this.latest=clip;
    else clip=replayWithoutImages(clip);
    entry.clip=clip;if(this.selected===clip.id)this.display(clip);
    void this.archive(clip.id);
  }
  finish(id:string,reconstruction?:TimerReconstructionResult){const entry=this.pending.get(id);if(entry){entry.finished=true;entry.reconstruction=reconstruction;void this.archive(id);}}
  private async archive(id:string){
    const entry=this.pending.get(id);if(!entry?.finished||!entry.clip?.complete||entry.saving)return;
    const clip={...entry.clip,reconstruction:entry.reconstruction};
    if(id===this.latestId)this.latest=clip;
    if(this.selected===id)this.display(clip);
    entry.saving=this.storage.save(replayWithoutImages(clip));
    try{
      await entry.saving;
      if(this.pending.get(id)!==entry){if(this.removed.has(id))await this.storage.remove(id);return;}
      this.pending.delete(id);
    }catch(error){
      // Do not accumulate failed archives either. The selected replay remains
      // visible until another is selected; report that it could not be saved.
      if(this.pending.get(id)===entry)this.pending.delete(id);
      if(this.selected===id)this.display(id===this.latestId?this.latest:replayWithoutImages(clip),false,`Replay could not be saved: ${error instanceof Error?error.message:String(error)}`);
    }
  }
  async select(id?:string){
    if(id===this.selected)return;
    this.selected=id;const version=++this.version;
    const clip=id?(this.pending.get(id)?.clip??(this.latestId===id?this.latest:undefined)):undefined;
    this.display(clip,!!id&&!clip);
    if(!id||clip)return;
    try{const saved=await this.storage.load(id);if(version===this.version)this.display(this.pending.get(id)?.clip??(this.latestId===id?this.latest:undefined)??(saved?replayWithoutImages(saved):undefined));}
    catch(error){if(version===this.version)this.display(undefined,false,`Replay could not be loaded: ${error instanceof Error?error.message:String(error)}`);}
  }
  remove(id:string){if(this.latestId===id){this.latestId=undefined;this.latest=undefined;}this.removed.add(id);this.pending.delete(id);if(this.selected===id){this.selected=undefined;++this.version;this.display();}void this.storage.remove(id);}
  clear(){this.latest=undefined;this.latestId=undefined;this.pending.clear();this.selected=undefined;++this.version;this.display();}
  get pendingCount(){return this.pending.size;}
}
