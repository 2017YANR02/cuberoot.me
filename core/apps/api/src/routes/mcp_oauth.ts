import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { isAdminWcaId, isBannedWcaId } from '@cuberoot/shared/admin';
import { query, withTransaction } from '../db/connection.js';
import { getUserById } from '../utils/account.js';
import { checkRateLimit, requireAdmin } from '../utils/recon_helpers.js';
import { getIp } from '../utils/analytics_helpers.js';
import { diagnosticLog } from '../observability/request.js';

export const MCP_RESOURCE = 'https://api.cuberoot.me/v1/mcp';
export const MCP_ISSUER = 'https://api.cuberoot.me';
export const MCP_SCOPE = 'production:read';
export const MCP_CLIENT = 'cuberoot-chatgpt';
const WEB = 'https://cuberoot.me';
const freshToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
const challenge = (value: string) => createHash('sha256').update(value).digest('base64url');
const invalid = () => new Error('Invalid MCP authorization request');

export function trustedRedirect(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^https:\/\/chatgpt\.com\/(?:connector_platform_oauth_redirect|connector\/oauth\/[A-Za-z0-9_-]+)$/.test(value);
}

export function authorizeParams(input: Record<string, unknown>) {
  if (input.client_id !== MCP_CLIENT || input.response_type !== 'code'
    || input.resource !== MCP_RESOURCE || input.scope !== MCP_SCOPE
    || input.code_challenge_method !== 'S256' || !trustedRedirect(input.redirect_uri)
    || typeof input.code_challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.code_challenge)
    || typeof input.state !== 'string' || !input.state || input.state.length > 1024) throw invalid();
  return {
    client_id: MCP_CLIENT, response_type: 'code', resource: MCP_RESOURCE, scope: MCP_SCOPE,
    redirect_uri: input.redirect_uri, code_challenge_method: 'S256',
    code_challenge: input.code_challenge, state: input.state,
  };
}

function callback(params: ReturnType<typeof authorizeParams>, result: Record<string, string>) {
  const url = new URL(params.redirect_uri);
  for (const [key, value] of Object.entries({ ...result, state: params.state, iss: MCP_ISSUER })) url.searchParams.set(key, value);
  return url.toString();
}

export async function currentAdmin(uid: number) {
  const user = await getUserById(uid);
  return !!user && Number(user.id) === Number(uid) && !isBannedWcaId(user.wca_id)
    && (user.is_admin === true || isAdminWcaId(user.wca_id));
}

interface Grant {
  id: string; user_id: number; redirect_uri: string; code_challenge: string;
}

// Opaque MCP credentials never share the website session JWT signing key or permissions.
export async function verifyMcpAccess(header?: string): Promise<Grant | null> {
  if (!header || !/^Bearer [A-Za-z0-9_-]{43}$/.test(header)) return null;
  const [grant] = await query<Grant>(`SELECT id, user_id FROM mcp_oauth_grants
    WHERE access_hash = ? AND access_expires_at > NOW() AND expires_at > NOW() AND revoked_at IS NULL`, [tokenHash(header.slice(7))]);
  return grant && await currentAdmin(grant.user_id) ? grant : null;
}

export const mcpDiscoveryRoutes = new Hono();
mcpDiscoveryRoutes.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
mcpDiscoveryRoutes.get('/.well-known/oauth-protected-resource/v1/mcp', c => c.json({
  resource: MCP_RESOURCE, authorization_servers: [MCP_ISSUER], scopes_supported: [MCP_SCOPE],
  bearer_methods_supported: ['header'], resource_name: 'CubeRoot production diagnostics',
}));
mcpDiscoveryRoutes.get('/.well-known/oauth-authorization-server', c => c.json({
  issuer: MCP_ISSUER, authorization_endpoint: `${MCP_RESOURCE}/oauth/authorize`,
  token_endpoint: `${MCP_RESOURCE}/oauth/token`, registration_endpoint: `${MCP_RESOURCE}/oauth/register`,
  revocation_endpoint: `${MCP_RESOURCE}/oauth/revoke`,
  response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'],
  token_endpoint_auth_methods_supported: ['none'], scopes_supported: [MCP_SCOPE],
  code_challenge_methods_supported: ['S256'], authorization_response_iss_parameter_supported: true,
}));

