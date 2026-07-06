// /api/google-verify — 墙外 Google 验真中继(必须由 Vercel 服务,不能落到自有云服务器)。
//
// 为什么存在:自有云服务器(api.cuberoot.me 后端所在)出网到 Google 全域被墙,无法自己
// 回调 Google userinfo 验 access_token。Vercel 函数跑在墙外,到 Google 无障碍,故:
//   浏览器拿到 access_token → POST 到本路由(经 edge.cuberoot.me,仅指向 Vercel)
//   → 本路由向 Google userinfo 验真,取 sub/email/name/picture
//   → 用 GOOGLE_RELAY_SECRET 签一个 HS256 短期断言(exp 120s,iss=cuberoot-google-relay)
//   → 浏览器把断言发给 /v1/auth/google | /link/google,后端只验断言签名,永不碰 Google。
//
// GOOGLE_RELAY_SECRET 必须与后端 .env 的同名值逐字一致(此路由签、后端 utils/google.ts 验)。
// 部署:该路由随主站部署到 Vercel;自有服务器上同名路由虽也存在但浏览器永不打到(入口锁 edge 子域)。

import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const RELAY_SECRET = process.env.GOOGLE_RELAY_SECRET || '';
const RELAY_ISS = 'cuberoot-google-relay';

// 允许发起验真的站点 origin(浏览器跨域到本子域,需放行 + 处理预检)。
const ALLOWED_ORIGINS = new Set([
  'https://cuberoot.me',
  'https://www.cuberoot.me',
  'https://next.cuberoot.me',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://cuberoot.me';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

/** 手写 HS256 JWT(无需引 jsonwebtoken 到浏览器包);后端 jwt.verify 可正常校验。 */
function signHs256(payload: Record<string, unknown>, secret: string): string {
  const data = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function json(body: unknown, status: number, extra: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });
}

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

export async function POST(req: Request): Promise<Response> {
  const cors = corsHeaders(req.headers.get('origin'));
  if (!RELAY_SECRET) return json({ error: 'relay not configured' }, 503, cors);

  const { accessToken } = (await req.json().catch(() => ({}))) as { accessToken?: string };
  if (!accessToken) return json({ error: 'accessToken required' }, 400, cors);

  let info: { sub?: string; email?: string; name?: string; picture?: string };
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return json({ error: 'invalid Google token' }, 401, cors);
    info = (await res.json()) as typeof info;
  } catch {
    return json({ error: 'google verification failed' }, 502, cors);
  }
  if (!info?.sub) return json({ error: 'invalid Google token' }, 401, cors);

  const now = Math.floor(Date.now() / 1000);
  const assertion = signHs256(
    { sub: info.sub, email: info.email, name: info.name, picture: info.picture, iss: RELAY_ISS, iat: now, exp: now + 120 },
    RELAY_SECRET,
  );
  return json({ assertion }, 200, cors);
}
