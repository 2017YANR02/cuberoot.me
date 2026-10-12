import {beforeEach,expect,it,vi} from 'vitest';
import {Hono} from 'hono';
import jwt from 'jsonwebtoken';
const mock=vi.hoisted(()=>({auth:vi.fn(),query:vi.fn()}));
vi.mock('../src/utils/recon_helpers.js',()=>({requireAuth:mock.auth,checkRateLimit:vi.fn()}));
vi.mock('../src/db/connection.js',()=>({query:mock.query,withTransaction:async(f:(q:typeof mock.query)=>unknown)=>f(mock.query)}));
import {devPreviewRoutes} from '../src/routes/dev_preview';
const app=new Hono().route('/v1',devPreviewRoutes);
const post=(p:string,b:unknown,token='')=>app.request('/v1/dev-preview/'+p,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(b)});
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('DEV_PREVIEW_HOST_TOKEN','x'.repeat(40));mock.auth.mockResolvedValue({uid:2,name:'Employee',isAdmin:true,realWcaId:'OTHER'});mock.query.mockResolvedValue([]);});
it('only the real owner can approve infrastructure changes',async()=>{expect((await post('requests/id/decision',{decision:'approved'})).status).toBe(403);expect(mock.query).not.toHaveBeenCalled();});
it('rejects impersonation even for the owner',async()=>{mock.auth.mockResolvedValue({uid:1,isAdmin:true,realWcaId:'2017YANR02'});expect((await post('requests/id/decision',{decision:'approved'},jwt.sign({previewId:'fake'},'test'))).status).toBe(403);expect(mock.query).not.toHaveBeenCalled();});
it('scopes employee requests and never returns ticket hashes',async()=>{await app.request('/v1/dev-preview/requests');expect(mock.query.mock.calls[0][0]).toContain('WHERE user_id=?');expect(mock.query.mock.calls[0][0]).not.toContain('ticket_hash');expect(mock.query.mock.calls[0][1]).toEqual([2]);});
it('requires the separate worker credential',async()=>{expect((await app.request('/v1/dev-preview/host/next')).status).toBe(401);expect((await post('host/id',{status:'ready'},'wrong')).status).toBe(401);expect(mock.query).not.toHaveBeenCalled();});
it('rejects invalid identifiers before SQL',async()=>{expect((await post('requests',{owner:'../../root',device:'pc',os:'windows'})).status).toBe(400);expect(mock.query).not.toHaveBeenCalled();});
it('a device ticket cannot approve its own request',async()=>{expect((await post('requests/id/decision',{decision:'approved'},'a'.repeat(64))).status).toBe(403);});
it('does not replace an already bound key',async()=>{mock.query.mockResolvedValue([{id:'id',owner_slug:'a',device_slug:'b',public_key:'existing',status:'pending'}]);const key='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILX0ASs3XktuhMw0kwIYLoLbRGQZLuQq9hkafwCqDB8C';expect((await post('device',{publicKey:key},'a'.repeat(64))).status).toBe(403);expect(mock.query).toHaveBeenCalledTimes(1);});
it('rejects worker readiness for an unclaimed approval',async()=>{mock.query.mockResolvedValue([{id:'id',owner_slug:'a',device_slug:'b',status:'approved'}]);expect((await post('host/id',{status:'ready',profile:{}},'x'.repeat(40))).status).toBe(409);expect(mock.query).toHaveBeenCalledTimes(1);});
it('a device cannot certify its own connectivity',async()=>{
  mock.query.mockResolvedValue([{owner_slug:'a',device_slug:'b',status:'ready',profile:{},verified_at:null}]);
  const r=await post('device',{connected:true},'a'.repeat(64));
  expect((await r.json()).connected).toBe(false);
  expect(mock.query).toHaveBeenCalledTimes(1);
  expect((await post('host/id/health',{connected:true},'a'.repeat(64))).status).toBe(401);
});
it('expires old connectivity evidence even when infrastructure is ready',async()=>{
  mock.query.mockResolvedValue([{owner_slug:'a',device_slug:'b',status:'ready',profile:{},verified_at:new Date(Date.now()-301000)}]);
  expect((await (await post('device',{},'a'.repeat(64))).json()).connected).toBe(false);
  mock.query.mockResolvedValue([{owner_slug:'a',device_slug:'b',status:'ready',profile:{},verified_at:new Date()}]);
  expect((await (await post('device',{},'a'.repeat(64))).json()).connected).toBe(true);
});
it('health reports are restricted to already provisioned requests and outages clear evidence',async()=>{
  mock.query.mockResolvedValue([{id:'id'}]);
  expect((await post('host/id/health',{connected:false},'x'.repeat(40))).status).toBe(200);
  expect(mock.query.mock.calls[0][0]).toContain("status='ready'");
  expect(mock.query.mock.calls[0][0]).toContain('ELSE NULL');
  expect(mock.query.mock.calls[0][1]).toEqual([false,'id']);
  mock.query.mockResolvedValue([]);
  expect((await post('host/id/health',{connected:true},'x'.repeat(40))).status).toBe(409);
});
it('health queue and employee list require fresh independent evidence',async()=>{
  await app.request('/v1/dev-preview/host/health-next',{headers:{Authorization:`Bearer ${'x'.repeat(40)}`}});
  expect(mock.query.mock.calls[0][0]).toContain('ORDER BY health_checked_at NULLS FIRST');
  expect(mock.query.mock.calls[0][0]).toContain("INTERVAL '5 minutes'");
});