export const mcpOauthRoutes = new Hono();
mcpOauthRoutes.use('/mcp/oauth/*', bodyLimit({ maxSize: 8192, onError: c => c.json({ error: 'invalid_request' }, 413) }));
mcpOauthRoutes.use('/mcp/oauth/*', async (c, next) => {
  c.header('Cache-Control', 'no-store'); c.header('Pragma', 'no-cache');
  try { checkRateLimit(getIp(c), { bucket: 'mcp-oauth', max: 60 }); }
  catch { c.header('Retry-After', '60'); return c.json({ error: 'slow_down' }, 429); }
  const origin = c.req.header('Origin');
  if (origin && origin !== WEB && origin !== 'https://chatgpt.com'
    && !(process.env.NODE_ENV !== 'production' && origin === 'http://localhost:3000')) return c.json({ error: 'invalid_request' }, 403);
  await next();
});
mcpOauthRoutes.onError((error, c) => {
  const known = error.message === invalid().message;
  diagnosticLog('mcp_oauth_error', { category: known ? 'invalid_request' : 'authorization_failed' }, true);
  return c.json({ error: known ? 'invalid_request' : 'access_denied' }, known ? 400 : 403);
});

// One public, PKCE-only client with an exact trusted callback allowlist. No remote metadata fetch.
mcpOauthRoutes.post('/mcp/oauth/register', async c => {
  const body = await c.req.json();
  if (!Array.isArray(body.redirect_uris) || !body.redirect_uris.length || body.redirect_uris.length > 5
    || !body.redirect_uris.every(trustedRedirect)
    || (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== 'none')) throw invalid();
  return c.json({ client_id: MCP_CLIENT, client_name: 'ChatGPT', redirect_uris: body.redirect_uris,
    token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }, 201);
});
mcpOauthRoutes.get('/mcp/oauth/authorize', c => {
  const params = authorizeParams(c.req.query());
  return c.redirect(`${WEB}/account/mcp?${new URLSearchParams(params)}`);
});
mcpOauthRoutes.post('/mcp/oauth/consent', async c => {
  const user = await requireAdmin(c);
  if (!user.uid || !await currentAdmin(user.uid)) throw new Error('Admin access required');
  const body = await c.req.json();
  const params = authorizeParams(body);
  if (body.approve === false) return c.json({ redirect: callback(params, { error: 'access_denied' }) });
  if (body.approve !== true) throw invalid();
  const code = freshToken();
  const id = randomUUID();
  // Bound retained state per administrator; expired/revoked grants contain no recoverable credentials.
  await withTransaction(async run => {
    await run('SELECT id FROM app_users WHERE id = ? FOR UPDATE', [user.uid]);
    const [{ count }] = await run<{ count: string }>(`SELECT COUNT(*) AS count FROM mcp_oauth_grants
      WHERE user_id = ? AND expires_at > NOW() AND revoked_at IS NULL
        AND (code_expires_at > NOW() OR refresh_hash IS NOT NULL)`, [user.uid]);
    if (Number(count) >= 10) throw new Error('Revoke an existing MCP connection first');
    await run(`INSERT INTO mcp_oauth_grants(id,user_id,redirect_uri,code_hash,code_challenge,code_expires_at)
      VALUES(?,?,?,?,?,NOW() + INTERVAL '5 minutes')`, [id, user.uid, params.redirect_uri, tokenHash(code), params.code_challenge]);
  });
  diagnosticLog('mcp_consent', { grantId: id, actorId: user.uid });
  return c.json({ redirect: callback(params, { code }) });
});
mcpOauthRoutes.post('/mcp/oauth/token', async c => {
  const body = await c.req.parseBody();
  if (body.client_id !== MCP_CLIENT || body.resource !== MCP_RESOURCE
    || (body.scope !== undefined && body.scope !== MCP_SCOPE)) return c.json({ error: 'invalid_request' }, 400);
  const isCode = body.grant_type === 'authorization_code';
  if (!isCode && body.grant_type !== 'refresh_token') return c.json({ error: 'unsupported_grant_type' }, 400);
  const credential = isCode ? body.code : body.refresh_token;
  if (typeof credential !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(credential)) return c.json({ error: 'invalid_grant' }, 400);
  if (isCode && (typeof body.code_verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(body.code_verifier)
    || !trustedRedirect(body.redirect_uri))) return c.json({ error: 'invalid_grant' }, 400);
  const access = freshToken(), refresh = freshToken();
  const success = await withTransaction(async run => {
    const [grant] = await run<Grant & { refresh_hash: string }>(`SELECT * FROM mcp_oauth_grants
      WHERE ${isCode ? 'code_hash = ? AND code_expires_at > NOW()' : 'refresh_hash = ?'}
        AND expires_at > NOW() AND revoked_at IS NULL FOR UPDATE`, [tokenHash(credential)]);
    if (!grant) {
      if (!isCode) await run(`UPDATE mcp_oauth_grants SET revoked_at = NOW()
        WHERE previous_refresh_hash = ? AND revoked_at IS NULL`, [tokenHash(credential)]);
      return false;
    }
    if (!await currentAdmin(grant.user_id)) return false;
    if (isCode && (grant.redirect_uri !== body.redirect_uri || grant.code_challenge !== challenge(body.code_verifier as string))) return false;
    await run(`UPDATE mcp_oauth_grants SET code_hash = NULL, access_hash = ?,
      access_expires_at = NOW() + INTERVAL '10 minutes', previous_refresh_hash = refresh_hash, refresh_hash = ? WHERE id = ?`,
    [tokenHash(access), tokenHash(refresh), grant.id]);
    return true;
  });
  if (!success) return c.json({ error: 'invalid_grant' }, 400);
  return c.json({ access_token: access, token_type: 'Bearer', expires_in: 600, refresh_token: refresh, scope: MCP_SCOPE });
});
mcpOauthRoutes.post('/mcp/oauth/revoke', async c => {
  const body = await c.req.parseBody();
  if (body.client_id !== MCP_CLIENT || typeof body.token !== 'string' || body.token.length > 128) throw invalid();
  const hash = tokenHash(body.token);
  await query(`UPDATE mcp_oauth_grants SET revoked_at = NOW() WHERE access_hash = ? OR refresh_hash = ?`, [hash, hash]);
  return c.body(null, 200);
});
mcpOauthRoutes.get('/mcp/oauth/connections', async c => {
  const user = await requireAdmin(c);
  if (!user.uid || !await currentAdmin(user.uid)) throw new Error('Admin access required');
  return c.json({ connections: await query(`SELECT id, created_at, expires_at FROM mcp_oauth_grants
    WHERE user_id = ? AND revoked_at IS NULL AND expires_at > NOW()
      AND (code_expires_at > NOW() OR refresh_hash IS NOT NULL) ORDER BY created_at DESC LIMIT 10`, [user.uid]) });
});
mcpOauthRoutes.post('/mcp/oauth/connections/revoke', async c => {
  const user = await requireAdmin(c);
  if (!user.uid || !await currentAdmin(user.uid)) throw new Error('Admin access required');
  const body = await c.req.json();
  if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/.test(body.id)) throw invalid();
  await query('UPDATE mcp_oauth_grants SET revoked_at = NOW() WHERE id = ? AND user_id = ?', [body.id, user.uid]);
  diagnosticLog('mcp_revoked', { grantId: body.id, actorId: user.uid });
  return c.json({ ok: true });
});
