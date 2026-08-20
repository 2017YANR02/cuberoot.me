import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFile(new URL(relative, import.meta.url), 'utf8');

describe('recon video upload contract', () => {
  it('keeps the migration and schema snapshot aligned', async () => {
    const [migration, schema] = await Promise.all([
      read('../migrations/0162_recon_video_uploads.sql'),
      read('../src/db/schema.pg.sql'),
    ]);

    expect(migration).toContain('CREATE TABLE recon_videos');
    expect(migration).toContain('owner_wca_id');
    expect(migration).toContain("mime IN ('video/mp4', 'video/webm', 'video/quicktime')");
    expect(migration).toContain('size_bytes BETWEEN 1 AND 209715200');
    const normalizeSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();
    expect(normalizeSql(schema)).toContain(normalizeSql(migration));
  });

  it('enforces authentication, active membership, quotas, sniffing, and atomic storage', async () => {
    const route = await read('../src/routes/recon.ts');
    const membershipGate = await read('../src/utils/membership.ts');
    const uploadStart = route.indexOf("reconRoutes.post('/recon/video'");
    const streamStart = route.indexOf("reconRoutes.get('/recon/video/:id'");
    const upload = route.slice(uploadStart, streamStart);

    expect(uploadStart).toBeGreaterThan(-1);
    expect(streamStart).toBeGreaterThan(uploadStart);
    expect(membershipGate).toContain('if (isAdminWcaId(wcaId)) return true');
    expect(upload).toContain('requireAuth(c)');
    expect(upload).toContain('hasActiveMembership(authUser.wcaId)');
    expect(upload).toContain('RECON_VIDEO_MAX_BYTES');
    expect(upload).toContain('RECON_VIDEO_DAILY_BYTES');
    expect(upload).toContain('RECON_VIDEO_DAILY_COUNT');
    expect(upload).toContain('sniffVideo(signature)');
    expect(upload).toContain("const tempKey = `${stem}.part`");
    expect(upload).toContain('await fs.rename(tempPath, finalPath)');
    expect(route.indexOf("reconRoutes.get('/recon/video/:id'")).toBeLessThan(
      route.indexOf("reconRoutes.get('/recon/:id'"),
    );
  });

  it('reports administrators as members from the canonical membership endpoint', async () => {
    const [route, teachers] = await Promise.all([
      read('../src/routes/membership.ts'),
      read('../src/routes/wca_teachers.ts'),
    ]);
    const start = route.indexOf("membershipRoutes.get('/membership/me'");
    const block = route.slice(start, route.indexOf("membershipRoutes.put('/membership/me/contact'", start));

    expect(start).toBeGreaterThan(-1);
    expect(block).toContain('isAdminWcaId(user.wcaId) || !!membership?.active');
    expect(teachers).toContain("import { hasActiveMembership } from '../utils/membership.js'");
    expect(teachers).toContain('await hasActiveMembership(actorWcaId)');
  });

  it('configures the API proxy for a streamed 200MB raw upload', async () => {
    const nginx = await read('../../../../ops/nginx/www.cuberoot.me.conf');
    const start = nginx.indexOf('location = /v1/recon/video');
    const block = nginx.slice(start, nginx.indexOf('\n    }', start));

    expect(start).toBeGreaterThan(-1);
    expect(block).toContain('client_max_body_size 200m');
    expect(block).toContain('proxy_request_buffering off');
    expect(block).toContain('proxy_buffering off');
  });
});
