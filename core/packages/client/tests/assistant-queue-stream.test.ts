import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionFetch } from '../lib/session-fetch';
import { watchAssistantQueue } from '../lib/assistant-queue';

vi.mock('../lib/session-fetch',()=>({sessionFetch:vi.fn()}));
vi.mock('../lib/admin-api',()=>({authHeaders:()=>({})}));
vi.mock('../lib/api-base',()=>({assistantStreamApiUrl:()=>'/site-assistant'}));

const base={conversationId:'conversation',revision:1,paused:false,recovering:false};
const row={id:'first',sequence:1,state:'completed'};
const snapshot={...base,type:'snapshot',messages:[row]};
function send(...frames:unknown[]) {
  const data=frames.map(frame=>'data: '+(typeof frame==='string'?frame:JSON.stringify(frame))+'\n\n').join('');
  vi.mocked(sessionFetch).mockResolvedValueOnce(new Response(data,{headers:{'content-type':'text/event-stream'}}));
}
afterEach(()=>vi.clearAllMocks());
describe('durable assistant stream',()=>{
  it('retains unchanged messages when a patch arrives and accepts wakeups from older servers',async()=>{
    const next={id:'second',sequence:2,state:'running',answer:{answer:'徐州',sources:[]}};
    send('changed',snapshot,{...base,type:'patch',base:1,revision:2,messages:[next]});
    const listener=vi.fn();
    await watchAssistantQueue(base.conversationId,new AbortController().signal,listener);
    expect(listener.mock.calls).toHaveLength(3);
    expect(listener.mock.calls[0]).toEqual([]);
    expect(listener.mock.calls[2][0]).toMatchObject({revision:2,messages:[row,next]});
  });
  it('rejects a revision gap so fallback can retrieve an authoritative snapshot',async()=>{
    send(snapshot,{...base,type:'patch',base:2,revision:3,messages:[]});
    const listener=vi.fn();
    await expect(watchAssistantQueue(base.conversationId,new AbortController().signal,listener)).rejects.toMatchObject({code:'network'});
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
