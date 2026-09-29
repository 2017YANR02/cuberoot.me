import { verifyPageRole } from '@/lib/page-admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', Vary: 'Authorization' };
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  try {
    const role = await verifyPageRole(token);
    if (role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: role === 'login' ? 401 : 403, headers });
    const { loadInterviewDraft } = await import('./content');
    return Response.json(await loadInterviewDraft(), { headers });
  } catch {
    return Response.json({ error: 'Account verification unavailable' }, { status: 503, headers });
  }
}
