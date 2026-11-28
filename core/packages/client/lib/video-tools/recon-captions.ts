import { findTokenPositions, reconPlaybackTokenPositions } from '../recon-alg-utils';

// Gesture marks always refer to seconds in the original video.
export interface TurnMark { start: number; end?: number; commit?: boolean }
export interface CaptionCue { start: number; end: number; text: string; marks?: (TurnMark | null)[] }
export interface CubePosition { x: number; y: number }
/** The top-left corner is stored as a fraction of the video frame. */
export function captionCubeRect(width: number, height: number, position?: CubePosition, scale = 1) {
  const shortest = Math.min(width, height);
  const edge = Math.max(1, Math.round(shortest * .31 * scale));
  const pad = Math.round(shortest * .018);
  const left = position ? Math.round(position.x * width) : pad;
  const top = position ? Math.round(position.y * height) : pad;
  return { left: Math.max(0, Math.min(width - edge, left)), top: Math.max(0, Math.min(height - edge, top)), edge };
}
export interface CaptionStyle { cubePosition?: CubePosition; cubeScale?: number; font: string; size: number; stroke: number; x: number; y: number; comments: boolean }
export const initialCaptionStyle: CaptionStyle = {
  font: 'CaptionPixter', size: 64, stroke: 6, x: .5, y: .30, comments: false,
};

export function solutionCues(solution: string, start: number): CaptionCue[] {
  const rows = solution.split(/\r?\n/).map(row => row.trim()).filter(Boolean).map(text => {
    const comment = text.split('//').slice(1).join('//');
    const match = comment.match(/\((\d+(?:\.\d+)?)(?:\s*\+\s*(\d+(?:\.\d+)?))?\)\s*$/);
    return { text, inspection: /^\s*(?:insp(?:ection)?|观察)\s*$/i.test(comment),
      seconds: match ? Number(match[1]) + Number(match[2] ?? 0) : undefined };
  });
  let cursor = start;
  return rows.filter(row => !row.inspection).map(row => {
    const from = cursor;
    cursor = Math.round((cursor + (row.seconds ?? NaN)) * 1000) / 1000;
    return { text: row.text, start: from, end: cursor };
  });
}

export async function readCaptionSegments(file: File, texts: string[], duration: number): Promise<CaptionCue[]> {
  const content = (await file.text()).replace(/^\uFEFF/, '');
  let segments: { start?: unknown; end?: unknown }[];
  if (/\.csv$/i.test(file.name)) {
    const { parse } = await import('csv-parse/browser/esm/sync');
    const rows: string[][] = parse(content, { skip_empty_lines: true, relax_column_count: true });
    if (rows[0]?.[0]?.trim().toLowerCase() === 'start') rows.shift();
    segments = rows.map(([start, end]) => ({ start, end }));
  } else {
    const { default: JSON5 } = await import('json5');
    segments = JSON5.parse(content).cutSegments;
  }
  if (!Array.isArray(segments) || segments.length !== texts.length) throw Error('count');
  const seconds = (value: unknown, fallback: number) => {
    if (value == null || value === '') return fallback;
    if (!/^\d+(?::\d+){0,2}(?:\.\d+)?$/.test(String(value))) throw Error('time');
    return String(value).split(':').reduce((n, part) => n * 60 + Number(part), 0);
  };
  const starts = segments.map(s => seconds(s.start, 0));
  return segments.map((s, i) => ({ start: starts[i], end: seconds(s.end, starts[i + 1] ?? duration), text: texts[i] }));
}

export function pasteBoundaries(input: string, cues: CaptionCue[], duration: number) {
  const times = input.trim().split(/[\s,，;；]+/).map(value => {
    if (!/^\d+(?::[0-5]?\d){0,2}(?:\.\d+)?$/.test(value)) throw Error('time');
    return value.split(':').reduce((sum, part) => sum * 60 + Number(part), 0);
  });
  if (times.length !== cues.length + 1 || times.some((n, i) => n > duration + .001 || (i > 0 && n <= times[i - 1]))) throw Error('bounds');
  return cues.map((cue, i) => ({ ...cue, start: times[i], end: times[i + 1] }));
}

