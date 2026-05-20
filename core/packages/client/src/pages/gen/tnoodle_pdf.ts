/**
 * tnoodle-style scramble sheet PDF generator.
 *
 * Layout / fonts / colors / paddings copied verbatim from tnoodle's
 * `GeneralScrambleSheet.kt` + `IText7Engine.kt` (commit-pinned via the local
 * `D:\cube\tnoodle` clone), so the output matches a real tnoodle PDF as
 * closely as possible. Watermark is intentionally omitted (user request).
 *
 * Rendering stack:
 *   - jsPDF for page primitives + text (fonts vendored from tnoodle/resources)
 *   - svg2pdf.js for vector SVG embedding (cube preview nets)
 *   - cubing.js TwistyPlayer 2D for the SVG nets themselves
 *
 * Reference (tnoodle GeneralScrambleSheet.kt companion):
 *   MAX_SCRAMBLES_PER_PAGE = 7      MIN_LINES_HIGHLIGHTING = 4
 *   SCRAMBLE_TEXT_LEADING = 0.95    EXTRA_SCRAMBLE_LABEL_SIZE = 12
 *   DEFAULT_CELL_PADDING = 4        MAX_SCRAMBLE_IMAGE_RATIO = 3
 *   MAX_INDEX_COLUMN_RATIO = 25     SCRAMBLE_BACKGROUND_COLOR = (192,192,192)
 *   SCRAMBLE_HIGHLIGHTING_COLOR = (230,230,230)
 *   margins: 35 horizontal, 75 vertical (Drawing.Margin)
 *   fonts: LiberationMono-Regular, NotoSans-Regular (tnoodle/resources/fonts)
 */
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import { renderUnfoldedSvgForEvent, eventToCubeSize } from './cube_unfolded_svg';
import { getScramble2DSvg } from './cubing_2d_svg';
import { renderClockScrambleSvg, DEFAULT_CLOCK_COLORS } from './clock_svg';
import { renderSq1ScrambleSvg, DEFAULT_SQ1_COLORS } from './sq1_svg';
import { renderMirrorBlocksScrambleSvg } from './mirror_blocks_svg';
import { renderMegaScrambleSvg, DEFAULT_MEGA_COLORS } from './mega_svg';
import { renderPyraScrambleSvg, PYRA_DEFAULT_COLORS } from './pyraminx_svg';
import { renderSkewbScrambleSvg, SKEWB_DEFAULT_COLORS } from './skewb_svg';
import type { WcaFormat } from './wca_round';
import { eventDisplayName } from '../../utils/wca_events';
import { tFmc, fontForLocale, type TnoodleLocale } from './tnoodle_translate';

// ─── Tnoodle constants (verbatim) ─────────────────────────────────────────
const MAX_SCRAMBLES_PER_PAGE = 7;
const MIN_LINES_HIGHLIGHTING = 4;
const SCRAMBLE_TEXT_LEADING = 0.95;
const EXTRA_SCRAMBLE_LABEL_SIZE = 12;
const DEFAULT_CELL_PADDING = 4;          // 2 * Drawing.Padding.DEFAULT (=2)
const MAX_SCRAMBLE_IMAGE_RATIO = 3;
const MAX_INDEX_COLUMN_RATIO = 25;
const SCRAMBLE_BG_RGB: [number, number, number] = [192, 192, 192];
const SCRAMBLE_HL_RGB: [number, number, number] = [230, 230, 230];
const PAGE_MARGIN_H = 35;
const PAGE_MARGIN_V = 75;
const A4_WIDTH = 595.28;   // pt
const A4_HEIGHT = 841.89;  // pt
const FONT_MONO = 'LiberationMono';
const FONT_SANS = 'NotoSans';
const FONT_CJK = 'wqy-microhei';
// FMC sheet (FmcSolutionSheet.kt companion)
const FMC_MARGIN = 35;                       // all 4 sides for FMC page
const FMC_RIGHT_PCT = 0.45;                  // SCRAMBLE_IMAGE_WIDTH_PERCENT
const FMC_RATIO_LARGE = 8;                   // UPPER_RIGHT_INFO_BOX_RATIO_LARGE
const FMC_RATIO_MEDIUM = 10;                 // UPPER_RIGHT_INFO_BOX_RATIO_MEDIUM
const FMC_RATIO_SMALL = 12;                  // UPPER_RIGHT_INFO_BOX_RATIO_SMALL
const FMC_RULES_RATIO = 3;                   // UPPER_LEFT_RULES_RATIO
const FMC_TITLE_RATIO = 10;                  // UPPER_LEFT_TITLE_RATIO
const FMC_MOVE_BARS_PER_LINE = 10;           // FewestMovesSheet.MOVE_BARS_PER_LINE
const FMC_MOVE_BAR_LINES = 8;                // FewestMovesSheet.MOVE_BAR_LINES
const FMC_MAX_MOVES = FMC_MOVE_BARS_PER_LINE * FMC_MOVE_BAR_LINES; // 80
const FMC_SHORT_FILL = ': ____';
const FMC_LONG_FILL = ': __________________';
const FMC_WCA_ID_FILL = ': __ __ __ __  __ __ __ __  __ __';
const FMC_FACE_MOVES = ['R', 'U', 'F', 'L', 'D', 'B'];
const FMC_ROTATIONS = ['x', 'y', 'z'];
const FMC_DIRECTION_MODIFIERS = ['', "'", '2'];

// ScrambleStringUtil constants
const MIN_ONE_LINE_FONT_SIZE = 15;
const MAX_PHRASE_FONT_SIZE = 20;
const MOVES_DELIMITER = ' ';
const NBSP = ' ';

// ─── Public types ─────────────────────────────────────────────────────────
export interface AttemptInput {
  /** Display label, e.g. "1", "E1". For MBLD this is the cube number. */
  label: string;
  /** Single scramble move sequence; one row in the PDF. */
  scramble: string;
  isExtra: boolean;
}

