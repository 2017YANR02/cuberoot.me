import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { normalizeRemoteKey } from '@cuberoot/shared/remote-access';
import { query, withTransaction } from '../db/connection.js';
import { requireAuth, checkRateLimit, type WcaUser } from '../utils/recon_helpers.js';

export const devPreviewRoutes = new Hono();
const owner = (u: WcaUser) => u.isAdmin && u.realWcaId === '2017YANR02';
const enabled = () => (process.env.DEV_PREVIEW_HOST_TOKEN?.length ?? 0) >= 32;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const slug = (s: unknown): s is string => typeof s === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 25;
const fields = 'id,user_id,user_name,owner_slug,device_slug,os,public_key,status,profile,created_at,updated_at';
type Request = {id: string; user_id: number; owner_slug: string; device_slug: string; os: string; status: string; public_key: string | null; profile: unknown};

devPreviewRoutes.use('/dev-preview/*', bodyLimit({maxSize: 8192}));
devPreviewRoutes.use('/dev-preview/*', async (c,next) => { c.header('Cache-Control','no-store'); await next(); });
devPreviewRoutes.use('/dev-preview/requests*', async (c,next) => {
  const decoded = jwt.decode((c.req.header('Authorization') ?? '').replace(/^Bearer /,''));
  if (decoded && typeof decoded === 'object' && decoded.previewId) return c.json({error:'Use your own account'},403);
  await next();
});
devPreviewRoutes.get('/dev-preview/requests', async c => {
  const u = await requireAuth(c), canApprove = owner(u);
  return c.json({enabled:enabled(),canApprove,requests:await query(`SELECT ${fields} FROM dev_preview_requests ${canApprove?'':'WHERE user_id=?'} ORDER BY created_at DESC LIMIT 100`,canApprove?[]:[u.uid])});
});
devPreviewRoutes.post('/dev-preview/requests', async c => {
  const u = await requireAuth(c);
  if (!enabled()) return c.json({error:'Enrollment disabled'},503);
  if (!u.uid) return c.json({error:'Account required'},403);
  checkRateLimit(String(u.uid),{bucket:'dev-preview-enrollment',max:5});
  const b = await c.req.json().catch(()=>null);
  if (!slug(b?.owner) || !slug(b?.device) || !['mac','windows'].includes(b?.os) || b.owner === 'ruimin') return c.json({error:'Invalid or reserved name'},400);
  const ticket = randomBytes(32).toString('hex'), id = randomUUID();
  const result = await withTransaction(async q => {
    await q('SELECT id FROM app_users WHERE id=? FOR UPDATE',[u.uid]);
    const [n] = await q<{n:number}>('SELECT COUNT(*)::int AS n FROM dev_preview_requests WHERE user_id=?',[u.uid]);
    if (n.n>=10) return false;
    const rows=await q('INSERT INTO dev_preview_requests(id,user_id,user_name,owner_slug,device_slug,os,ticket_hash) VALUES(?,?,?,?,?,?,?) ON CONFLICT(owner_slug,device_slug) DO NOTHING RETURNING id',[id,u.uid,u.name.slice(0,200),b.owner,b.device,b.os,hash(ticket)]);
    if(!rows.length) return false;
    await q("INSERT INTO dev_preview_events(request_id,actor_id,action) VALUES(?,?,'created')",[id,u.uid]); return true;
  });
  return result ? c.json({id,ticket}) : c.json({error:'Name reserved or request limit reached'},409);
});
devPreviewRoutes.post('/dev-preview/requests/:id/ticket',async c=>{
  const u=await requireAuth(c);if(!enabled())return c.json({error:'Enrollment disabled'},503);
  checkRateLimit(String(u.uid),{bucket:'dev-preview-ticket',max:5});
  const ticket=randomBytes(32).toString('hex');
  const rows=await query("UPDATE dev_preview_requests SET ticket_hash=?,created_at=NOW(),updated_at=NOW() WHERE id::text=? AND user_id=? AND status='preparing' AND public_key IS NULL RETURNING id",[hash(ticket),c.req.param('id'),u.uid]);
  return rows.length?c.json({ticket}):c.json({error:'Device already bound'},409);
});
devPreviewRoutes.post('/dev-preview/requests/:id/decision',async c=>{
  const u=await requireAuth(c);
  if(!owner(u)) return c.json({error:'Owner only'},403);
  if(!enabled()) return c.json({error:'Enrollment disabled'},503);
  const b=await c.req.json().catch(()=>null);
  if(!['approved','rejected'].includes(b?.decision)) return c.json({error:'Invalid decision'},400);
  const ok=await withTransaction(async q=>{
    const rows=await q("UPDATE dev_preview_requests SET status=?,approved_by=?,updated_at=NOW() WHERE id::text=? AND status IN ('pending','failed') AND public_key IS NOT NULL RETURNING id",[b.decision,u.uid,c.req.param('id')]);
    if(!rows.length) return false;
    await q('INSERT INTO dev_preview_events(request_id,actor_id,action) VALUES(?,?,?)',[c.req.param('id'),u.uid,b.decision]);return true;
  });
  return ok?c.json({ok:true}):c.json({error:'Request changed'},409);
});
// The random ticket is scoped to one device; never accepted as a website session.
devPreviewRoutes.post('/dev-preview/device',async c=>{
  const ticket=(c.req.header('Authorization')??'').replace(/^Bearer /,'');
  if(!/^[a-f0-9]{64}$/.test(ticket)||!enabled()) return c.json({error:'Invalid ticket'},401);
  const b=await c.req.json().catch(()=>null);
  const result=await withTransaction(async q=>{
    const [r]=await q<Request>('SELECT * FROM dev_preview_requests WHERE ticket_hash=? FOR UPDATE',[hash(ticket)]);
    if(!r) return null;
    if(b?.publicKey){
      let key:string;try{key=normalizeRemoteKey(b.publicKey);}catch{return null;}
      if(r.public_key && r.public_key!==key) return null;
      if(!r.public_key){
        const changed=await q("UPDATE dev_preview_requests SET public_key=?,status='pending',updated_at=NOW() WHERE id=? AND status='preparing' AND created_at>NOW()-INTERVAL '24 hours' RETURNING id",[key,r.id]);
        if(!changed.length)return null;
        await q("INSERT INTO dev_preview_events(request_id,action) VALUES(?,'device-linked')",[r.id]);
        r.public_key=key;r.status='pending';
      }
    }
    return {id:`${r.owner_slug}-${r.device_slug}`,os:r.os,status:r.status,profile:r.status==='ready'?r.profile:null};
  });
  return result?c.json(result):c.json({error:'Invalid, expired or mismatched device ticket'},403);
});
devPreviewRoutes.use('/dev-preview/host/*',async(c,next)=>{
  const supplied=(c.req.header('Authorization')??'').replace(/^Bearer /,''),expected=process.env.DEV_PREVIEW_HOST_TOKEN??'';
  if(!enabled()||!timingSafeEqual(Buffer.from(hash(supplied)),Buffer.from(hash(expected))))return c.json({error:'Host only'},401);
  await next();
});
devPreviewRoutes.get('/dev-preview/host/next',async c=>{
  const [r]=await query(`SELECT ${fields} FROM dev_preview_requests WHERE status IN ('approved','provisioning') ORDER BY CASE WHEN status='provisioning' THEN 0 ELSE 1 END,created_at LIMIT 1`);
  return c.json(r??null);
});
devPreviewRoutes.post('/dev-preview/host/:id',async c=>{
  const b=await c.req.json().catch(()=>null);
  if(!['provisioning','ready','failed'].includes(b?.status))return c.json({error:'Invalid state'},400);
  const ok=await withTransaction(async q=>{
    const [r]=await q<Request>("SELECT * FROM dev_preview_requests WHERE id::text=? AND status IN ('approved','provisioning') FOR UPDATE",[c.req.param('id')]);
    if(!r)return false;
    if(b.status==='ready'){
      const p=b.profile;
      if(r.status!=='provisioning'||p?.version!==1||p.id!==`${r.owner_slug}-${r.device_slug}`||p.publicKey!==r.public_key||p.host!=='47.97.30.181'||p.sshPort!==22||p.localPort!==3000||!Number.isInteger(p.remotePort)||p.remotePort<7105||p.remotePort>7198||!/^crdev-[a-f0-9]{12}$/.test(p.sshUser)||p.url!==`https://dev-${p.id}.cuberoot.me/zh`)return false;
      try{normalizeRemoteKey(p.hostKey);}catch{return false;}
    }
    await q('UPDATE dev_preview_requests SET status=?,profile=?,updated_at=NOW() WHERE id=?',[b.status,b.status==='ready'?b.profile:null,r.id]);
    await q('INSERT INTO dev_preview_events(request_id,action) VALUES(?,?)',[r.id,b.status]);return true;
  });
  return ok?c.json({ok:true}):c.json({error:'Invalid transition or profile'},409);
});
