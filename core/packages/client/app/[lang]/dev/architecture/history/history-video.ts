import { createCanvasVideoEncoder, type ExportProgress } from '@/lib/canvas-video-export';
import { tr } from '@/i18n/tr';
import { HISTORY_PLACES } from './history-days';
import { HISTORY_ENVIRONMENTS, DAYLIGHT_LABELS, WEATHER_LABELS, historyDaylight, journeyWeather } from './history-environment';
import { mountHistoryScene, type HistoryScene } from './history-scene';
import { HISTORY_VIDEO_FPS, historyVideoPlan } from './history-video-plan';

const WIDTH = 1920, HEIGHT = 1080, NOTE_WIDTH = 400;

/** Burn in the same bilingual date notes as the map; no DOM screenshots per frame. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  // Latin words stay together; CJK may wrap between characters.
  for (const word of text.match(/[\x21-\x7e]+\s*|[^\x21-\x7e]/gu) ?? []) {
    if (line && ctx.measureText(line + word).width > maxWidth) { lines.push(line.trim()); line = ''; }
    line += word;
  }
  if (line) lines.push(line.trim());
  return lines;
}

export async function exportHistoryVideo(options: {
  source: HTMLDivElement; start: number; end: number; speed: number; weatherVariation: number;
  abortRef: { aborted: boolean }; preview: HTMLCanvasElement | null;
  onProgress: (progress: ExportProgress) => void;
}): Promise<Blob> {
  const { source, start, end, speed, weatherVariation, abortRef, preview, onProgress } = options;
  const plan = historyVideoPlan(start, end, speed);
  const encoder = await createCanvasVideoEncoder({ width: WIDTH, height: HEIGHT, fps: HISTORY_VIDEO_FPS, bitrate: 12_000_000, abortRef });
  const stage = document.createElement('div'), host = document.createElement('div');
  let scene: HistoryScene | undefined;
  let contextLost = false;
  try {
    const style = getComputedStyle(source);
    // This offscreen scene inherits the artwork palette without touching the live renderer.
    stage.style.cssText = `position:fixed;left:-10000px;top:0;width:${WIDTH}px;height:${HEIGHT}px;pointer-events:none;`;
    stage.setAttribute('aria-hidden', 'true'); stage.dataset.historyCapture = ''; stage.inert = true;
    for (const name of style) if (name.startsWith('--scroll-')) stage.style.setProperty(name, style.getPropertyValue(name));
    host.style.cssText = 'width:100%;height:100%;'; stage.append(host); document.body.append(stage);
    const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    const sans = style.getPropertyValue('--sans').trim() || 'system-ui';
    const serif = style.getPropertyValue('--serif').trim() || 'serif';
    const mono = style.getPropertyValue('--mono').trim() || 'monospace';
    await document.fonts.ready;
    if (abortRef.aborted) throw new Error('aborted');
    const notes = HISTORY_PLACES.map(place => {
      const note = tr<{ title: string; detail: string }>(place.note);
      ctx.font = `500 26px ${sans}`;
      const title = wrapText(ctx, note.title, NOTE_WIDTH);
      ctx.font = `20px ${sans}`;
      return { title, detail: wrapText(ctx, note.detail, NOTE_WIDTH) };
    });
    const labelHeight = Math.max(...notes.map(note => 58 + note.title.length * 36 + note.detail.length * 29));
    scene = mountHistoryScene(host, [], start, () => {}, () => {}, () => { contextLost = true; }, [], { labelHeight });
    scene.setWeather(weatherVariation);
    await scene.ready();
    if (abortRef.aborted) throw new Error('aborted');
    let previewCtx: CanvasRenderingContext2D | null = null;
    if (preview) { preview.width = 960; preview.height = 540; previewCtx = preview.getContext('2d'); }
    const paper = style.getPropertyValue('--scroll-paper').trim();
    const ink = style.getPropertyValue('--scroll-ink').trim();
    const accent = style.getPropertyValue('--scroll-vermilion').trim();
    let lastProgress = 0;
    for (let frame = 0; frame < plan.totalFrames; frame++) {
      if (abortRef.aborted) throw new Error('aborted');
      if (contextLost) throw new Error('WebGL context lost');
      const position = plan.positionAt(frame), current = Math.round(position), place = HISTORY_PLACES[current];
      const view = scene.captureFrame(position, frame / HISTORY_VIDEO_FPS);
      // Copy synchronously, before WebGL's drawing buffer can be cleared by the browser.
      ctx.drawImage(view.canvas, 0, 0, WIDTH, HEIGHT);
      ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillStyle = view.ink;
      ctx.font = `18px ${mono}`; ctx.fillText(`${String(current + 1).padStart(2, '0')} / ${HISTORY_PLACES.length}`, 64, 52);
      ctx.font = `40px ${serif}`; ctx.fillText(tr(place), 64, 93);
      ctx.font = `20px ${sans}`;
      const subtitle = [tr(HISTORY_ENVIRONMENTS[current]), tr(DAYLIGHT_LABELS[historyDaylight(position).phase]), tr(WEATHER_LABELS[journeyWeather(current, weatherVariation)])].join('  ');
      ctx.fillText(subtitle, 64, 154);
      ctx.textAlign = 'right'; ctx.font = `17px ${mono}`; ctx.fillText('CUBEROOT / cuberoot.me', WIDTH - 64, 56);
      for (const point of view.points) {
        if (point.x < NOTE_WIDTH / 2 + 24 || point.x > WIDTH - NOTE_WIDTH / 2 - 24) continue;
        const selected = point.index === current;
        ctx.beginPath(); ctx.arc(point.x, point.y, selected ? 15 : 11, 0, Math.PI * 2);
        ctx.fillStyle = paper; ctx.fill(); ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
        if (selected) { ctx.beginPath(); ctx.arc(point.x, point.y, 9, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill(); }
        ctx.fillStyle = paper; ctx.globalAlpha = .88; ctx.fillRect(point.x - 86, point.y + 28, 172, 30); ctx.globalAlpha = 1;
        ctx.textAlign = 'center'; ctx.fillStyle = selected ? accent : ink; ctx.font = `18px ${mono}`;
        ctx.fillText(HISTORY_PLACES[point.index].date, point.x, point.y + 33);
        ctx.fillStyle = view.ink; ctx.font = `500 26px ${sans}`;
        let y = point.y + 74;
        for (const line of notes[point.index].title) { ctx.fillText(line, point.x, y); y += 36; }
        ctx.font = `20px ${sans}`; y += 5;
        for (const line of notes[point.index].detail) { ctx.fillText(line, point.x, y); y += 29; }
      }
      // Shared WCA/sim encoder owns timestamps, queue pressure, cancellation and muxing.
      await encoder.encode(canvas, frame);
      if (performance.now() - lastProgress >= 200 || frame === plan.totalFrames - 1) {
        lastProgress = performance.now();
        previewCtx?.drawImage(canvas, 0, 0, 960, 540);
        const pct = (frame + 1) / plan.totalFrames;
        onProgress({ pct, framesDone: frame + 1, framesTotal: plan.totalFrames,
          phase: tr({ zh: `正在生成 ${Math.round(pct * 100)}%`, en: `Rendering ${Math.round(pct * 100)}%` }) });
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    }
    onProgress({ pct: 1, framesDone: plan.totalFrames, framesTotal: plan.totalFrames, phase: tr({ zh: '正在封装 MP4…', en: 'Finalizing MP4…' }) });
    return await encoder.finish();
  } finally {
    encoder.close(); scene?.dispose(); stage.remove();
  }
}
