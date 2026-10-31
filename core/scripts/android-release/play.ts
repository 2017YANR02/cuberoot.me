import { createSign, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** Credentials are read from a protected CI temporary file, never included in artifacts. */
export async function playClient(credentialPath: string) {
  const key = JSON.parse(readFileSync(credentialPath, 'utf8'));
  if (key.type !== 'service_account') throw new Error('Google Play service-account credentials required');
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const signature = createSign('RSA-SHA256').update(body).sign(key.private_key, 'base64url');
  const auth = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${body}.${signature}` }), signal: AbortSignal.timeout(30_000) });
  if (!auth.ok) throw new Error(`Google authorization failed (${auth.status})`);
  const token = (await auth.json()).access_token;
  async function request(path: string, method = 'GET', data?: unknown, upload?: Buffer) {
    const origin = upload ? 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/' : 'https://androidpublisher.googleapis.com/androidpublisher/v3/';
    const response = await fetch(`${origin}applications/me.cuberoot.app/${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': upload ? 'application/octet-stream' : 'application/json' },
      body: upload ?? (data === undefined ? undefined : JSON.stringify(data)), signal: AbortSignal.timeout(upload ? 300_000 : 30_000),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Google Play ${response.status}: ${error.error?.message ?? 'request failed'}`);
    }
    return response.status === 204 ? {} : response.json();
  }
  return {
    async inspect() {
      const edit = await request('edits', 'POST', {});
      try {
        const [tracks, bundles, apks] = await Promise.all([request(`edits/${edit.id}/tracks`), request(`edits/${edit.id}/bundles`), request(`edits/${edit.id}/apks`)]);
        const codes = [...(bundles.bundles ?? []), ...(apks.apks ?? [])].map(x => Number(x.versionCode));
        for (const t of tracks.tracks ?? []) for (const r of t.releases ?? []) codes.push(...(r.versionCodes ?? []).map(Number));
        return { maxVersionCode: Math.max(1004, ...codes), tracks: tracks.tracks ?? [] };
      } finally { await request(`edits/${edit.id}`, 'DELETE'); }
    },
    async publish(aab: string, versionCode: number, track: 'internal' | 'production', versionName: string, notes: string) {
      if (!notes.trim() || [...notes].length > 500) throw new Error('Play release notes must contain 1–500 characters');
      const edit = await request('edits', 'POST', {});
      let committed = false;
      try {
        const bytes = readFileSync(aab);
        const uploaded = await request(`edits/${edit.id}/bundles?uploadType=media`, 'POST', undefined, bytes);
        if (Number(uploaded.versionCode) !== versionCode || uploaded.sha256 !== createHash('sha256').update(bytes).digest('hex')) throw new Error('Play upload identity mismatch');
        await request(`edits/${edit.id}/tracks/${track}`, 'PUT', { track, releases: [{ name: `${versionName} (${versionCode})`, versionCodes: [String(versionCode)], status: 'completed', releaseNotes: [
          { language: 'zh-CN', text: notes.trim() },
          { language: 'en-US', text: notes.trim() },
        ] }] });
        await request(`edits/${edit.id}:validate`, 'POST');
        const result = await request(`edits/${edit.id}:commit`, 'POST');
        committed = true;
        return result;
      } finally { if (!committed) await request(`edits/${edit.id}`, 'DELETE').catch(() => {}); }
    },
  };
}
