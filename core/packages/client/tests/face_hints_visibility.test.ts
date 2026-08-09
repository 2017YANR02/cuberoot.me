import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hintFacesCamera } from '@/app/[lang]/sim/engine/face_hints';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIM_PAGE = readFileSync(join(CLIENT, 'app', '[lang]', 'sim', 'SimPage.tsx'), 'utf8');

describe('FaceHints camera-facing visibility', () => {
  const camera = new Vector3(0, 0, 10);

  it('shows a label whose outward normal faces the camera', () => {
    expect(hintFacesCamera(
      new Vector3(0, 0, 1),
      new Vector3(0, 0, 0),
      camera,
    )).toBe(true);
  });

  it('keeps a shallow visible face even when its floating label sits beyond the face', () => {
    // 这个面只有少量 z 分量,但仍然朝向相机。旧实现从悬浮字母位置算视线,
    // 字母比魔方面更靠外时会把它误判成背面。
    const shallowFacing = new Vector3(0, Math.sqrt(0.96), 0.2);
    expect(hintFacesCamera(shallowFacing, new Vector3(0, 0, 0), camera)).toBe(true);
  });

  it('hides back-facing and exactly edge-on labels as whole glyphs', () => {
    expect(hintFacesCamera(
      new Vector3(0, 0, -1),
      new Vector3(0, 0, 0),
      camera,
    )).toBe(false);
    expect(hintFacesCamera(
      new Vector3(1, 0, 0),
      new Vector3(0, 0, 0),
      camera,
    )).toBe(false);
  });

  it('uses the same camera-aware overlay for /sim main and back views', () => {
    expect(SIM_PAGE).toContain('activeHints.setCameraOverlay(true)');
    expect(SIM_PAGE).toContain("h.tick(dt, h === activeHints ? world.camera : undefined)");
    expect(SIM_PAGE).toContain('activeHints.prepareForCamera(camera)');
    expect(SIM_PAGE).toContain('activeHints.prepareForCamera(w.camera)');
  });
});
