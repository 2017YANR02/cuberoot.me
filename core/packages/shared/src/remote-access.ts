/** Wire contract shared by the browser, API and the host reconciler. */
export const REMOTE_CONNECTION = {
  host: '47.97.30.181', port: 7223, user: 'eula',
  project: '/Users/eula/Documents/cuberoot.me',
  fingerprint: 'SHA256:cIf/2wGQTtneYEGzijiGYpv9s0vsDYsF4zfGBgQNmBg',
} as const;

export function normalizeRemoteKey(value: unknown): string {
  if (typeof value !== 'string' || value.length > 200) throw Error('Invalid public key');
  const match = /^ssh-ed25519 ([A-Za-z0-9+/]{68})$/.exec(value.trim());
  if (!match) throw Error('Only a plain Ed25519 public key is accepted');
  const bytes = Uint8Array.from(atob(match[1]), c => c.charCodeAt(0));
  const header = [0, 0, 0, 11, ...new TextEncoder().encode('ssh-ed25519'), 0, 0, 0, 32];
  if (bytes.length !== 51 || header.some((v, i) => bytes[i] !== v)) throw Error('Invalid Ed25519 encoding');
  return `ssh-ed25519 ${match[1]}`;
}

export function remoteKeyFilename(publicKey: string): string {
  const key = normalizeRemoteKey(publicKey).split(' ')[1];
  return `cuberoot-remote-${key.slice(-20).replace(/\+/g, '-').replace(/\//g, '_')}.key`;
}

export type RemoteAccessStatus = 'pending' | 'approved' | 'active' | 'rejected' | 'revoked';
export interface RemoteAccessRequest {
  id: string; user_id: number; user_name: string; device: string;
  public_key: string; fingerprint: string; status: RemoteAccessStatus;
  created_at: string; applied_at: string | null; removed_at: string | null;
}
export interface RemoteAccessList {
  enabled: boolean; canApprove: boolean; hostOnline: boolean;
  requests: RemoteAccessRequest[];
}
