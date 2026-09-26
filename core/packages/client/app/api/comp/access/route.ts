/** Retained for old clients: automatic browser checks no longer mint access. */
export async function GET() {
  return Response.json({ code: 'competition_verification_required', verificationUrl: '/competition-verify' }, {
    status: 403, headers: { 'cache-control': 'private, no-store' },
  });
}
