import type {SearchAction} from './incremental-search.mjs';
export interface SearchSide {
 request(request:any):Promise<any>;
 dispose():void;
}
export class ParallelSearch {
 constructor(options:{spawn:(direction:number)=>SearchSide;report:(message:{result:any;ended:boolean;actions:SearchAction[]})=>void;error:(error:unknown)=>void;now?:()=>number});
 request(request:any):void;
 dispose():void;
}
export function packMeetings(records:[number,number,number|null,number[]][]):ArrayBuffer;