export interface RoundSheetInput {
  event: string;
  roundIdx: number;
  groupIdx: number;
  format: WcaFormat;
  /** MBLD/FMC — 0-based attempt index. Adds " Attempt N+1" / "Scramble X of Y" to the title. */
  attemptNumber?: number;
  attempts: AttemptInput[];
  /** FMC only — list of locales for which to emit a translated solution sheet. */
  locales?: TnoodleLocale[];
  /** Print copies — render the same scrambles N times in the PDF (defaults to 1). */
  copies?: number;
  /** scrambleSets count for this round; "Scramble Set A/B/..." renders only when >1. */
  totalGroups?: number;
}

export interface PdfOptions {
  competitionTitle: string;
  /** Generator footer string, e.g. "TNoodle-WCA-1.2.3-port". */
  generatorTag: string;
  isZh: boolean;
  /** Optional cancellation hook for very long runs. */
  signal?: AbortSignal;
  /** Called per page after rendering completes. (done, total) where total = page count. */
  onProgress?: (done: number, total: number) => void;
  /** tnoodle-style per-event color override. Currently only `clock` is honored. */
  eventColors?: Record<string, Record<string, string>>;
  /** Whether to render the per-attempt scramble preview image column.
   *  Off ⇒ table collapses to label + scramble text (no image col, no SVG
   *  embedding). FMC pages are unaffected — the FMC sheet structure has
   *  its own cube-preview cell that's part of the WCA solution sheet
   *  layout. Defaults to true. */
  showPreview?: boolean;
}

// ─── Font loading (cached) ────────────────────────────────────────────────
let monoB64: Promise<string> | null = null;
let sansB64: Promise<string> | null = null;
let cjkB64: Promise<string> | null = null;
const cjkLoadedDocs = new WeakSet<jsPDF>();

async function fetchFontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed: ${url}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Chunked btoa to avoid call-stack issues on large fonts
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function loadFonts(doc: jsPDF): Promise<void> {
  monoB64 ??= fetchFontBase64('/fonts/LiberationMono-Regular.ttf');
  sansB64 ??= fetchFontBase64('/fonts/NotoSans-Regular.ttf');
  const [mono, sans] = await Promise.all([monoB64, sansB64]);
  doc.addFileToVFS('LiberationMono-Regular.ttf', mono);
  doc.addFont('LiberationMono-Regular.ttf', FONT_MONO, 'normal');
  doc.addFileToVFS('NotoSans-Regular.ttf', sans);
  doc.addFont('NotoSans-Regular.ttf', FONT_SANS, 'normal');
  doc.addFont('NotoSans-Regular.ttf', FONT_SANS, 'bold');  // bold simulated by jsPDF
}

/** Lazy-load wqy-microhei into a doc; cheap noop if already loaded. */
async function ensureCjkFont(doc: jsPDF): Promise<void> {
  if (cjkLoadedDocs.has(doc)) return;
  cjkB64 ??= fetchFontBase64('/fonts/wqy-microhei.ttf');
  const cjk = await cjkB64;
  doc.addFileToVFS('wqy-microhei.ttf', cjk);
  doc.addFont('wqy-microhei.ttf', FONT_CJK, 'normal');
  doc.addFont('wqy-microhei.ttf', FONT_CJK, 'bold');
  cjkLoadedDocs.add(doc);
}

function fontForLocaleName(locale: TnoodleLocale): string {
  return fontForLocale(locale) === 'wqy-microhei' ? FONT_CJK : FONT_SANS;
}

// ─── Tnoodle ScrambleStringUtil port ──────────────────────────────────────
/** [token, breakAfter?] — sq1 breaks on /, mega breaks on U-prefix tokens, others break anywhere. */
function splitToTokens(scramble: string): Array<[string, boolean]> {
  const isSquareOne = scramble.includes('/');
  const isMegaminx = scramble.includes('\n');
  const flat = scramble.replace(/\n/g, ' ');
  const tokens = flat.split(/\s+/).filter(Boolean);
  const maxLen = Math.max(...tokens.map((t) => t.length));
  return tokens.map((t) => {
    const padded = t === '/' ? t : t + NBSP.repeat(Math.max(0, maxLen - t.length));
    let canBreak = true;
    if (isSquareOne) canBreak = t === '/';
    else if (isMegaminx) canBreak = t.startsWith('U');
    return [padded, canBreak] as [string, boolean];
  });
}

