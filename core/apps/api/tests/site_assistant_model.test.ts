import {it,expect,vi} from 'vitest';
import {createAssistantModel} from '../src/utils/site_assistant_model.js';
const config={key:'fixture',baseUrl:'https://api.deepseek.com',model:'deepseek-flash'};
const options={system:'Use JSON for the answer.',context:{question:'question'},finalOnly:false,thinking:true,effort:'low' as const,maxTokens:2048};
const response=(message:object,finish='stop')=>Response.json({id:'test',created:1,model:config.model,choices:[{index:0,finish_reason:finish,message:{role:'assistant',...message}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}});
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
it('streams answer text without sending reasoning to the UI callback',async()=>{
  const delta=(delta:object,finish_reason:string|null=null)=>'data: '+JSON.stringify({id:'test',object:'chat.completion.chunk',created:1,model:config.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
  const content=JSON.stringify({answer:'已找到训练说明',sourceIds:[]});
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response(delta({role:'assistant',reasoning_content:'private'})+delta({content})+delta({},'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}}));
  const onText=vi.fn(async()=>{});
  const result=await createAssistantModel(config,fetcher,AbortSignal.timeout(2000),'').complete({...options,onText});
  expect(result.answer).toBe('已找到训练说明');expect(onText).toHaveBeenCalledWith(content);expect(JSON.stringify(onText.mock.calls)).not.toContain('private');
});
