import {it,expect,vi,afterEach} from 'vitest';
import {createAssistantModel} from '../src/utils/site_assistant_model.js';
afterEach(()=>vi.restoreAllMocks());
const config={key:'fixture',baseUrl:'https://api.deepseek.com',model:'deepseek-flash'};
const options={system:'Use JSON for the answer.',context:{question:'question'},finalOnly:false,thinking:true,effort:'low' as const,maxTokens:2048};
it('retains ordinary conversation roles and bounds older context without duplicating it in the question',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response({content:JSON.stringify({answerKind:'general',answer:'A follow-up.',sourceIds:[]})}));
  const history=[{role:'user' as const,content:'First request'},{role:'assistant' as const,content:'Earlier answer'}];
  const result=await createAssistantModel(config,fetcher,AbortSignal.timeout(2000),'',history).complete({...options,thinking:false});
  const request=JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(request.messages.filter((message:{role:string})=>message.role!=='system').slice(0,2)).toMatchObject(history);
  expect(JSON.parse(request.messages.at(-1).content)).toEqual({question:'question'});
  expect(result.answerKind).toBe('general');
});
it('enables bounded reasoning for supported Qwen while unknown compatible providers stay fast',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>response({content:JSON.stringify({answer:'Done',sourceIds:[]})}));
  const qwen={...config,model:'qwen3.8-flash',baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1'};
  await createAssistantModel(qwen,fetcher,AbortSignal.timeout(2000),'').complete({...options,maxTokens:16384});
  const request=JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(request).toMatchObject({enable_thinking:true,preserve_thinking:false,thinking_budget:4096,max_completion_tokens:8192,response_format:{type:'json_object'}});
  await createAssistantModel({...qwen,baseUrl:'https://other.invalid/v1'},fetcher,AbortSignal.timeout(2000),'').complete({...options,maxTokens:16384});
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toMatchObject({enable_thinking:false,max_tokens:4096});
});
it('sends actual image parts in their original turns through the compatible provider',async()=>{
  const image={mediaType:'image/png' as const,data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0u8AAAAASUVORK5CYII='};
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response({content:JSON.stringify({answer:'A visible number.',sourceIds:[]})}));
  const model=createAssistantModel({...config,baseUrl:'https://bailian.example/v1',model:'qwen3.8-flash'},fetcher,AbortSignal.timeout(2000),'',[
    {role:'user',content:'First image',images:[image]},{role:'assistant',content:'First answer'},
  ],[image]);
  await model.complete({...options,thinking:false});
  const request=JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  const users=request.messages.filter((message:any)=>message.role==='user');
  expect(users).toHaveLength(2);
  expect(users[0].content[0]).toEqual({type:'text',text:'First image'});
  for(const user of users)expect(user.content[1]).toMatchObject({type:'image_url',image_url:{url:`data:image/png;base64,${image.data}`}});
  expect(users[1].content[0].text).not.toContain(image.data);
  expect(request.messages.some((message:any)=>message.role==='assistant'&&message.content==='First answer')).toBe(true);
});
const response=(message:object,finish='stop')=>Response.json({id:'test',created:1,model:config.model,choices:[{index:0,finish_reason:finish,message:{role:'assistant',...message}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}});
it.each([false,true])('classifies output failures and logs only safe validation metadata (stream=%s)',async streaming=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  const cases=[
    {content:'   ',reason:'empty_output'},
    {content:'private-output-not-json',reason:'invalid_json'},
    {content:JSON.stringify({answer:{private:'private-output'},sourceIds:'private-source'}),reason:'invalid_schema'},
    {content:JSON.stringify({answer:' \n ',sourceIds:[]}),reason:'invalid_schema'},
    {content:JSON.stringify({answer:'Done',sourceIds:[]}),finish:'length',reason:'output_truncated'},
  ];
  for(const fixture of cases) {
    const finish=fixture.finish ?? 'stop';
    const wire=streaming ? new Response('data: '+JSON.stringify({id:'test',object:'chat.completion.chunk',created:1,model:config.model,choices:[{index:0,delta:{role:'assistant',content:fixture.content},finish_reason:finish}]})+'\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}})
      : response({content:fixture.content},finish);
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(wire);
    await expect(createAssistantModel(config,fetcher,AbortSignal.timeout(2000),'').complete({...options,round:4,attempt:1,...(streaming?{onText:async()=>{}}:{})})).rejects.toMatchObject({
      code:'model_output_invalid',diagnostic:{reason:fixture.reason,finishReason:finish},
    });
  }
  const logs=warn.mock.calls.map(([line])=>JSON.parse(String(line)));
  expect(logs).toContainEqual(expect.objectContaining({event:'site_assistant_model_failure',round:4,attempt:1,reason:'invalid_schema',issues:[{path:'answer',code:'invalid_type'},{path:'sourceIds',code:'invalid_type'}]}));
  expect(JSON.stringify(logs)).not.toContain('private-output');
  expect(JSON.stringify(logs)).not.toContain('private-source');
});
it.each([false,true])('classifies an interrupted response body as transport failure (stream=%s)',async streaming=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response(new ReadableStream({start(controller){
    controller.error(new TypeError('private-connection-details'));
  }}),{headers:{'content-type':streaming?'text/event-stream':'application/json'}}));
  await expect(createAssistantModel(config,fetcher,AbortSignal.timeout(2000),'').complete({...options,...(streaming?{onText:async()=>{}}:{})})).rejects.toMatchObject({
    code:'model_unavailable',diagnostic:{reason:'network_error'},
  });
  expect(JSON.stringify(warn.mock.calls)).not.toContain('private-connection-details');
});
it('separates Qwen tool planning from structured answer repair',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({content:'Intro {"answer":"bad","sourceIds":[]}'}))
    .mockResolvedValueOnce(response({content:JSON.stringify({answer:'Repaired',sourceIds:[]})}));
  const model=createAssistantModel({...config,model:'qwen-plus',baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1'},fetcher,AbortSignal.timeout(2000),'');
  await expect(model.complete({...options,thinking:false})).rejects.toThrow('Invalid assistant answer format');
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).not.toHaveProperty('response_format');
  await model.complete({...options,thinking:false,allowTools:false,requireStructuredAnswer:true,followUp:'Repair JSON only.'});
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toMatchObject({tool_choice:'none',response_format:{type:'json_object'}});
});
it('records only one executor result for an SDK-rejected native call',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({content:null,tool_calls:[{id:'invalid-date',type:'function',function:{name:'competitions',arguments:JSON.stringify({from:'2025-02-01',to:'2025-02-29',limit:50})}}]},'tool_calls'))
    .mockResolvedValueOnce(response({content:JSON.stringify({answer:'Need valid input',sourceIds:[]})}));
  const model=createAssistantModel(config,fetcher,AbortSignal.timeout(2000),'');
  const step=await model.complete(options);
  expect(step.calls).toHaveLength(1);
  model.record(step.calls[0],{error:'Invalid calendar date and limit'});
  await model.complete({...options,finalOnly:true});
  const request=JSON.parse(String(fetcher.mock.calls[1][1]?.body));
  expect(request.messages.filter((m:any)=>m.role==='tool'&&m.tool_call_id==='invalid-date')).toEqual([{role:'tool',tool_call_id:'invalid-date',content:JSON.stringify({error:'Invalid calendar date and limit'})}]);
});
it.each(['```json\n%s\n```','\n%s\n```'])('accepts a compatible vision JSON fence but retains schema validation: %s',async wrapper=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response({content:wrapper.replace('%s',JSON.stringify({answer:'12.34',sourceIds:[]}))}));
  const model=createAssistantModel({...config,baseUrl:'https://bailian.example/v1'},fetcher,AbortSignal.timeout(2000),'');
  expect((await model.complete({...options,thinking:false})).answer).toBe('12.34');
  fetcher.mockResolvedValue(response({content:'Intro '+JSON.stringify({answer:'12.34',sourceIds:[]})}));
  await expect(model.complete({...options,thinking:false})).rejects.toThrow();
});
it('round trips native tool IDs and reasoning only through the provider transcript',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({content:null,reasoning_content:'provider-private-reasoning',tool_calls:[{id:'native-id',type:'function',function:{name:'navigation',arguments:JSON.stringify({query:'timer',kind:'all',pageIds:[]})}}]},'tool_calls'))
    .mockResolvedValueOnce(response({content:JSON.stringify({answer:'Open timer',sourceIds:['timer']})}));
  const model=createAssistantModel(config,fetcher,AbortSignal.timeout(2000),'navigation Find destinations');
  const step=await model.complete(options);expect(step.calls).toEqual([{tool:'navigation',query:'timer',kind:'all',pageIds:[]}]);expect(JSON.stringify(step)).not.toContain('provider-private-reasoning');
  model.record(step.calls[0],{sources:[{id:'timer'}]});
  await model.complete({...options,finalOnly:true,thinking:false});
  const request=JSON.parse(String(fetcher.mock.calls[1][1]?.body));
  expect(request.messages.find((m:any)=>m.role==='assistant').reasoning_content).toBe('provider-private-reasoning');
  expect(request.messages.find((m:any)=>m.role==='tool')).toMatchObject({tool_call_id:'native-id',content:JSON.stringify({sources:[{id:'timer'}]})});
  expect(request.tool_choice).toBe('none');
});
it.each([false,true])('returns one result per tool call after SDK input validation fails (stream=%s)',async stream=>{
  const toolCalls=[
    {id:'invalid-id',type:'function',function:{name:'navigation',arguments:JSON.stringify({query:42,kind:'all',pageIds:[]})}},
    {id:'valid-id',type:'function',function:{name:'navigation',arguments:JSON.stringify({query:'timer',kind:'all',pageIds:[]})}},
  ];
  const message={content:null,reasoning_content:'provider-private-reasoning',tool_calls:toolCalls};
  const chunk=(delta:object,finish_reason:string|null=null)=>'data: '+JSON.stringify({id:'test',created:1,model:config.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
  const first=stream?new Response(chunk({role:'assistant',...message,tool_calls:toolCalls.map((call,index)=>({...call,index}))})+chunk({},'tool_calls')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}}):response(message,'tool_calls');
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(first).mockResolvedValueOnce(response({content:JSON.stringify({answer:'Open timer',sourceIds:['timer']})}));
  const model=createAssistantModel(config,fetcher,AbortSignal.timeout(2000),'navigation Find destinations');
  const onText=vi.fn(async()=>{});
  const step=await model.complete({...options,...(stream?{onText}:{})});
  expect(step.calls).toHaveLength(2);
  expect(model.record(step.calls[0],{error:'Invalid tool request. query must be string.'})).toBe(true);
  expect(model.record(step.calls[1],{sources:[{id:'timer'}]})).toBe(true);
  await model.complete({...options,finalOnly:true});
  const request=JSON.parse(String(fetcher.mock.calls[1][1]?.body));
  expect(request.messages.filter((message:any)=>message.role==='tool')).toEqual([
    {role:'tool',tool_call_id:'invalid-id',content:JSON.stringify({error:'Invalid tool request. query must be string.'})},
    {role:'tool',tool_call_id:'valid-id',content:JSON.stringify({sources:[{id:'timer'}]})},
  ]);
  expect(request.messages.find((message:any)=>message.role==='assistant').reasoning_content).toBe('provider-private-reasoning');
  expect(JSON.stringify({step,updates:onText.mock.calls})).not.toContain('provider-private-reasoning');
});
it('streams answer text without sending reasoning to the UI callback',async()=>{
  const delta=(delta:object,finish_reason:string|null=null)=>'data: '+JSON.stringify({id:'test',object:'chat.completion.chunk',created:1,model:config.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
  const content=JSON.stringify({answer:'已找到训练说明',sourceIds:[]});
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response(delta({role:'assistant',reasoning_content:'private'})+delta({content})+delta({},'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}}));
  const onText=vi.fn(async()=>{});
  const result=await createAssistantModel(config,fetcher,AbortSignal.timeout(2000),'').complete({...options,onText});
  expect(result.answer).toBe('已找到训练说明');expect(onText).toHaveBeenCalledWith(content);expect(JSON.stringify(onText.mock.calls)).not.toContain('private');
});
it('keeps a malformed streamed final for a new repair turn and requests the answer schema',async()=>{
  const delta=(content:string)=>'data: '+JSON.stringify({id:'test',object:'chat.completion.chunk',created:1,model:config.model,choices:[{index:0,delta:{role:'assistant',content},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n';
  const fetcher=vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(delta('A plain answer instead of JSON.'),{headers:{'content-type':'text/event-stream'}}))
    .mockResolvedValueOnce(response({content:JSON.stringify({answer:'A valid answer.',sourceIds:[]})}));
  const model=createAssistantModel(config,fetcher,AbortSignal.timeout(2000),'');
  await expect(model.complete({...options,onText:async()=>{}})).rejects.toThrow();
  const result=await model.complete({...options,followUp:'Repair the previous final response as the required JSON object.'});
  expect(result.answer).toBe('A valid answer.');
  const request=JSON.parse(String(fetcher.mock.calls[1][1]?.body));
  expect(request.messages.some((message:any)=>message.role==='assistant'&&message.content==='A plain answer instead of JSON.')).toBe(true);
  expect(request.messages.at(-1)).toMatchObject({role:'user',content:'Repair the previous final response as the required JSON object.'});
  expect(request.messages.some((message:any)=>message.role==='system'&&message.content.includes('"sourceIds"'))).toBe(true);
});