/** Group tokens into break-units (the chunks between breakpoints). */
function paddedTokens(scramble: string): string[][] {
  const tokens = splitToTokens(scramble);
  const out: string[][] = [];
  let cur: string[] = [];
  for (const [tok, canBreak] of tokens) {
    cur.push(tok);
    if (canBreak) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

// ─── Text fitting (jsPDF measureText-based; honours tnoodle's font scaling) ─
/**
 * Fit one line into `widthPt` at the given mono fontSize. Returns the actual
 * size used (≤ requested); jsPDF's `getStringUnitWidth` is in 1000ths of em,
 * so width(pt) = unitWidth * fontSize.
 */
function widthAtSize(doc: jsPDF, text: string, fontSize: number): number {
  return doc.getStringUnitWidth(text) * fontSize;
}

interface PhraseLayout {
  lines: string[];
  fontSize: number;
}

function fitOneLine(doc: jsPDF, text: string, boxWidthPt: number, boxHeightPt: number): number {
  // tnoodle's computeOneLineFontSize: target font sized so width fits exactly,
  // bounded by box height (after leading scaling). Approximation: pick the
  // largest size at which width ≤ boxWidth AND size ≤ boxHeight / leadingScale.
  doc.setFont(FONT_MONO, 'normal');
  doc.setFontSize(1);   // unit measurement — use 1pt to read em-width directly
  const unitW = doc.getStringUnitWidth(text);
  if (unitW <= 0) return MAX_PHRASE_FONT_SIZE;
  const widthLimit = boxWidthPt / unitW;
  // For mono/sans the ascender-descender is roughly 1.2x font size — use as a soft height cap
  const heightLimit = boxHeightPt / Math.max(1, SCRAMBLE_TEXT_LEADING);
  return Math.min(widthLimit, heightLimit);
}

function computePhrase(
  doc: jsPDF,
  scramble: string,
  boxWidthPt: number,
  boxHeightPt: number,
  maxFontSize: number = MAX_PHRASE_FONT_SIZE,
): PhraseLayout {
  // Megaminx: tnoodle hard-wraps at every face-cycle boundary (each line ends
  // with U or U'). Skip the one-line / fit-loop path entirely so we don't
  // collapse two cycles onto one line. Detection: cubing.js emits literal '\n'
  // between cycles (only mega does this).
  const isMegaminx = scramble.includes('\n');
  if (isMegaminx) {
    const breakChunks = paddedTokens(scramble);
    const lines = breakChunks.map((c) => c.join(MOVES_DELIMITER));
    const lineHeight = boxHeightPt / Math.max(1, lines.length);
    const widestSize = Math.min(
      ...lines.map((l) => fitOneLine(doc, l, boxWidthPt, lineHeight)),
    );
    return { lines, fontSize: Math.min(widestSize, maxFontSize) };
  }
  // First try one-line at max font (tnoodle "is it readable on one line?")
  const oneLinePadded = NBSP + scramble.replace(/\n/g, ' ') + NBSP;
  const oneLineSize = fitOneLine(doc, oneLinePadded, boxWidthPt, boxHeightPt);
  if (oneLineSize >= MIN_ONE_LINE_FONT_SIZE) {
    return { lines: [oneLinePadded.trim()], fontSize: Math.min(oneLineSize, maxFontSize) };
  }
  // Multi-line: split into break-chunks, try N=2,3,4,... until everything fits
  const breakChunks = paddedTokens(scramble);
  for (let nLines = 2; nLines <= breakChunks.length; nLines++) {
    const lineHeight = boxHeightPt / nLines;
    // approximate font size that makes each line fit in lineHeight
    const fontSize = Math.min(
      lineHeight / Math.max(1, SCRAMBLE_TEXT_LEADING),
      maxFontSize,
    );
    const lines = splitToFixedSizeLines(doc, breakChunks, fontSize, boxWidthPt);
    if (lines.length <= nLines) {
      // success — recompute the smallest required font size across all lines
      const actualSize = Math.min(
        ...lines.map((l) => fitOneLine(doc, l, boxWidthPt, lineHeight)),
      );
      return {
        lines,
        fontSize: Math.min(actualSize, maxFontSize),
      };
    }
  }
  // Fallback: pack at maxFontSize
  const lines = splitToFixedSizeLines(doc, breakChunks, maxFontSize, boxWidthPt);
  return { lines, fontSize: maxFontSize };
}

function splitToFixedSizeLines(
  doc: jsPDF,
  breakChunks: string[][],
  fontSize: number,
  widthPt: number,
): string[] {
  doc.setFont(FONT_MONO, 'normal');
  const lines: string[] = [];
  let cur: string[] = [];
  for (const chunk of breakChunks) {
    const candidate = [...cur, ...chunk];
    const candidateStr = candidate.join(MOVES_DELIMITER);
    if (widthAtSize(doc, candidateStr, fontSize) <= widthPt) {
      cur = candidate;
    } else {
      if (cur.length) lines.push(cur.join(MOVES_DELIMITER));
      cur = [...chunk];
      // chunk by itself too large? still push as a single line
      while (widthAtSize(doc, cur.join(MOVES_DELIMITER), fontSize) > widthPt && cur.length > 1) {
        // shouldn't happen for normal scrambles; just break worst-case
        const half = Math.ceil(cur.length / 2);
        lines.push(cur.slice(0, half).join(MOVES_DELIMITER));
        cur = cur.slice(half);
      }
    }
  }
  if (cur.length) lines.push(cur.join(MOVES_DELIMITER));
  return lines;
}

// ─── Round detail string ─────────────────────────────────────────────────
/** Mirror tnoodle's `activityCode.compileTitleString(locale, true, hasGroupId)`:
 *  `<event> Round N` (+ Attempt M for MBLD, + Scramble Set X if >1 group).
 *  Format is NOT included — tnoodle keeps it implicit. */
function roundDetailString(sheet: RoundSheetInput, isZh: boolean): string {
  void isZh;
  const evName = tnoodleEventTitle(sheet.event) ?? eventDisplayName(sheet.event, false);
  // WCA round_type_id 'f'/'h' → roundIdx=3 = Final regardless of total rounds.
  const round = sheet.roundIdx === 3 ? 'Final' : `Round ${sheet.roundIdx + 1}`;
  const grp = (sheet.totalGroups ?? 1) > 1 ? ` Scramble Set ${String.fromCharCode(65 + sheet.groupIdx)}` : '';
  const att = sheet.attemptNumber !== undefined ? ` Attempt ${sheet.attemptNumber + 1}` : '';
  return `${evName} ${round}${grp}${att}`;
}

/** Mirror tnoodle's wcif EventModel descriptions for the title line. */
function tnoodleEventTitle(event: string): string | null {
  const m: Record<string, string> = {
    '222': '2x2x2', '333': '3x3x3', '444': '4x4x4', '555': '5x5x5',
    '666': '6x6x6', '777': '7x7x7',
    '333bf': '3x3x3 Blindfolded', '444bf': '4x4x4 Blindfolded', '555bf': '5x5x5 Blindfolded',
    '333oh': '3x3x3 One-Handed', '333fm': '3x3x3 Fewest Moves',
    '333ft': '3x3x3 With Feet', '333mbf': '3x3x3 Multiple Blindfolded',
    '333mbo': '3x3x3 Multi-Blind Old Style',
    'pyram': 'Pyraminx', 'minx': 'Megaminx', 'sq1': 'Square-1',
    'skewb': 'Skewb', 'clock': 'Clock',
  };
  return m[event] ?? null;
}

// ─── Non-cube net aspect ratios ─────────────────────────────────────────
// Pulled from tnoodle's per-puzzle PuzzleImageInfo "preferredSize" values
// in tnoodle-lib (rough; only used to compute column proportions). NxN
// cubes always 4:3 — handled by cube_unfolded_svg's own viewBox.
function nonCubeAspect(event: string): number | null {
  if (eventToCubeSize(event)) return 4 / 3;
  switch (event) {
    case 'pyram': return 1.16;   // tnoodle PyraminxPuzzleImageInfo
    case 'minx': return 2.087;   // tnoodle MegaminxPuzzle 304.8/146.1 ≈ 2.087
    case 'sq1': return 0.5;     // sq1_svg native viewBox W:H ≈ 122:244 (portrait)
    case 'skewb': return 4 / 3;
    case 'clock': return 1.0;
    default: return null;
  }
}

// ─── Main entry ──────────────────────────────────────────────────────────
/**
 * Build the PDF and return a Blob ready for download.
 * Sheets are emitted one event-round-group per "round" (grouped onto pages of
 * up to 7 attempts each, matching tnoodle).
 */
export async function generateTnoodlePdf(
  sheets: RoundSheetInput[],
  opts: PdfOptions,
): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  await loadFonts(doc);

  const today = new Date().toISOString().slice(0, 10);
  let pageCounter = 0;

  // Pre-compute pages.
  //   FMC: 1 page per attempt × locale (each is a self-contained solution sheet).
  //   Other: chunk into MAX_SCRAMBLES_PER_PAGE attempt rows per page.
  type Plan =
    | { kind: 'standard'; sheetIdx: number; chunkStart: number; chunkLen: number }
    | { kind: 'fmc'; sheetIdx: number; attemptIdx: number; locale: TnoodleLocale };
  const pagePlan: Plan[] = [];
  sheets.forEach((s, sheetIdx) => {
    const copies = Math.max(1, s.copies ?? 1);
    if (s.event === '333fm') {
      const locales = (s.locales && s.locales.length > 0)
        ? s.locales
        : (['en'] as TnoodleLocale[]);
      for (const locale of locales) {
        for (let ai = 0; ai < s.attempts.length; ai++) {
          for (let c = 0; c < copies; c++) {
            pagePlan.push({ kind: 'fmc', sheetIdx, attemptIdx: ai, locale });
          }
        }
      }
    } else {
      for (let i = 0; i < s.attempts.length; i += MAX_SCRAMBLES_PER_PAGE) {
        const plan = {
          kind: 'standard' as const,
          sheetIdx,
          chunkStart: i,
          chunkLen: Math.min(MAX_SCRAMBLES_PER_PAGE, s.attempts.length - i),
        };
        for (let c = 0; c < copies; c++) {
          pagePlan.push(plan);
        }
      }
    }
  });
  const totalPages = pagePlan.length;

  // Initial 0/N tick so the UI shows "0/N" before the first page.
  opts.onProgress?.(0, totalPages);

  for (let p = 0; p < pagePlan.length; p++) {
    if (opts.signal?.aborted) throw new Error('aborted');
    const plan = pagePlan[p];
    const sheet = sheets[plan.sheetIdx];
    if (pageCounter > 0) doc.addPage();
    pageCounter++;
    if (plan.kind === 'fmc') {
      const totalAttemptsForSheet = sheets
        .filter((s) => s.event === '333fm' && s.roundIdx === sheet.roundIdx && s.groupIdx === sheet.groupIdx)
        .length;
      await renderFmcPage(doc, sheet, sheet.attempts[plan.attemptIdx], plan.locale, {
        compTitle: opts.competitionTitle,
        totalAttemptsInRound: totalAttemptsForSheet,
        eventColors: opts.eventColors,
      });
    } else {
      const chunk = sheet.attempts.slice(plan.chunkStart, plan.chunkStart + plan.chunkLen);
      await renderPage(doc, sheet, chunk, {
        compTitle: opts.competitionTitle,
        roundDetail: roundDetailString(sheet, opts.isZh),
        pageNum: p + 1,
        totalPages,
        todayIso: today,
        generatorTag: opts.generatorTag,
        eventColors: opts.eventColors,
        showPreview: opts.showPreview !== false,
      });
    }
    opts.onProgress?.(p + 1, totalPages);
    // yield to the event loop so React can repaint the bar
    await new Promise((r) => setTimeout(r, 0));
  }

  return doc.output('blob');
}

interface PageHeader {
  compTitle: string;
  roundDetail: string;
  pageNum: number;
  totalPages: number;
  todayIso: string;
  generatorTag: string;
  /** Per-event color overrides (currently only `clock` is honored). */
  eventColors?: Record<string, Record<string, string>>;
  /** When false, the scramble image column is dropped entirely. */
  showPreview: boolean;
}

async function renderPage(
  doc: jsPDF,
  sheet: RoundSheetInput,
  chunk: AttemptInput[],
  hdr: PageHeader,
): Promise<void> {
  // ── header / footer ──────────────────────────────────────────
  // tnoodle uses iText where Y=0 is the BOTTOM of the page; jsPDF uses Y=0
  // at the TOP. The constants below convert tnoodle's positions to jsPDF.
  // tnoodle: headerHeight = 3 * marginTop / 4, all header text positioned
  // pageSize.top − {headerHeight, 2H/3, …} (iText). In jsPDF that flips to
  // {headerHeight, 2H/3} from the top.
  const headerH = (3 * PAGE_MARGIN_V) / 4;
  const footerH = (3 * PAGE_MARGIN_V) / 4;
  doc.setFont(FONT_SANS, 'normal');
  doc.setFontSize(12);
  // top-left: date
  doc.text(hdr.todayIso, 2 * PAGE_MARGIN_H, headerH, { align: 'center', baseline: 'middle' });
  // top-center two lines: compTitle (higher) + roundDetail (below)
  doc.text(hdr.compTitle, A4_WIDTH / 2, (2 * headerH) / 3, { align: 'center', baseline: 'middle' });
  doc.text(hdr.roundDetail, A4_WIDTH / 2, headerH, { align: 'center', baseline: 'middle' });
  // top-right: page n/m (only when more than one page)
  if (hdr.totalPages > 1) {
    doc.text(`${hdr.pageNum}/${hdr.totalPages}`,
      A4_WIDTH - 2 * PAGE_MARGIN_H, headerH, { align: 'center', baseline: 'middle' });
  }
  // bottom-center: generator tag
  doc.text(`Generated by ${hdr.generatorTag}`,
    A4_WIDTH / 2, A4_HEIGHT - footerH, { align: 'center', baseline: 'middle' });

  // ── 3-column table layout ─────────────────────────────────────
  const tableLeft = PAGE_MARGIN_H;
  const tableTop = PAGE_MARGIN_V;
  const tableWidth = A4_WIDTH - 2 * PAGE_MARGIN_H;
  const hasExtras = chunk.some((a) => a.isExtra);
  const heightExtraPenalty = hasExtras ? 2 * EXTRA_SCRAMBLE_LABEL_SIZE : 0;
  const tableHeight = (A4_HEIGHT - 2 * PAGE_MARGIN_V) - heightExtraPenalty;

  // For NxN cubes the unfolded net has a fixed 4:3 aspect (the cubing.js 2D
  // SVG also reports 4:3 via its viewBox). For non-cubes we'd have to spin up
  // a TwistyPlayer just to read the aspect — instead we hard-code the
  // tnoodle "preferredSize" widths-to-heights here:
  const widthToHeight = nonCubeAspect(sheet.event) ?? 4 / 3;

  // tnoodle math
  const relativeHeight = tableHeight / tableWidth;
  const relHeightPerScramble = relativeHeight / chunk.length;
  const fullWidth = relHeightPerScramble * widthToHeight;
  const scrambleImageProportion = 1 / fullWidth;
  const scrambleImageParts = Math.max(MAX_SCRAMBLE_IMAGE_RATIO, scrambleImageProportion);
  const gcd = MAX_INDEX_COLUMN_RATIO * scrambleImageParts;
  const scrambleStringParts = gcd - MAX_INDEX_COLUMN_RATIO - scrambleImageParts;
  const totalParts = scrambleImageParts + scrambleStringParts + MAX_INDEX_COLUMN_RATIO;

  const labelColW = (scrambleImageParts / totalParts) * tableWidth;
  // When previews are hidden we drop the image column entirely and give its
  // width to the scramble text column. Layout stays a clean 2-col rect grid.
  const rawImageColW = (MAX_INDEX_COLUMN_RATIO / totalParts) * tableWidth;
  const imageColW = hdr.showPreview ? rawImageColW : 0;
  const textColW = hdr.showPreview
    ? (scrambleStringParts / totalParts) * tableWidth
    : tableWidth - labelColW;

  const rowH = tableHeight / chunk.length;
  let currentY = tableTop;

  // Split standard / extra; render standard first, then divider, then extras
  const standardAttempts = chunk.filter((a) => !a.isExtra);
  const extraAttempts = chunk.filter((a) => a.isExtra);

  // Pre-pass: tnoodle picks a per-row font that grows to fill each cell — visually
  // jarring when one row gets 24pt single-line and the next gets 12pt two-line text.
  // Find the smallest "best fit" across the whole sheet and clamp every row to it.
  const textBoxW = textColW - 2 * DEFAULT_CELL_PADDING;
  const textBoxH = rowH - 2 * DEFAULT_CELL_PADDING;
  let sheetFontCap = MAX_PHRASE_FONT_SIZE;
  for (const a of chunk) {
    const p = computePhrase(doc, a.scramble, textBoxW, textBoxH);
    if (p.fontSize < sheetFontCap) sheetFontCap = p.fontSize;
  }

  const renderRows = async (attempts: AttemptInput[], isExtra: boolean) => {
    for (let i = 0; i < attempts.length; i++) {
      const a = attempts[i];
      const rowTop = currentY;
      const rowBottom = rowTop + rowH;
      // Cell borders (tnoodle SolidBorder 0.5)
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.rect(tableLeft, rowTop, labelColW, rowH);
      doc.rect(tableLeft + labelColW, rowTop, textColW, rowH);
      const imgX = tableLeft + labelColW + textColW;
      if (hdr.showPreview) {
        // Image cell with gray background
        doc.setFillColor(...SCRAMBLE_BG_RGB);
        doc.rect(imgX, rowTop, imageColW, rowH, 'F');
        doc.setFillColor(255, 255, 255);
        doc.rect(imgX, rowTop, imageColW, rowH);  // border
      }

      // Label
      doc.setFont(FONT_SANS, 'normal');
      doc.setFontSize(12);
      doc.text(a.label, tableLeft + labelColW / 2, rowTop + rowH / 2, { align: 'center', baseline: 'middle' });

      // Scramble text — clamp to sheetFontCap so all rows share the same size.
      const phrase = computePhrase(doc, a.scramble, textBoxW, textBoxH, sheetFontCap);
      const useHL = phrase.lines.length >= MIN_LINES_HIGHLIGHTING;
      doc.setFont(FONT_MONO, 'normal');
      doc.setFontSize(phrase.fontSize);
      const lineH = phrase.fontSize * SCRAMBLE_TEXT_LEADING;
      const totalTextH = lineH * phrase.lines.length;
      const textTop = rowTop + (rowH - totalTextH) / 2;
      const textLeft = tableLeft + labelColW + DEFAULT_CELL_PADDING;
      // pad lines to same length to align tokens visually
      const maxLen = Math.max(...phrase.lines.map((l) => l.length));
      phrase.lines.forEach((rawLine, ln) => {
        const line = rawLine.padEnd(maxLen, NBSP);
        const lineY = textTop + ln * lineH + lineH * 0.8;
        if (useHL && ln % 2 === 1) {
          doc.setFillColor(...SCRAMBLE_HL_RGB);
          doc.rect(textLeft, textTop + ln * lineH, textBoxW, lineH, 'F');
        }
        doc.text(line, textLeft, lineY, { baseline: 'alphabetic' });
      });

      // Image rendering priority:
      //   NxN cube → synchronous unfolded SVG renderer (fast)
      //   clock / sq1 / mega → tnoodle puzzle port (recolorable, synchronous)
      //   pyra / skewb → cubing.js TwistyPlayer 2D extraction (slow)
      // isExtra unused — state computation identical for main vs extras.
      void isExtra;
      if (hdr.showPreview) {
        let portedSvg: string | null = null;
        if (sheet.event === 'mirror_333') {
          portedSvg = renderMirrorBlocksScrambleSvg(a.scramble);
        } else if (sheet.event === 'clock') {
          portedSvg = renderClockScrambleSvg(a.scramble, hdr.eventColors?.clock ?? DEFAULT_CLOCK_COLORS);
        } else if (sheet.event === 'sq1') {
          portedSvg = renderSq1ScrambleSvg(a.scramble, hdr.eventColors?.sq1 ?? DEFAULT_SQ1_COLORS);
        } else if (sheet.event === 'minx') {
          portedSvg = renderMegaScrambleSvg(a.scramble, hdr.eventColors?.minx ?? DEFAULT_MEGA_COLORS);
        } else if (sheet.event === 'pyram') {
          portedSvg = renderPyraScrambleSvg(a.scramble, hdr.eventColors?.pyram ?? PYRA_DEFAULT_COLORS);
        } else if (sheet.event === 'skewb') {
          portedSvg = renderSkewbScrambleSvg(a.scramble, hdr.eventColors?.skewb ?? SKEWB_DEFAULT_COLORS);
        }
        const svgStr = portedSvg
          ?? renderUnfoldedSvgForEvent(sheet.event, a.scramble)
          ?? await getScramble2DSvg(sheet.event, a.scramble);
        if (svgStr) {
          const svgEl = svgStringToElement(svgStr);
          await embedSvg(doc, svgEl, imgX + DEFAULT_CELL_PADDING, rowTop + DEFAULT_CELL_PADDING,
            imageColW - 2 * DEFAULT_CELL_PADDING, rowH - 2 * DEFAULT_CELL_PADDING);
        }
      }

      currentY = rowBottom;
    }
  };

  await renderRows(standardAttempts, false);

  if (extraAttempts.length > 0) {
    // "Extra Scrambles" centered bold divider
    doc.setFont(FONT_SANS, 'bold');
    doc.setFontSize(EXTRA_SCRAMBLE_LABEL_SIZE);
    doc.text('Extra Scrambles', A4_WIDTH / 2, currentY + EXTRA_SCRAMBLE_LABEL_SIZE,
      { align: 'center', baseline: 'middle' });
    currentY += 2 * EXTRA_SCRAMBLE_LABEL_SIZE;
    await renderRows(extraAttempts, true);
  }
}

function svgStringToElement(svgStr: string): SVGSVGElement {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(svgStr, 'image/svg+xml');
  return parsed.documentElement as unknown as SVGSVGElement;
}

let svgRenderHost: HTMLDivElement | null = null;
function getSvgRenderHost(): HTMLDivElement {
  if (svgRenderHost && svgRenderHost.isConnected) return svgRenderHost;
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:600px;height:450px;visibility:hidden;pointer-events:none;';
  document.body.appendChild(div);
  svgRenderHost = div;
  return div;
}

async function embedSvg(
  doc: jsPDF,
  el: SVGSVGElement,
  x: number, y: number, w: number, h: number,
): Promise<void> {
  // svg2pdf.js calls getBBox / getComputedStyle, which only work for
  // *attached* elements. Briefly attach to an off-screen host.
  const host = getSvgRenderHost();
  el.setAttribute('width', String(w));
  el.setAttribute('height', String(h));
  host.appendChild(el);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (doc as any).svg(el, { x, y, width: w, height: h });
  } catch (err) {
    console.warn('[tnoodle_pdf] svg2pdf failed', err);
  } finally {
    try { el.remove(); } catch { /* swallow */ }
  }
}

