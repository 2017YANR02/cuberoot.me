import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

vi.mock('../src/db/connection.js', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('../src/utils/account.js', () => ({ getUserById: vi.fn() }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAdmin: vi.fn(), checkRateLimit: vi.fn() }));
vi.mock('../src/observability/request.js', () => ({ diagnosticLog: vi.fn() }));
import { query, withTransaction } from '../src/db/connection.js';
import { getUserById } from '../src/utils/account.js';
import { requireAdmin, checkRateLimit } from '../src/utils/recon_helpers.js';
import { diagnosticLog } from '../src/observability/request.js';
import { captureDiagnostic, recentDiagnostics } from '../src/observability/diagnostic-buffer.js';
import { createProductionMcp, mcpRoutes, mcpRateAllowed } from '../src/routes/mcp.js';
import { authorizeParams, currentAdmin, mcpDiscoveryRoutes, mcpOauthRoutes, MCP_CLIENT, MCP_RESOURCE, MCP_SCOPE, tokenHash, verifyMcpAccess } from '../src/routes/mcp_oauth.js';

const verifier = 'a'.repeat(43);
const params = { client_id: MCP_CLIENT, response_type: 'code', resource: MCP_RESOURCE, scope: MCP_SCOPE,
  redirect_uri: 'https://chatgpt.com/connector_platform_oauth_redirect', state: 'state-123',
  code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' };
const grant = { id: '10000000-0000-4000-8000-000000000001', user_id: 12, redirect_uri: params.redirect_uri, code_challenge: params.code_challenge };
const request = (path: string, data: unknown, form = false) => mcpOauthRoutes.request(`/mcp/oauth/${path}`, {
  method: 'POST', headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
  body: form ? new URLSearchParams(data as Record<string, string>).toString() : JSON.stringify(data),
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(query).mockResolvedValue([]);
  vi.mocked(withTransaction).mockImplementation(run => run(query));
  vi.mocked(requireAdmin).mockResolvedValue({ uid: 12, wcaId: 'u12', name: '', isAdmin: true });
  vi.mocked(getUserById).mockResolvedValue({ id: 12, wca_id: null, is_admin: true } as never);
});
afterEach(() => vi.restoreAllMocks());

describe('MCP OAuth boundaries', () => {
  it.each([
    { redirect_uri: 'https://chatgpt.com.evil.test/connector_platform_oauth_redirect' },
    { redirect_uri: 'https://chatgpt.com/connector_platform_oauth_redirect?next=evil' },
    { client_id: 'someone-else' }, { resource: 'https://elsewhere.test/mcp' },
    { scope: 'admin:write' }, { code_challenge_method: 'plain' }, { code_challenge: 'short' },
    { state: '' }, { response_type: 'token' },
  ])('rejects altered authorization parameters %j', change => {
    expect(() => authorizeParams({ ...params, ...change })).toThrow('Invalid MCP');
  });
  it('advertises PKCE and issuer identification and redirects only to consent', async () => {
    const metadata = await (await mcpDiscoveryRoutes.request('/.well-known/oauth-authorization-server')).json();
    expect(metadata.code_challenge_methods_supported).toEqual(['S256']);
    expect(metadata.authorization_response_iss_parameter_supported).toBe(true);
    const response = await mcpOauthRoutes.request(`/mcp/oauth/authorize?${new URLSearchParams(params)}`);
    expect(new URL(response.headers.get('Location')!).pathname).toBe('/account/mcp');
    expect(query).not.toHaveBeenCalled();
  });
  it('registers only trusted ChatGPT public clients', async () => {
    expect((await request('register', { redirect_uris: [params.redirect_uri], token_endpoint_auth_method: 'none' })).status).toBe(201);
    expect((await request('register', { redirect_uris: ['https://evil.test'] })).status).toBe(400);
  });
  it('declining creates no grant and returns state and issuer', async () => {
    const response = await request('consent', { ...params, approve: false });
    const target = new URL((await response.json()).redirect);
    expect(target.searchParams.get('error')).toBe('access_denied');
    expect(target.searchParams.get('state')).toBe(params.state);
    expect(target.searchParams.get('iss')).toBe('https://api.cuberoot.me');
    expect(query).not.toHaveBeenCalled();
  });
  it('stores a hash after explicit administrator consent, never the returned code', async () => {
    vi.mocked(query).mockImplementation(async sql => sql.includes('COUNT(*)') ? [{ count: '0' }] : []);
    const response = await request('consent', { ...params, approve: true });
    expect(response.status).toBe(200);
    const code = new URL((await response.json()).redirect).searchParams.get('code')!;
    const insert = vi.mocked(query).mock.calls.find(([sql]) => sql.includes('INSERT INTO'))!;
    expect(insert[1]).toContain(tokenHash(code));
    expect(JSON.stringify(insert)).not.toContain(code);
    expect(JSON.stringify(vi.mocked(diagnosticLog).mock.calls)).not.toContain(code);
  });
  it('blocks ordinary users, demoted admins and merged source accounts', async () => {
    vi.mocked(getUserById).mockResolvedValue({ id: 12, is_admin: false, wca_id: null } as never);
    expect(await currentAdmin(12)).toBe(false);
    expect((await request('consent', { ...params, approve: true })).status).toBe(403);
    vi.mocked(getUserById).mockResolvedValue({ id: 13, is_admin: true } as never);
    expect(await currentAdmin(12)).toBe(false);
    vi.mocked(getUserById).mockResolvedValue(null);
    expect(await currentAdmin(12)).toBe(false);
  });
  it('verifies PKCE, redirect and resource before consuming a one-time code', async () => {
    vi.mocked(query).mockResolvedValue([grant]);
    const body = { client_id: MCP_CLIENT, resource: MCP_RESOURCE, grant_type: 'authorization_code', code: 'c'.repeat(43), code_verifier: verifier, redirect_uri: params.redirect_uri };
    expect((await request('token', { ...body, code_verifier: 'b'.repeat(43) }, true)).status).toBe(400);
    expect(vi.mocked(query).mock.calls.every(([sql]) => !/^UPDATE\b/.test(sql))).toBe(true);
    const response = await request('token', body, true);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const tokens = await response.json();
    expect(tokens.expires_in).toBe(600);
    const update = vi.mocked(query).mock.calls.find(([sql]) => sql.includes('SET code_hash = NULL'))!;
    expect(update[1]).toContain(tokenHash(tokens.access_token));
    expect(update[1]).toContain(tokenHash(tokens.refresh_token));
    expect(JSON.stringify(update)).not.toContain(tokens.access_token);
    expect(vi.mocked(query).mock.calls.some(([sql]) => sql.includes('FOR UPDATE'))).toBe(true);
    vi.mocked(query).mockResolvedValue([]);
    expect((await request('token', body, true)).status).toBe(400);
    expect((await request('token', { ...body, resource: 'wrong' }, true)).status).toBe(400);
  });
  it('refresh-token replay revokes the preceding token family and absent/expired credentials fail closed', async () => {
    expect(await verifyMcpAccess('Bearer website.jwt.token')).toBeNull();
    expect(await verifyMcpAccess(`Bearer ${'x'.repeat(43)}`)).toBeNull();
    expect((await request('token', { client_id: MCP_CLIENT, resource: MCP_RESOURCE, grant_type: 'refresh_token', refresh_token: 'x'.repeat(43) }, true)).status).toBe(400);
    expect(vi.mocked(query).mock.calls.some(([sql]) => sql.includes('previous_refresh_hash = ?'))).toBe(true);
  });
  it('connection revocation is restricted to the signed-in owner', async () => {
    expect((await request('connections/revoke', { id: grant.id })).status).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('AND user_id = ?'), [grant.id, 12]);
  });
  it('challenges unauthenticated MCP clients, rejects browser cross-origin requests and rate limits', async () => {
    const response = await mcpRoutes.request('/mcp', { method: 'POST' });
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('/.well-known/oauth-protected-resource/v1/mcp');
    expect((await mcpRoutes.request('/mcp', { headers: { Origin: 'https://evil.test' } })).status).toBe(403);
    vi.mocked(checkRateLimit).mockImplementation(() => { throw new Error('Rate limit'); });
    expect((await request('register', {})).status).toBe(429);
    for (let i = 0; i < 30; i++) expect(mcpRateAllowed('test-rate', 100)).toBe(true);
    expect(mcpRateAllowed('test-rate', 100)).toBe(false);
    expect(mcpRateAllowed('test-rate', 60100)).toBe(true);
  });
});

