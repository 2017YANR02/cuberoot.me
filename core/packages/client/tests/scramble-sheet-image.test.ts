import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ render: vi.fn(), raster: vi.fn(), save: vi.fn() }));
vi.mock('@/components/scramble-preview-svg', () => ({ renderScramblePreviewSvg: mocks.render }));
vi.mock('@/lib/puzzle-image/image-export', () => ({ svgToRasterBlob: mocks.raster, saveBlob: mocks.save }));
import { downloadScrambleImages } from '@/lib/scramble-sheet-image';
import { unzipSync } from 'fflate';

describe('classroom scramble image export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.render.mockReturnValue('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>');
    mocks.raster.mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    vi.stubGlobal('document', { fonts: { ready: Promise.resolve() }, createElement: () => ({ getContext: () => ({ font: '', measureText: (text: string) => ({ width: text.length * 12 }) }) }) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('exports the exact existing algorithms and escapes user text in the SVG', async () => {
    const scramble = "R U R' U'";
    await downloadScrambleImages([{ title: '<class & teacher>', event: '333', rows: [{ label: '1', scramble }, { label: '2', scramble: null }] }], 'Missing scramble', vi.fn());
    expect(mocks.render).toHaveBeenCalledExactlyOnceWith({ event: '333', scramble });
    const svg = mocks.raster.mock.calls[0][0] as string;
    expect(svg).toContain('&lt;class &amp; teacher&gt;');
    expect(svg).toContain('Missing scramble');
    expect(svg).toContain('R U R&apos; U&apos;');
    expect(mocks.save.mock.calls[0][1]).toMatch(/\.png$/);
  });

  it('keeps five attempts together and packages the sixth in another image', async () => {
    const progress = vi.fn();
    await downloadScrambleImages([{ title: 'Class', event: '333', rows: Array.from({ length: 6 }, (_, i) => ({ label: String(i + 1), scramble: `R${i}` })) }], 'Missing', progress);
    expect(mocks.raster).toHaveBeenCalledTimes(2);
    expect(mocks.raster.mock.calls[0][0]).toContain('R4');
    expect(mocks.raster.mock.calls[0][0]).not.toContain('R5');
    expect(mocks.raster.mock.calls[1][0]).toContain('R5');
    expect(progress).toHaveBeenLastCalledWith(2, 2);
    const [blob, filename] = mocks.save.mock.calls[0];
    expect(filename).toBe('cuberoot-scrambles.zip');
    expect(Object.keys(unzipSync(new Uint8Array(await (blob as Blob).arrayBuffer())))).toHaveLength(2);
  });
});