// ─── FMC Solution Sheet ──────────────────────────────────────────────────
// Port of FmcSolutionSheet.kt — one self-contained sheet per (attempt × locale).
// Layout: top half = info table (rules+notation left, comp+competitor+grading+cube right),
//         middle = "Scramble: ..." line, bottom half = 8×10 underscore writing grid.

interface FmcOpts {
  compTitle: string;
  /** Total FMC attempts in this round/group (drives "Scramble X of Y"). */
  totalAttemptsInRound: number;
  eventColors?: Record<string, Record<string, string>>;
}

async function renderFmcPage(
  doc: jsPDF,
  sheet: RoundSheetInput,
  attempt: AttemptInput,
  locale: TnoodleLocale,
  opts: FmcOpts,
): Promise<void> {
  // Locale-aware font for all SANS text on the sheet
  const isCjk = fontForLocale(locale) === 'wqy-microhei';
  if (isCjk) await ensureCjkFont(doc);
  const localFont = fontForLocaleName(locale);

  // Page frame ──
  const M = FMC_MARGIN;
  const W = A4_WIDTH - 2 * M;
  const H = A4_HEIGHT - 2 * M;
  const x0 = M;
  const y0 = M;

  // Two-column top half ──
  const topH = H / 2;
  const leftW = W * (1 - FMC_RIGHT_PCT);
  const rightW = W * FMC_RIGHT_PCT;
  const leftX = x0;
  const rightX = x0 + leftW;
  const topY = y0;

  // Outer borders for top section
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(leftX, topY, leftW, topH);
  doc.rect(rightX, topY, rightW, topH);

  // ── Right column: 4 stacked cells ──
  // Heights derived from tnoodle ratios:
  //   compTitle ≈ topH/MEDIUM, competitor ≈ topH/LARGE, grading ≈ topH/SMALL,
  //   cube image fills remainder.
  const titleH = topH / FMC_RATIO_MEDIUM;
  const compInfoH = topH / FMC_RATIO_LARGE;
  const gradingH = topH / FMC_RATIO_SMALL;
  const imageH = topH - titleH - compInfoH - gradingH;

  let ry = topY;
  // Comp title block (compTitle / activityTitle / Scramble X of Y)
  const titles: string[] = [opts.compTitle];
  const evName = tFmc('event', locale);
  const setSuffix = (sheet.totalGroups ?? 1) > 1
    ? ` ${tFmc('scramble', locale)} ${tnoodleSetLabel(sheet.groupIdx)}`
    : '';
  const roundLabel = `${evName} ${tFmc('round', locale)} ${sheet.roundIdx + 1}${setSuffix}`;
  titles.push(roundLabel);
  if (opts.totalAttemptsInRound > 1) {
    titles.push(tFmc('scrambleXofY', locale, {
      scrambleIndex: String((sheet.attemptNumber ?? 0) + 1),
      scrambleCount: String(opts.totalAttemptsInRound),
    }));
  }
  doc.setFont(localFont, 'normal');
  const titleLineH = titleH / titles.length;
  const titleFontSize = clamp(titleLineH * 0.55, 7, 12);
  doc.setFontSize(titleFontSize);
  for (let i = 0; i < titles.length; i++) {
    drawCenteredText(doc, titles[i], rightX + rightW / 2, ry + titleLineH * (i + 0.5), rightW - 6, titleFontSize, localFont);
  }
  doc.line(rightX, ry + titleH, rightX + rightW, ry + titleH);
  ry += titleH;

  // Competitor info (Competitor / WCA ID / Registrant ID)
  const competitorLines = [
    tFmc('competitor', locale) + FMC_LONG_FILL,
    'WCA ID' + FMC_WCA_ID_FILL,
    tFmc('registrantId', locale) + FMC_SHORT_FILL,
  ];
  doc.setFont(localFont, 'normal');
  const compFontSize = clamp(compInfoH / 5, 7, 10);
  doc.setFontSize(compFontSize);
  const compLineH = compInfoH / competitorLines.length;
  for (let i = 0; i < competitorLines.length; i++) {
    doc.text(competitorLines[i], rightX + 6, ry + compLineH * (i + 0.65));
  }
  doc.line(rightX, ry + compInfoH, rightX + rightW, ry + compInfoH);
  ry += compInfoH;

  // Grading box ("DO NOT FILL..." + "Graded by: ___ Result: ___")
  const warning = tFmc('warning', locale);
  const gradingLine = `${tFmc('graded', locale)}${FMC_LONG_FILL}  ${tFmc('result', locale)}${FMC_SHORT_FILL}`;
  const gradingFontSize = clamp(gradingH / 4, 6, 9);
  doc.setFont(localFont, 'normal');
  doc.setFontSize(gradingFontSize);
  drawCenteredText(doc, warning, rightX + rightW / 2, ry + gradingH * 0.32, rightW - 6, gradingFontSize, localFont);
  drawCenteredText(doc, gradingLine, rightX + rightW / 2, ry + gradingH * 0.78, rightW - 6, gradingFontSize, localFont);
  doc.line(rightX, ry + gradingH, rightX + rightW, ry + gradingH);
  ry += gradingH;

  // Cube preview (3x3 unfolded net)
  const imgPad = 4;
  const svgStr = renderUnfoldedSvgForEvent('333', attempt.scramble);
  if (svgStr) {
    const svgEl = svgStringToElement(svgStr);
    await embedSvg(doc, svgEl,
      rightX + imgPad, ry + imgPad,
      rightW - 2 * imgPad, imageH - 2 * imgPad);
  }

  // ── Left column: title + rules + notation tables ──
  let ly = topY + 6;
  const lContentW = leftW - 12;
  const lContentX = leftX + 6;

  // Event title (big)
  const evTitleH = topH / FMC_TITLE_RATIO;
  const evTitleFontSize = clamp(evTitleH * 0.65, 14, 26);
  doc.setFont(localFont, 'bold');
  doc.setFontSize(evTitleFontSize);
  drawCenteredText(doc, evName, leftX + leftW / 2, ly + evTitleH * 0.7, lContentW, evTitleFontSize, localFont);
  ly += evTitleH;

  // Rules block
  const rulesH = topH / FMC_RULES_RATIO;
  const rules: string[] = [
    tFmc('rule1', locale),
    tFmc('rule2', locale),
    tFmc('rule3', locale),
    tFmc('rule4', locale, { maxMoves: String(FMC_MAX_MOVES) }),
    tFmc('rule5', locale),
    tFmc('rule6', locale),
  ];
  doc.setFont(localFont, 'normal');
  // Wrap each rule, count total lines, then pick a font size that fits all of them
  let ruleFontSize = clamp(rulesH / 12, 6, 10);
  for (let iter = 0; iter < 6; iter++) {
    doc.setFontSize(ruleFontSize);
    const totalLines = rules.reduce((acc, r) => acc + doc.splitTextToSize('• ' + r, lContentW).length, 0);
    if (totalLines * ruleFontSize * 1.25 <= rulesH) break;
    ruleFontSize *= 0.92;
  }
  doc.setFontSize(ruleFontSize);
  let ruleLineY = ly + ruleFontSize;
  for (const r of rules) {
    const wrapped = doc.splitTextToSize('• ' + r, lContentW) as string[];
    for (const wln of wrapped) {
      doc.text(wln, lContentX, ruleLineY);
      ruleLineY += ruleFontSize * 1.25;
      // hard cap so we never spill into the notation block
      if (ruleLineY > ly + rulesH) break;
    }
    if (ruleLineY > ly + rulesH) break;
  }
  ly += rulesH;

  // Notation tables: Face Moves + Rotations
  const notationH = topH - (ly - topY);
  const notationCellH = notationH / 8;        // (header + 3 dirs) × 2 sections = 8 rows
  const notationFontSize = clamp(notationCellH * 0.5, 6, 10);
  drawNotationTable(doc, lContentX, ly, lContentW, notationCellH * 4,
    tFmc('faceMoves', locale), FMC_FACE_MOVES,
    [tFmc('clockwise', locale), tFmc('counterClockwise', locale), tFmc('double', locale)],
    notationFontSize, localFont);
  drawNotationTable(doc, lContentX, ly + notationCellH * 4, lContentW, notationCellH * 4,
    tFmc('rotations', locale), FMC_ROTATIONS,
    [tFmc('clockwise', locale), tFmc('counterClockwise', locale), tFmc('double', locale)],
    notationFontSize, localFont);

  // ── Middle: "Scramble: ..." line ──
  const scrambleY = topY + topH;
  const scrambleH = 32;
  doc.rect(x0, scrambleY, W, scrambleH);
  doc.setFont(localFont, 'normal');
  const scrambleLabelSize = 10;
  doc.setFontSize(scrambleLabelSize);
  const scrambleLabel = tFmc('scramble', locale) + ': ';
  const labelWidth = doc.getStringUnitWidth(scrambleLabel) * scrambleLabelSize;
  doc.text(scrambleLabel, x0 + 8, scrambleY + scrambleH / 2 + scrambleLabelSize / 3);
  // Scramble itself in mono, sized to fit remaining width
  const scrAvailW = W - 8 - labelWidth - 8;
  const scrSize = fitOneLine(doc, attempt.scramble, scrAvailW, scrambleH - 8);
  doc.setFont(FONT_MONO, 'normal');
  doc.setFontSize(Math.min(scrSize, 14));
  doc.text(attempt.scramble, x0 + 8 + labelWidth, scrambleY + scrambleH / 2 + Math.min(scrSize, 14) / 3);

  // ── Bottom: 8×10 writing grid ──
  const gridY = scrambleY + scrambleH + 10;
  const gridH = (y0 + H) - gridY;
  const lineH = gridH / FMC_MOVE_BAR_LINES;
  const writingLine = Array(FMC_MOVE_BARS_PER_LINE).fill('_').join(' ');
  const barFontSize = clamp(lineH * 0.55, 12, 24);
  doc.setFont(FONT_MONO, 'normal');
  // shrink to fit width
  doc.setFontSize(barFontSize);
  let actualBarSize = barFontSize;
  while (doc.getStringUnitWidth(writingLine) * actualBarSize > W && actualBarSize > 8) {
    actualBarSize -= 1;
  }
  doc.setFontSize(actualBarSize);
  for (let i = 0; i < FMC_MOVE_BAR_LINES; i++) {
    const baselineY = gridY + lineH * (i + 0.65);
    doc.text(writingLine, x0 + W / 2, baselineY, { align: 'center', baseline: 'alphabetic' });
  }
}

