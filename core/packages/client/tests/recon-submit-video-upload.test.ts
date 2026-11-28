import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const form = readFileSync(join(CLIENT, 'app/[lang]/recon/submit/ReconSubmitForm.tsx'), 'utf8');
const api = readFileSync(join(CLIENT, 'lib/recon-api.ts'), 'utf8');
const membershipHook = readFileSync(join(CLIENT, 'hooks/useMembership.ts'), 'utf8');
const videoStart = form.indexOf('htmlFor="recon-video-urls"');
const videoEnd = form.indexOf('<div className="submit-row">', videoStart);
const videoRegion = form.slice(videoStart, videoEnd);

describe('recon submit video upload', () => {
  it('offers the original video to members and retains the existing URL fields', () => {
    expect(form).toContain('const { isMember } = useMembership()');
    expect(videoRegion).toContain('isMember && localVideo && <button');
    expect(videoRegion).toContain('作为本次复盘视频');
    expect(videoRegion.indexOf('<textarea')).toBeGreaterThan(videoRegion.indexOf('splitReconVideoGroups'));
    expect(videoRegion).toContain("'recon-video-urls'");
  });

  it('treats administrators as members before the membership request resolves', () => {
    expect(membershipHook).toContain('const admin = isAdminWcaId(wcaId)');
    expect(membershipHook).toContain('isMember: admin || memberAccess');
  });

  it('uploads through the authenticated API then appends the public URL to the existing field', () => {
    expect(form).toContain('await uploadReconVideo(videoForSubmit.file)');
    expect(form).toContain("appendReconVideo(data.videoUrl || '', url)");
    expect(api).toContain("new Headers(authHeaders(false))");
    expect(api).toContain("sessionFetch(`${API_BASE}/video`");
    expect(api).toContain("publicApiUrl(`/v1/recon/video/${result.id}`)");
  });

  it('keeps the form locked while submitting the reconstruction and its video', () => {
    expect(form).toContain('className="submit-form" disabled={readOnly || saving}');
    expect(form).toContain('disabled={saving || groupMatchPending}');
  });
});
