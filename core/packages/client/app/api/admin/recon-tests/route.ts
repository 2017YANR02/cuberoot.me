import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { verifyPageRole } from '@/lib/page-admin-session';
import { findCheckoutRoot, readTestRuns, readRegressionCases } from '@/lib/recon-test-history.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  try {
    if (await verifyPageRole(token) !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403, headers });
    const root = process.env.NODE_ENV === 'development' ? findCheckoutRoot() : null;
    if (!root) return Response.json({ runs: [], cases: [], scope: 'cloud' }, { headers });
    const offset = Math.max(0, Math.min(100000, Math.floor(Number(new URL(request.url).searchParams.get('offset')) || 0)));
    const runs = readTestRuns(root);
    const cases = readRegressionCases(root);
    const result = spawnSync(process.execPath, [join(root, 'core/scripts/recon-ground-truth-gate.mjs'), 'fingerprint'], { encoding: 'utf8', timeout: 5000 });
    return Response.json({ runs: runs.slice(offset, offset + 20), hasMore: runs.length > offset + 20,
      cases, scope: 'local', currentFingerprint: result.status === 0 ? result.stdout.trim() : null }, { headers });
  } catch { return Response.json({ error: 'Test history unavailable' }, { status: 503, headers }); }
}
