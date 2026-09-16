import { createHash } from 'node:crypto';

export function parsePushDevice(value: unknown, revoke = false): { installationId: string; secretHash: string; appId: string; clientId: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !['installationId', 'secret', ...(revoke ? [] : ['appId', 'clientId'])].includes(key))) return null;
  if (typeof body.installationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.installationId)
    || typeof body.secret !== 'string' || !/^[0-9a-f]{64}$/.test(body.secret)) return null;
  if (!revoke && (!['me.cuberoot.app', 'me.cuberoot.app.debug'].includes(String(body.appId))
    || typeof body.clientId !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(body.clientId))) return null;
  return { installationId: body.installationId, secretHash: createHash('sha256').update(body.secret).digest('hex'),
    appId: revoke ? '' : body.appId as string, clientId: revoke ? '' : body.clientId as string };
}
