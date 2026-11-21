// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/lib/session-fetch',()=>({sessionFetch:mocks.fetch}));
vi.mock('@/lib/admin-api',()=>({authHeaders:()=>({}),handleApi:async(response:Response)=>{if(!response.ok)throw new Error('Request failed');return response.json();}}));
vi.mock('@/hooks/useT',()=>({useT:()=>(zh:string)=>zh}));
vi.mock('@/components/CompactSelect',()=>({CompactSelect:()=>null}));
import { InstructorPayoutSettings } from '@/components/platform/InstructorPayoutSettings';

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const json=(value:unknown)=>new Response(JSON.stringify(value),{status:200});

it('does not show missing payout data during loading, and preserves a confirmed request outcome if refresh fails',async()=>{
  const visible=vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
  const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);
  let releaseProfile!:(response:Response)=>void;
  let attempts=0;
  mocks.fetch.mockImplementation(async(url:string,init:RequestInit={})=>{
    if(init.method==='POST'){
      attempts++;
      if(attempts===1)throw new Error('Connection interrupted');
      return json({id:'payout'});
    }
    if(attempts===2)throw new Error('Refresh failed');
    if(url.endsWith('/payout-profile'))return new Promise<Response>(resolve=>{releaseProfile=resolve;});
    return json({payouts:[],availableMinor:1200});
  });
  const host=document.createElement('div'),root=createRoot(host);
  try{
    await act(async()=>root.render(createElement(InstructorPayoutSettings)));
    expect(host.textContent).not.toContain('暂无结算记录');
    expect(host.textContent).not.toContain('申请提现');
    await act(async()=>releaseProfile(json({configured:true,method:'wechat'})));
    expect(host.textContent).toContain('暂无结算记录');
    const button=(label:string)=>[...host.querySelectorAll('button')].find(item=>item.textContent===label)!;
    await act(async()=>button('申请提现').click());
    expect(host.textContent).toContain('申请结果待核对');
    await act(async()=>button('重试原申请').click());
    const writes=mocks.fetch.mock.calls.filter(([,init])=>init?.method==='POST');
    expect(writes).toHaveLength(2);
    expect(writes[0][1].headers['Idempotency-Key']).toBe(writes[1][1].headers['Idempotency-Key']);
    expect(writes[0][1].body).toBe(writes[1][1].body);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('提现申请已提交');
    expect(host.textContent).toContain('收款信息暂时无法更新');
    expect(host.textContent).not.toContain('申请结果待核对');
  }finally{await act(async()=>root.unmount());visible.mockRestore();confirm.mockRestore();}
});
