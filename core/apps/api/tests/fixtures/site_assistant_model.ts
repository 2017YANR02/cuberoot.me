/** OpenAI-compatible native tool/answer wire fixtures, shared by integration tests. */
export function wireEvidence(request:any) {
  return request.messages.flatMap((message:any)=> {
    if(message.role!=='tool' && message.role!=='user')return [];
    if(typeof message.content!=='string')return [];
    try{return JSON.parse(message.content).evidence ?? [];}catch{return [];}
  });
}
export function modelResponse(value: any) {
  const calls = Array.isArray(value) ? value : value.calls ?? [];
  return Response.json({ id:'test',created:1,model:'test',choices:[{index:0,finish_reason:calls.length?'tool_calls':'stop',message:{role:'assistant',content:calls.length?null:JSON.stringify({...(value.answerKind?{answerKind:value.answerKind}:{}),answer:value.answer ?? '',sourceIds:value.sourceIds ?? [],...(value.reviewedSourceIds?{reviewedSourceIds:value.reviewedSourceIds}:{})}),...(calls.length?{tool_calls:calls.map(({tool,...args}:any,i:number)=>({id:'call_'+i,type:'function',function:{name:tool,arguments:JSON.stringify(args)}}))}:{})}}] });
}
