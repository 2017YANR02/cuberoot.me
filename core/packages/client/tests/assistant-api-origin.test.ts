import {afterEach,expect,it,vi} from 'vitest';
import {assistantStreamApiUrl} from '@/lib/api-base';
afterEach(()=>vi.unstubAllEnvs());
it('uses the optional assistant-only local origin exclusively in development',()=>{
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('NEXT_PUBLIC_SITE_ASSISTANT_API_ORIGIN','http://localhost:3002/');
  expect(assistantStreamApiUrl()).toBe('http://localhost:3002/v1/site-assistant');
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('NEXT_PUBLIC_API_ORIGIN','https://api.cuberoot.me');
  expect(assistantStreamApiUrl()).toBe('https://api.cuberoot.me/v1/site-assistant');
});
