/** OpenAI-compatible native tool/answer wire fixtures, shared by integration tests. */
export function modelResponse(value: any) {
  const calls = Array.isArray(value) ? value : value.calls ?? [];
  return Response.json({ id:'test',created:1,model:'test',choices:[{index:0,finish_reason:calls.length?'tool_calls':'stop',message:{role:'assistant',content:calls.length?null:JSON.stringify({answer:value.answer ?? '',sourceIds:value.sourceIds ?? []}),...(calls.length?{tool_calls:calls.map(({tool,...args}:any,i:number)=>({id:'call_'+i,type:'function',function:{name:tool,arguments:JSON.stringify(args)}}))}:{})}}] });
}