export function captionTurns(cue: CaptionCue) {
  const expanded = /\)\d/.test(cue.text.split('//')[0]) ? reconPlaybackTokenPositions(cue.text) : [];
  const tokens = expanded.length ? expanded : findTokenPositions(cue.text);
  return tokens.map((token, i) => {
    const mark = cue.marks?.[i], next = cue.marks?.[i + 1];
    return { ...token, from: mark?.start ?? NaN, to: mark ? Math.min(cue.end, mark.end ?? next?.start ?? (i === tokens.length - 1 ? cue.end : mark.start + .001)) : NaN,
      commit: !!mark?.commit };
  });
}

export function prepareCaptions(cues: CaptionCue[]) {
  return cues.map(cue => ({ ...cue, turns: captionTurns(cue), positions: findTokenPositions(cue.text) }));
}
export type PreparedCaptions = ReturnType<typeof prepareCaptions>;

export function paintCaption(ctx: CanvasRenderingContext2D, cues: PreparedCaptions, time: number, width: number, height: number, style: CaptionStyle) {
  const cue = cues.find(c => c.start <= time && time < c.end);
  if (!cue) return;
  const text = style.comments ? cue.text : cue.text.split('//')[0].trimEnd();
  if (!text) return;
  const active = new Set(cue.turns.filter(turn => turn.from <= time && time < turn.to).map(turn => turn.start));
  const scale = height / 1080;
  const size = style.size * scale;
  const stroke = style.stroke * scale;
  ctx.save();
  ctx.font = '700 ' + size + 'px ' + style.font + ', sans-serif';
  ctx.lineJoin = 'round'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  type Piece = { text: string; active: boolean; width: number };
  const lines: { pieces: Piece[]; width: number }[] = [{ pieces: [], width: 0 }];
  const gap = ctx.measureText(' ').width;
  for (const word of text.matchAll(/\S+/g)) {
    const pieces: Piece[] = [];
    const add = (s: string, on: boolean) => { if (s) pieces.push({ text: s, active: on, width: ctx.measureText(s).width }); };
    let cursor = word.index;
    const end = cursor + word[0].length;
    for (const token of cue.positions) {
      if (token.start < cursor || token.start >= end) continue;
      add(text.slice(cursor, token.start), false);
      cursor = token.end;
      while (cursor < end && /[↑↓←→]/.test(text[cursor])) cursor++;
      add(text.slice(token.start, cursor), active.has(token.start));
    }
    add(text.slice(cursor, end), false);
    const wordWidth = pieces.reduce((sum, piece) => sum + piece.width, 0);
    let line = lines[lines.length - 1];
    if (line.width && line.width + gap + wordWidth > width * .94) {
      line = { pieces: [], width: 0 }; lines.push(line);
    }
    if (line.width) { line.pieces.push({ text: ' ', active: false, width: gap }); line.width += gap; }
    line.pieces.push(...pieces); line.width += wordWidth;
  }
  const lineHeight = size * 1.35 + stroke;
  const fit = Math.min(1, width * .95 / Math.max(1, ...lines.map(l => l.width)), height * .95 / (lines.length * lineHeight));
  ctx.scale(fit, fit);
  const w = width / fit, h = height / fit;
  const blockWidth = Math.max(...lines.map(l => l.width)), blockHeight = lines.length * lineHeight;
  const center = (pos: number, space: number, block: number) => Math.max(block / 2 + stroke, Math.min(space - block / 2 - stroke, pos * space));
  const cx = center(style.x, w, blockWidth), cy = center(style.y, h, blockHeight);
  for (const [i, line] of lines.entries()) {
    let x = cx - line.width / 2;
    const y = cy + (i + .5 - lines.length / 2) * lineHeight;
    for (const piece of line.pieces) {
      if (stroke > 0 && piece.text !== ' ') {
        ctx.strokeStyle = 'black'; ctx.lineWidth = stroke * (piece.active ? 2.7 : 2);
        ctx.strokeText(piece.text, x, y);
        if (piece.active) { ctx.strokeStyle = 'white'; ctx.lineWidth = stroke * 1.55; ctx.strokeText(piece.text, x, y); }
      }
      ctx.fillStyle = piece.active ? 'black' : 'white';
      ctx.fillText(piece.text, x, y);
      x += piece.width;
    }
  }
  ctx.restore();
  const outline = stroke * 1.35;
  return {
    x: cx * fit, y: cy * fit,
    width: (blockWidth + 2 * outline) * fit, height: (blockHeight + 2 * outline) * fit,
  };
}