/** Tnoodle Set label (A/B/...) for the activityCode "Scramble Set X" suffix. */
function tnoodleSetLabel(groupIdx: number): string {
  return String.fromCharCode(65 + groupIdx);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Center text horizontally; auto-shrink font if it overflows. */
function drawCenteredText(
  doc: jsPDF,
  text: string,
  cx: number,
  y: number,
  maxW: number,
  fontSize: number,
  fontName: string,
): void {
  doc.setFont(fontName, 'normal');
  let size = fontSize;
  doc.setFontSize(size);
  while (doc.getStringUnitWidth(text) * size > maxW && size > 5) {
    size -= 0.5;
  }
  doc.setFontSize(size);
  doc.text(text, cx, y, { align: 'center', baseline: 'alphabetic' });
}

/** Draw a notation table (title row + 3 direction rows). */
function drawNotationTable(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  title: string,
  moves: string[],
  directionLabels: string[],   // [clockwise, counter, double]
  fontSize: number,
  fontName: string,
): void {
  const rowH = h / 4;
  // Right-align direction labels in column 0; columns 1.. for moves.
  const labelColW = w * 0.32;
  const moveColW = (w - labelColW) / moves.length;

  // Title row (bold, right-aligned in label col, no moves)
  doc.setFont(fontName, 'bold');
  doc.setFontSize(fontSize);
  doc.text(title, x + labelColW - 4, y + rowH * 0.7, { align: 'right' });

  // Direction rows
  doc.setFontSize(fontSize);
  for (let r = 0; r < 3; r++) {
    const ry = y + rowH * (r + 1);
    doc.setFont(fontName, 'normal');
    doc.text(directionLabels[r], x + labelColW - 4, ry + rowH * 0.7, { align: 'right' });
    doc.setFont(FONT_MONO, 'normal');
    for (let mi = 0; mi < moves.length; mi++) {
      const cellX = x + labelColW + moveColW * mi;
      const moveStr = moves[mi] + FMC_DIRECTION_MODIFIERS[r];
      doc.text(moveStr, cellX + moveColW / 2, ry + rowH * 0.7, { align: 'center' });
    }
  }
}
