import {TIMER_TAIL_SECONDS} from './cube-timer';
type Admission={type:'idle'}|{type:'frame';id:string;reset:boolean}|{type:'end';id:string;timestamp:number};
/** A connected camera is idle outside solve windows. Its end marker travels
 * behind admitted frames, so the entire tail drains before search input closes. */
export class TimerCaptureGate {
  private window?:{id:string;start:number;end?:number;closed:boolean;first:boolean};
  start(id:string,start:number){this.window={id,start,closed:false,first:true};}
  stop(id:string,stop:number){if(this.window?.id===id)this.window.end=stop+TIMER_TAIL_SECONDS;}
  admit(timestamp:number):Admission{
    const window=this.window;
    if(!window||window.closed||timestamp<window.start)return {type:'idle'};
    if(window.end!==undefined&&timestamp>=window.end){window.closed=true;return {type:'end',id:window.id,timestamp};}
    const reset=window.first;window.first=false;return {type:'frame',id:window.id,reset};
  }
  finish(id:string){if(this.window?.id!==id)return false;this.window=undefined;return true;}
  clear(){this.window=undefined;}
}
