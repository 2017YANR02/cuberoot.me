import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),get:vi.fn(),post:vi.fn()}));
vi.mock('../src/utils/recon_helpers',()=>({optionalAuth:mocks.auth,checkRateLimit:vi.fn()}));
vi.mock('../src/db/connection',()=>({query:vi.fn(),withTransaction:vi.fn()}));
vi.mock('../src/workspace/service',async importOriginal=>({...await importOriginal<object>(),createWorkspaceService:()=>({get:mocks.get,post:mocks.post})}));
import { workspaceRoutes } from '../src/routes/workspace';
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue(null);});
it('does not accept a foreign employee cookie or anonymous identity',async()=>{
  const response=await workspaceRoutes.request('/workspace/session',{headers:{Cookie:'mira-staff-session=foreign'}});
  expect(response.status).toBe(401);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(mocks.get).not.toHaveBeenCalled();
});
it('uses only the verified CubeRoot actor, ignoring body identity fields',async()=>{
  mocks.auth.mockResolvedValue({uid:12,isAdmin:false,name:'CubeRoot user'});mocks.post.mockResolvedValue({id:'saved'});
  await workspaceRoutes.request('/workspace/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:1,isAdmin:true})});
  expect(mocks.post.mock.calls[0][0]).toEqual({uid:12,isAdmin:false,name:'CubeRoot user'});
});
it('refuses role preview before invoking business services',async()=>{
  const token=[Buffer.from('{}').toString('base64url'),Buffer.from(JSON.stringify({previewId:'other-user'})).toString('base64url'),'signature'].join('.');
  const response=await workspaceRoutes.request('/workspace/session',{headers:{Authorization:`Bearer ${token}`}});
  expect(response.status).toBe(403);expect(mocks.auth).not.toHaveBeenCalled();expect(mocks.get).not.toHaveBeenCalled();
});
