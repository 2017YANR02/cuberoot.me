export const dynamic = 'force-dynamic';

export function GET(request: Request): Response {
  const country = request.headers.get('x-vercel-ip-country') ?? '';
  // Both production ingress paths supply their own visitor classification.
  const available = process.env.VERCEL === '1'
    ? /^[A-Z]{2}$/.test(country) && !['CN', 'XX', 'ZZ'].includes(country)
    : request.headers.get('x-cuberoot-cn-exempt') === '0';
  return Response.json({ available }, { headers: { 'Cache-Control': 'private, no-store' } });
}
