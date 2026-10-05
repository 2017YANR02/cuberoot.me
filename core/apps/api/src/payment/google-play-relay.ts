import { GOOGLE_PLAY_RELAY_HEADER, GOOGLE_PLAY_RELAY_PATH, signGooglePlayRelay, type GooglePlayRelayRequest } from '@cuberoot/shared/google-play-relay';

export const useGooglePlayRelay = () => Boolean(process.env.GOOGLE_PLAY_RELAY_URL);

export async function googlePlayRelay(request: GooglePlayRelayRequest): Promise<Record<string, unknown>> {
  // A configured but invalid relay fails closed; never fall back to another host.
  const url = process.env.GOOGLE_PLAY_RELAY_URL;
  const secret = process.env.GOOGLE_PLAY_RELAY_SECRET ?? '';
  if (url !== `https://google-api.cuberoot.me${GOOGLE_PLAY_RELAY_PATH}` || secret.length < 32) throw new Error('Google Play relay unavailable');
  const body = JSON.stringify(request);
  const proof = await signGooglePlayRelay(secret, body);
  try {
    const response = await fetch(url, { method: 'POST', redirect: 'error', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', [GOOGLE_PLAY_RELAY_HEADER]: proof }, body, signal: AbortSignal.timeout(50_000) });
    if (!response.ok) throw new Error('Relay request failed');
    const result = await response.json();
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid relay response');
    return result;
  } catch { throw new Error('Google Play relay request failed'); }
}
