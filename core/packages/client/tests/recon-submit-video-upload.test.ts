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
  it('shows the upload picker only to active members while keeping external URLs for everyone', () => {
    expect(form).toContain('const { isMember } = useMembership()');
    expect(videoRegion).toMatch(/\{isMember && \([\s\S]*?type="file"[\s\S]*?\)\}\s*<textarea/);
    expect(videoRegion).toContain('accept="video/mp4,video/webm,video/quicktime,.mov"');
    expect(videoRegion).toContain('id="recon-video-urls"');
  });

  it('treats administrators as members before the membership request resolves', () => {
    expect(membershipHook).toContain('const admin = isAdminWcaId(wcaId)');
    expect(membershipHook).toContain('isMember: admin || memberAccess');
  });

  it('uploads through the authenticated API then appends the public URL to the existing field', () => {
    expect(form).toContain('await uploadReconVideo(file)');
    expect(form).toContain("urls.push(uploaded.url)");
    expect(form).toContain("urls.join('\\n')");
    expect(api).toContain("new Headers(authHeaders(false))");
    expect(api).toContain("fetch(`${API_BASE}/video`");
    expect(api).toContain("publicApiUrl(`/v1/recon/video/${result.id}`)");
  });

  it('prevents submission while a video is still uploading', () => {
    expect(form).toContain('disabled={saving || videoUploading}');
  });
});
