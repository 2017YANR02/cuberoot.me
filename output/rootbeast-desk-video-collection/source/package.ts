import { access, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Run only after source/render.ts has finished. This packages existing renders;
// it never changes the product sources or regenerates the individual videos.
type Scene = { id: string; title: string };
type Probe = {
  streams: Array<{
    codec_type?: string; codec_name?: string; width?: number; height?: number;
    pix_fmt?: string; r_frame_rate?: string; avg_frame_rate?: string; nb_frames?: string;
  }>;
  format: { duration?: string; size?: string; format_name?: string };
};

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, '..');
const repo = resolve(here, '../../..');
const clientRequire = createRequire(join(repo, 'core/packages/client/package.json'));
const { chromium } = clientRequire('@playwright/test');
const sharp = clientRequire('sharp');
const { zipSync, unzipSync } = clientRequire('fflate');
const run = promisify(execFile);
const finishOnly = process.argv.includes('--finish');

async function command(file: string, args: string[]) {
  return run(file, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
}

async function probe(file: string): Promise<Probe> {
  const result = await command('ffprobe', [
    '-v', 'error', '-show_entries',
    'format=duration,size,format_name:stream=index,codec_type,codec_name,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_frames',
    '-of', 'json', file,
  ]);
  return JSON.parse(result.stdout);
}

async function sha256(file: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function frameRate(value?: string) {
  const [numerator, denominator = '1'] = (value ?? '').split('/');
  return Number(numerator) / Number(denominator);
}

function assertVideo(p: Probe, label: string, width: number, height: number, seconds: number, frames: number) {
  const video = p.streams.filter(stream => stream.codec_type === 'video');
  if (video.length !== 1 || p.streams.some(stream => stream.codec_type === 'audio')) {
    throw new Error(`${label}: expected one video stream and no audio.`);
  }
  const stream = video[0];
  if (stream.codec_name !== 'h264' || stream.width !== width || stream.height !== height
    || Math.abs(frameRate(stream.r_frame_rate) - 30) > .001
    || Number(stream.nb_frames) !== frames
    || Math.abs(Number(p.format.duration) - seconds) > .002) {
    throw new Error(`${label}: unexpected video format: ${JSON.stringify(p)}`);
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

const scenes: Scene[] = JSON.parse(await readFile(join(here, 'scenes.json'), 'utf8'));
if (!Array.isArray(scenes) || scenes.length !== 10) throw new Error('Exactly 10 scenes are required.');
for (const [index, scene] of scenes.entries()) {
  const prefix = String(index + 1).padStart(2, '0');
  if (!new RegExp(`^${prefix}-[a-z0-9-]+$`).test(scene.id) || !scene.title || /[/\\\0]/.test(scene.title)) {
    throw new Error(`Invalid scene order or file name: ${JSON.stringify(scene)}`);
  }
}

// Finish the entire QA gate before creating any delivery artifact.
const qa = [];
for (const scene of scenes) {
  const record = JSON.parse(await readFile(join(here, 'qa', `${scene.id}.json`), 'utf8'));
  if (record.complete !== true || record.id !== scene.id || record.title !== scene.title) {
    throw new Error(`${scene.id}: QA is not complete. Wait for the render to finish.`);
  }
  qa.push(record);
}
console.log('All 10 scene QA records are complete.');

const items = [];
for (const [index, scene] of scenes.entries()) {
  const name = `${scene.id.slice(0, 2)}-${scene.title}`;
  const file = `videos/${name}.mp4`;
  const absolute = join(output, file);
  const cover = `covers/${name}.png`;
  const preview = `previews/${name}.gif`;
  await access(join(output, cover));
  await access(join(output, preview));
  const info = await stat(absolute);
  if (!info.isFile() || info.size === 0) throw new Error(`${file}: missing or empty video.`);
  const ffprobe = await probe(absolute);
  assertVideo(ffprobe, file, 1920, 1080, 12, 360);
  items.push({
    id: scene.id, title: scene.title, name, file, absolute, cover, preview,
    size: info.size, mtimeMs: info.mtimeMs, sha256: await sha256(absolute), ffprobe,
    sourceQa: `source/qa/${scene.id}.json`, sourceRenderHash: qa[index].hash,
  });
}

// Downsample exact 4× pixel frames with nearest-neighbor before placing them in
// Chromium, so the contact sheet stays crisp and Chinese uses a real system font.
const cache = await mkdtemp('/tmp/rootbeast-collection-package-');
const tiles = [];
for (const item of items) {
  const image = await sharp(join(output, item.cover)).resize(480, 270, { kernel: 'nearest' }).png().toBuffer();
  tiles.push(`<article><img src="data:image/png;base64,${image.toString('base64')}" alt=""><div class="caption"><span>${item.id.slice(0, 2)}</span><h2>${escapeHtml(item.title)}</h2></div></article>`);
}
const contactHtml = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>根号兽 · 像素日常</title>
<style>
*{box-sizing:border-box}html,body{margin:0;background:#171519;color:#f6eee8;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}
#sheet{width:2528px;padding:32px}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;min-height:58px}
h1{font-size:32px;line-height:42px;margin:0;font-weight:700;letter-spacing:-1px}h1 b{color:#f5b27c;font-weight:inherit}header p{margin:0;font-size:17px;color:#b6a7ae}
.grid{display:grid;grid-template-columns:repeat(5,480px);gap:18px 16px}article{overflow:hidden;border-radius:10px;background:#211d23}
img{display:block;width:480px;height:270px;image-rendering:pixelated}.caption{height:48px;display:flex;align-items:center;gap:12px;padding:0 16px}
.caption span{font-size:13px;color:#a18c98;font-variant-numeric:tabular-nums}.caption h2{font-size:18px;font-weight:600;line-height:26px;margin:0}
</style><body><main id="sheet"><header><h1>根号兽 <b>·</b> 像素日常</h1><p>10 支短片 · 每支 12 秒 · 1080p · 无声循环</p></header><section class="grid">${tiles.join('')}</section></main></body></html>`;
const htmlPath = join(cache, 'contact-sheet.html');
await writeFile(htmlPath, contactHtml);
const contactFile = join(output, '总览.png');
const contactTemporary = join(output, '.总览.tmp.png');
if (!finishOnly) {
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 2528, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(htmlPath).href);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
  });
  await page.locator('#sheet').screenshot({ path: contactTemporary });
} finally {
  await browser.close();
}
await rename(contactTemporary, contactFile);
console.log('Created 总览.png (5 columns × 2 rows).');
}

// One FFmpeg process. Each of the 10 decoders gets one thread, the filter graph
// gets one thread, and only the output encoder gets two threads.
const overviewFile = join(output, '30秒总览.mp4');
const overviewTemporary = join(output, '.30秒总览.tmp.mp4');
const ffmpegArgs = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-filter_complex_threads', '1'];
for (const item of items) ffmpegArgs.push('-threads', '1', '-t', '3', '-i', item.absolute);
const chains = items.map((_, index) =>
  `[${index}:v:0]trim=start=0:duration=3,setpts=PTS-STARTPTS,fps=30,scale=960:540:flags=neighbor,setsar=1,format=yuv420p,settb=AVTB[v${index}]`);
chains.push(`${items.map((_, index) => `[v${index}]`).join('')}concat=n=10:v=1:a=0[out]`);
ffmpegArgs.push(
  '-filter_complex', chains.join(';'), '-map', '[out]', '-an',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-threads', '2',
  '-pix_fmt', 'yuv420p', '-r', '30', '-fps_mode', 'cfr', '-frames:v', '900',
  '-movflags', '+faststart', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  '-metadata', 'title=根号兽 · 十个像素日常', overviewTemporary,
);
if (!finishOnly) {
  await command('ffmpeg', ffmpegArgs);
  const generatedProbe = await probe(overviewTemporary);
  assertVideo(generatedProbe, '30秒总览.mp4', 960, 540, 30, 900);
  await rename(overviewTemporary, overviewFile);
}
const overviewProbe = await probe(overviewFile);
assertVideo(overviewProbe, '30秒总览.mp4', 960, 540, 30, 900);
console.log(`${finishOnly ? 'Kept' : 'Created'} 30秒总览.mp4 (30 seconds, 900 frames).`);

// Detect accidental concurrent re-renders before archiving or recording hashes.
for (const item of items) {
  const now = await stat(item.absolute);
  if (now.size !== item.size || now.mtimeMs !== item.mtimeMs) {
    throw new Error(`${item.file} changed during packaging. Wait for rendering and run again.`);
  }
}

// fflate explicitly marks Unicode paths as UTF-8. The host's Info-ZIP under
// C.UTF-8 wrote unmarked UTF-8 paths, which some unzip programs misdecode.
// Store the already-compressed videos, then verify both names and payloads.
const zipFile = join(output, '根号兽桌宠视频-10支.zip');
const zipInput:Record<string,Uint8Array> = {};
for (const item of items) zipInput[`${item.name}.mp4`] = await readFile(item.absolute);
const zipTemporary = join(output, '.videos.tmp.zip');
await writeFile(zipTemporary, zipSync(zipInput, { level: 0 }));
const extracted:Record<string,Uint8Array> = unzipSync(await readFile(zipTemporary));
const zipEntries = Object.keys(extracted).sort();
const expectedEntries = items.map(item => `${item.name}.mp4`).sort();
if (JSON.stringify(zipEntries) !== JSON.stringify(expectedEntries)) {
  throw new Error(`Unexpected ZIP entries: ${JSON.stringify(zipEntries)}`);
}
for (const item of items) {
  const actual = createHash('sha256').update(extracted[`${item.name}.mp4`]).digest('hex');
  if (actual !== item.sha256) throw new Error(`ZIP payload mismatch: ${item.name}`);
}
await rename(zipTemporary, zipFile);
console.log('Created 根号兽桌宠视频-10支.zip (10 MP4 files only).');

const imageInfo = await sharp(contactFile).metadata();
const delivery = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  sceneCount: items.length,
  qaComplete: true,
  videos: items.map(({ absolute, mtimeMs, name, ...item }) => item),
  contactSheet: {
    file: '总览.png', size: (await stat(contactFile)).size, sha256: await sha256(contactFile),
    width: imageInfo.width, height: imageInfo.height, columns: 5, rows: 2,
  },
  overview: {
    file: '30秒总览.mp4', size: (await stat(overviewFile)).size, sha256: await sha256(overviewFile),
    durationSeconds: Number(overviewProbe.format.duration), ffprobe: overviewProbe,
  },
  archive: {
    file: '根号兽桌宠视频-10支.zip', size: (await stat(zipFile)).size, sha256: await sha256(zipFile),
    entries: zipEntries,
  },
  previewPage: 'index.html',
};
const deliveryTemporary = join(output, '.delivery.tmp.json');
await writeFile(deliveryTemporary, `${JSON.stringify(delivery, null, 2)}\n`);
await rename(deliveryTemporary, join(output, 'delivery.json'));
console.log('Saved delivery.json with sizes, SHA-256 hashes and ffprobe evidence.');