describe('MCP protocol and evidence privacy', () => {
  it('serves stateless Streamable HTTP initialization, discovery and diagnostics, then denies demoted admins', async () => {
    vi.mocked(query).mockResolvedValue([grant]);
    const send = (method: string, params?: unknown) => mcpRoutes.request('/mcp', {
      method: 'POST', headers: { Authorization: `Bearer ${'a'.repeat(43)}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const init = await send('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    expect(init.status).toBe(200);
    expect((await init.json()).result.serverInfo.name).toBe('cuberoot-production');
    expect(init.headers.get('Cache-Control')).toBe('no-store');
    expect((await (await send('tools/list')).json()).result.tools).toHaveLength(4);
    expect((await (await send('tools/call', { name: 'recent_diagnostics', arguments: { limit: 1 } })).json()).result.isError).not.toBe(true);
    vi.mocked(getUserById).mockResolvedValue({ id: 12, is_admin: false } as never);
    expect((await send('tools/list')).status).toBe(401);
    expect((await mcpRoutes.request('/mcp', { method: 'POST', headers: { 'Content-Length': '65537' }, body: 'x'.repeat(65_537) })).status).toBe(413);
  });
  it('the official SDK client discovers only read-only tools; rejects invalid input and reports failures without leaking errors', async () => {
    const run = vi.fn().mockResolvedValue([{ active_personal: '7', active_enterprise: '2' }]);
    const server = createProductionMcp(12, grant.id, run);
    const client = new Client({ name: 'test', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a); await client.connect(b);
    try {
      const { tools } = await client.listTools();
      expect(tools.map(tool => tool.name)).toEqual(['registration_trend', 'membership_summary', 'database_activity', 'recent_diagnostics']);
      for (const tool of tools) expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
      const result = await client.callTool({ name: 'membership_summary', arguments: {} });
      expect(result.isError).not.toBe(true);
      expect(JSON.stringify(result)).toContain('active_personal');
      const invalid = await client.callTool({ name: 'registration_trend', arguments: { from: '2026-02-30', to: '2026-03-01' } });
      expect(invalid.isError).toBe(true);
      expect(JSON.stringify(invalid)).toContain('invalid activity date');
      const limit = await client.callTool({ name: 'recent_diagnostics', arguments: { limit: 101 } });
      expect(limit.isError).toBe(true);
      run.mockRejectedValue(new Error('password=secret SQL private row'));
      const failed = await client.callTool({ name: 'membership_summary', arguments: {} });
      expect(failed.isError).toBe(true);
      expect(JSON.stringify(failed)).not.toContain('secret');
      expect(diagnosticLog).toHaveBeenCalledWith('mcp_tool_call', expect.objectContaining({ actorId: 12, tool: 'membership_summary', ok: false }));
    } finally { await client.close(); await server.close(); }
  });
  it('keeps only finite numeric allowlisted fields and caps retained samples', () => {
    captureDiagnostic('secret_event', { password: 'secret' });
    for (let i = 0; i < 1005; i++) captureDiagnostic('api_runtime', { rssMiB: i, cpuPercent: Infinity, password: 'secret', url: '/private' });
    const result = recentDiagnostics(100);
    expect(result.retained).toBe(1000);
    expect(result.samples).toHaveLength(100);
    expect(result.samples.at(-1)?.metrics).toEqual({ rssMiB: 1004 });
    expect(JSON.stringify(result)).not.toMatch(/secret|private|Infinity/);
    expect(() => recentDiagnostics(101)).toThrow();
  });
});
