export type SearchAction={type:'frame';sequence:number}|{type:'advance';budget:number}|{type:'end'}|
 {type:'advance_side';direction:number;budget:number}|{type:'complete_join';forward_node:number;backward_steps:any[];backward_state?:number[];stats:any};
export class IncrementalSearch {
 constructor(call:(request:any)=>any,options:{report:(message:{result:any;ended:boolean;actions:SearchAction[]})=>void;
  error:(error:unknown)=>void;live?:boolean;version?:string;now?:()=>number;
  schedule?:typeof setTimeout;cancel?:typeof clearTimeout});
 request(request:any):any;
 pause():void;
 resume():void;
 setPacing(delayMs:number):void;
 dispose():void;
}
