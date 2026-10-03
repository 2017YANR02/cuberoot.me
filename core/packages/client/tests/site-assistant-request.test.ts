import {describe,it,expect,vi} from 'vitest';
import {requestSiteAssistant} from '@/lib/site-assistant-request';

const request={question:'明年世锦赛在哪里办',lang:'zh' as const,timeZone:'America/Los_Angeles',history:[]};
describe('assistant rolling deployment compatibility',()=>{
  it('retries an old schema exactly once without losing question, history, auth or streaming',async()=>{
    const done=new Response('stream',{status:200,headers:{'Content-Type':'text/event-stream'}});
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({error:'invalid_question'},{status:400})).mockResolvedValueOnce(done);
    const signal=new AbortController().signal;
    const result=await requestSiteAssistant('/v1/site-assistant',request,{signal,headers:{Authorization:'test-auth',Accept:'text/event-stream'}},fetcher);
    expect(result).toBe(done);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual(request);
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({question:request.question,lang:'zh',history:[]});
    expect(fetcher.mock.calls[1][1]).toMatchObject({signal,headers:{Authorization:'test-auth',Accept:'text/event-stream'}});
  });
  it.each([200,401,403,429,503,504])('does not retry an accepted request or another error: %s',async status=>{
    const response=Response.json({error:'invalid_question'},{status});
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response);
    expect(await requestSiteAssistant('/v1/site-assistant',request,{},fetcher)).toBe(response);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('retains unrelated 400 bodies for the caller and does not retry twice',async()=>{
    const response=Response.json({error:'another_error'},{status:400});
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response);
    expect(await requestSiteAssistant('/v1/site-assistant',request,{},fetcher)).toBe(response);
    expect(await response.json()).toEqual({error:'another_error'});
    expect(fetcher).toHaveBeenCalledTimes(1);
    const rejected=vi.fn<typeof fetch>().mockResolvedValue(Response.json({error:'invalid_question'},{status:400}));
    expect((await requestSiteAssistant('/v1/site-assistant',request,{},rejected)).status).toBe(400);
    expect(rejected).toHaveBeenCalledTimes(2);
  });
});
