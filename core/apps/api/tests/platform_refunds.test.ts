import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const state=vi.hoisted(()=>({actor:{userId:1,ownerKey:'test',isAdmin:true},transaction:false,
  order:{id:'00000000-0000-4000-8000-000000000001',buyer_user_id:'1',status:'paid',total_amount_minor:1001,currency:'CNY'},
  row:{} as Record<string,unknown>,provider:vi.fn(),complete:vi.fn(),queries:[] as string[]}));
vi.mock('../src/platform/auth.js',()=>({
  requirePlatformActor:async()=>state.actor,
  requirePlatformAdmin:async()=>{if(!state.actor.isAdmin)throw Error('admin required');return state.actor;},
}));
vi.mock('../src/platform/refund_provider.js',()=>({assertRefundProvider:()=>{},runProviderRefund:state.provider}));
vi.mock('../src/routes/platform_commerce.js',()=>({completePlatformFullRefund:state.complete}));
vi.mock('../src/platform/db.js',()=>{
  const query=async(_db:unknown,sql:string,args:unknown[]=[])=>{
    state.queries.push(sql);
    if(sql.includes('SELECT c.event_id'))return [];
    if(sql.includes('FROM platform_orders WHERE'))return [state.order];
    if(sql.includes('SELECT p.provider_transaction_id'))return [{provider_transaction_id:'transaction',merchant_account:'merchant',total_amount_minor:1001}];
    if(sql.includes('SELECT * FROM platform_refunds WHERE id='))return [{...state.row}];
    if(sql.includes('SELECT COUNT(*)>0'))return [{eligible:true}];
    if(sql.includes('SELECT * FROM platform_refunds WHERE order_id='))return [{...state.row}];
    if(sql.includes('INSERT INTO platform_audit_events'))return [];
    if(sql.includes("SET status='pending',approved_at")){
      Object.assign(state.row,{status:'pending',approved_at:new Date().toISOString()});return [];
    }
    if(sql.includes('SET processing_until=')){state.row.processing_until=new Date(Date.now()+60000).toISOString();return [];}
    if(sql.includes('SET status=$2::varchar,provider_refund_id')){
      Object.assign(state.row,{status:args[1],provider_refund_id:args[2],provider_status:args[3],failure_code:args[4],processing_until:null});return [];
    }
    if(sql.includes("SET failure_code='provider_check_required'")){
      Object.assign(state.row,{failure_code:'provider_check_required',processing_until:null});return [];
    }
    if(sql.includes("SET status='cancelled'")){state.row.status='cancelled';return [];}
    throw Error(`Unexpected SQL ${sql}`);
  };
  const transaction=async<T>(run:(db:object)=>Promise<T>)=>{
    state.transaction=true;try{return await run({});}finally{state.transaction=false;}
  };
  return {platformDb:()=>({}),platformQuery:query,platformTransaction:transaction,
    withIdempotency:async(_c:unknown,_actor:unknown,_scope:unknown,_body:unknown,run:(db:object)=>Promise<object>)=>
      ({...await transaction(run),replayed:false}),
    sendMutation:(c:{json:(body:unknown,status:unknown)=>unknown},result:{body:unknown;status:number})=>c.json(result.body,result.status)};
});
import { platformRefundRoutes, synchronizePlatformRefund } from '../src/routes/platform_refunds.js';
const id='00000000-0000-4000-8000-000000000002';
const app=new Hono().route('/v1',platformRefundRoutes);
beforeEach(()=>{
  state.actor={userId:1,ownerKey:'test',isAdmin:true};state.order.status='paid';state.queries=[];
  state.provider.mockReset();state.complete.mockReset();
  state.row={id,order_id:state.order.id,payment_attempt_id:'payment',status:'requested',merchant_request_id:'stable-refund-number',
    provider:'wechat',provider_refund_id:null,approved_at:null,amount_minor:1001,currency:'CNY',reason_code:'schedule',
    provider_status:null,failure_code:null,processing_until:null};
});
describe('automatic refund business transitions without external money calls',()=>{
  it('allows the owner when PostgreSQL returns the bigint buyer ID as a string',async()=>{
    state.actor.isAdmin=false;
    const list=await app.request(`/v1/platform/orders/${state.order.id}/refunds`);
    expect(list.status).toBe(200);
    const request=await app.request(`/v1/platform/orders/${state.order.id}/refund-requests`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reasonCode:'schedule'})});
    expect(request.status).toBe(200);expect(await request.json()).toMatchObject({id,status:'requested'});
  });
  it('persists approval before provider I/O and preserves access while processing',async()=>{
    state.provider.mockImplementation(async(input)=>{
      expect(state.transaction).toBe(false);expect(state.row.approved_at).toBeTruthy();
      expect(input.requestId).toBe('stable-refund-number');return {id:'provider-refund',status:'pending',providerStatus:'PROCESSING'};
    });
    const response=await app.request(`/v1/admin/refunds/${id}/approve`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    expect(response.status).toBe(200);expect(await response.json()).toMatchObject({status:'pending',providerStatus:'PROCESSING',failureCode:null});
    expect(state.complete).not.toHaveBeenCalled();expect(state.order.status).toBe('paid');
  });
  it('an unknown timeout remains pending and reuses the approved merchant request number',async()=>{
    state.provider.mockRejectedValueOnce(Error('network timeout')).mockResolvedValueOnce({id:'r1',status:'pending',providerStatus:'PROCESSING'});
    state.row.approved_at=new Date().toISOString();state.row.status='pending';
    expect(await synchronizePlatformRefund(id,state.actor as never,true)).toMatchObject({status:'pending',failureCode:'provider_check_required'});
    await synchronizePlatformRefund(id,state.actor as never,true);
    expect(state.provider.mock.calls.map(call=>call[0].requestId)).toEqual(['stable-refund-number','stable-refund-number']);
    expect(state.complete).not.toHaveBeenCalled();
  });
  it('only verified success performs fulfillment reversal exactly once',async()=>{
    state.row.approved_at=new Date().toISOString();state.row.status='pending';
    state.provider.mockResolvedValue({id:'provider-refund',status:'succeeded',providerStatus:'SUCCESS'});
    state.complete.mockImplementation(async()=>{expect(state.transaction).toBe(true);expect(state.row.status).toBe('succeeded');});
    expect(await synchronizePlatformRefund(id,state.actor as never,false)).toMatchObject({status:'succeeded'});
    await synchronizePlatformRefund(id,state.actor as never,false);
    expect(state.complete).toHaveBeenCalledTimes(1);expect(state.provider).toHaveBeenCalledTimes(1);
  });
  it('unapproved refunds cannot be sent or queried',async()=>{
    await expect(synchronizePlatformRefund(id,state.actor as never,true)).rejects.toThrow('not been approved');
    expect(state.provider).not.toHaveBeenCalled();
  });
  it('rejecting an approved refund is blocked instead of silently cancelling money already in flight',async()=>{
    state.row.approved_at=new Date().toISOString();state.row.status='pending';
    const response=await app.request(`/v1/admin/refunds/${id}/reject`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"reasonCode":"declined"}'});
    expect(response.status).toBe(409);expect(state.row.status).toBe('pending');expect(state.provider).not.toHaveBeenCalled();
  });
  it('another buyer cannot create a refund request for this order',async()=>{
    state.actor={userId:2,ownerKey:'other',isAdmin:false};
    const response=await app.request(`/v1/platform/orders/${state.order.id}/refund-requests`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"reasonCode":"schedule"}'});
    expect(response.status).toBe(404);expect(state.provider).not.toHaveBeenCalled();
  });
});
