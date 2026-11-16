import { Hono } from 'hono';
import { createHash, randomBytes } from 'node:crypto';
import { query } from '../db/connection.js';

// Mounted only inside the existing dedicated host-token authentication boundary.
export const devPreviewLeaseRoutes = new Hono();
export const leaseHash = (value: string) => createHash('sha256').update(value).digest('hex');
const header = 'X-Preview-Lease';
const validLease = (value: string) => /^[a-f0-9]{64}$/.test(value);

devPreviewLeaseRoutes.post('/', async c => {
  const body = await c.req.json().catch(() => null);
  if (typeof body?.worker !== 'string' || !/^[a-zA-Z0-9._-]{1,100}$/.test(body.worker)) return c.json({error:'Invalid worker name'},400);
  const lease = randomBytes(32).toString('hex');
  const [row] = await query<{checkpoint: unknown}>(
    "UPDATE dev_preview_worker SET lease_hash=?,worker_name=?,expires_at=NOW()+INTERVAL '120 seconds',updated_at=NOW() WHERE singleton AND (expires_at IS NULL OR expires_at<=NOW()) RETURNING checkpoint",
    [leaseHash(lease),body.worker]);
  return row ? c.json({lease,checkpoint:row.checkpoint}) : c.json({error:'Another worker is active'},409);
});
devPreviewLeaseRoutes.post('/renew',async c=>{
  const lease=c.req.header(header)??'';
  if(!validLease(lease))return c.json({error:'Lease required'},409);
  const rows=await query("UPDATE dev_preview_worker SET expires_at=NOW()+INTERVAL '120 seconds',updated_at=NOW() WHERE singleton AND lease_hash=? AND expires_at>NOW() RETURNING singleton",[leaseHash(lease)]);
  return rows.length?c.json({ok:true}):c.json({error:'Lease expired'},409);
});
devPreviewLeaseRoutes.post('/checkpoint',async c=>{
  const lease=c.req.header(header)??'',body=await c.req.json().catch(()=>null);
  if(!validLease(lease))return c.json({error:'Lease required'},409);
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['requestId','baseSha','registry','commits','retryAt','attempt'].includes(k)))return c.json({error:'Invalid checkpoint'},400);
  const rows=await query('UPDATE dev_preview_worker SET checkpoint=?,updated_at=NOW() WHERE singleton AND lease_hash=? AND expires_at>NOW() RETURNING singleton',[body,leaseHash(lease)]);
  return rows.length?c.json({ok:true}):c.json({error:'Lease expired'},409);
});
devPreviewLeaseRoutes.post('/release',async c=>{
  const lease=c.req.header(header)??'';
  if(!validLease(lease))return c.json({error:'Lease required'},409);
  const rows=await query('UPDATE dev_preview_worker SET lease_hash=NULL,worker_name=NULL,expires_at=NULL,updated_at=NOW() WHERE singleton AND lease_hash=? RETURNING singleton',[leaseHash(lease)]);
  return rows.length?c.json({ok:true}):c.json({error:'Lease changed'},409);
});