function assTime(cs: number) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return Math.floor(cs / 360000) + ':' + pad(Math.floor(cs / 6000) % 60) + ':' + pad(Math.floor(cs / 100) % 60) + '.' + pad(cs % 100);
}

/** ASS uses centiseconds and refers to fonts by their installed family name. */
export function captionAss(cues: PreparedCaptions, style: CaptionStyle, font: string, width: number, height: number) {
  const scale = height / 1080;
  const outline = (style.stroke * scale).toFixed(2);
  const safeFont = font.replace(/[,\r\n]/g, ' ').trim() || 'Arial';
  // Pixter's named bold face is registered as Regular in its own font family.
  const bold = style.font === 'CaptionPixter' ? 0 : -1;
  const lines = [
    '[Script Info]', 'ScriptType: v4.00+', 'ScaledBorderAndShadow: yes', 'WrapStyle: 0',
    'PlayResX: ' + width, 'PlayResY: ' + height, '', '[V4+ Styles]',
    'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
    `Style: Turns,${safeFont},${(style.size * scale).toFixed(2)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,${bold},0,0,0,100,100,0,0,1,${outline},0,5,0,0,0,1`,
    '', '[Events]', 'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text',
  ];
  const escape = (text: string) => text.replaceAll('\\', '＼').replaceAll('{', '｛').replaceAll('}', '｝');
  const pos = '{\\an5\\pos(' + Math.round(style.x * width) + ',' + Math.round(style.y * height) + ')}';
  for (const cue of cues) {
    const text = style.comments ? cue.text : cue.text.split('//')[0].trimEnd();
    if (!text) continue;
    const cuts = [...new Set([cue.start, cue.end, ...cue.turns.flatMap(turn => [turn.from, turn.to])].filter(Number.isFinite).map(s => Math.round(s * 100)))].sort((a, b) => a - b);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const active = new Set(cue.turns.filter(m => Math.round(m.from * 100) <= cuts[i] && cuts[i] < Math.round(m.to * 100)).map(m => m.start));
      let cursor = 0, body = '';
      for (const token of cue.positions.filter(m => active.has(m.start))) {
        body += escape(text.slice(cursor, token.start));
        cursor = token.end;
        while (cursor < text.length && /[↑↓←→]/.test(text[cursor])) cursor++;
        body += '{\\1c&H000000&\\3c&HFFFFFF&\\bord' + (style.stroke * scale * .775).toFixed(2) + '}' + escape(text.slice(token.start, cursor)) + '{\\rTurns}';
      }
      const event = ',' + assTime(cuts[i]) + ',' + assTime(cuts[i + 1]) + ',Turns,,0,0,0,,';
      if (active.size) lines.push('Dialogue: 0' + event + pos + '{\\bord' + (style.stroke * scale * 1.35).toFixed(2) + '}' + escape(text));
      lines.push('Dialogue: 1' + event + pos + body + escape(text.slice(cursor)));
    }
  }
  return lines.join('\n') + '\n';
}
