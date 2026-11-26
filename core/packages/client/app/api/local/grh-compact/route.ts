import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') return new Response(null, { status: 404 });

  try {
    const snapshot = await readFile(path.resolve(process.cwd(), '../../../.local-data/grh-compact.json'), 'utf8');
    return new Response(snapshot, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch {
    return new Response(null, { status: 503 });
  }
}
