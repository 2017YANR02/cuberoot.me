import { create } from 'zustand';
import type {
  ChooseSet,
  CropConfig,
  ImageEffects,
  MethodSelection,
  PaletteColor,
  PdfConfig,
  Stage,
} from './types';
import { DEFAULT_EFFECTS, DEFAULT_PDF_CONFIG } from './types';
import { DEFAULT_PALETTE } from '../engine/palette';

const LS_PREFIX = 'mosaic.';
const LS_PALETTE = LS_PREFIX + 'palette';
const LS_CROP = LS_PREFIX + 'crop';
const LS_PDF = LS_PREFIX + 'pdf';

function lsLoad<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}
function lsSave(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

interface State {
  stage: Stage;
  prevStage: Stage | null;   // where to return after palette-edit
  palette: PaletteColor[];

  /** Original uploaded image (data URL). */
  origImgSrc: string | null;
  /** Filename (no ext). */
  fileName: string;

  /** Crop result */
  cropConfig: CropConfig;
  /** Post-crop base image (before effects, pre-resized to pixelW×pixelH). */
  baseImageData: ImageData | null;

  /** Stage 2+: user-picked chooseSet + opt. */
  selection: MethodSelection | null;

  /** Image adjustment */
  effects: ImageEffects;
  pdfConfig: PdfConfig;
  plasticColor: string | null;  // null means 'Color' (sticker color)

  /** Progress of PDF export (null = not running). */
  pdfProgress: number | null;
}

interface Actions {
  // navigation
  goToStage: (s: Stage) => void;
  openPalette: () => void;
  closePalette: () => void;

  // upload / crop
  setImage: (src: string, fileName: string) => void;
  resetAll: () => void;
  setCropConfig: (cfg: Partial<CropConfig>) => void;
  setBaseImage: (id: ImageData) => void;

  // selection
  selectMethod: (sel: MethodSelection) => void;
  selectVariant: (chooseSet: ChooseSet, opt: number | number[]) => void;

  // adjust
  setEffect: <K extends keyof ImageEffects>(key: K, value: ImageEffects[K]) => void;
  resetEffects: () => void;
  setPdfConfig: (cfg: Partial<PdfConfig>) => void;
  setPlasticColor: (c: string | null) => void;
  setPdfProgress: (p: number | null) => void;

  // palette
  setPalette: (p: PaletteColor[]) => void;
  resetPalette: () => void;
}

export const useMosaicStore = create<State & Actions>((set) => ({
  stage: 'upload',
  prevStage: null,
  palette: lsLoad<PaletteColor[]>(LS_PALETTE, DEFAULT_PALETTE),

  origImgSrc: null,
  fileName: '',

  cropConfig: lsLoad<CropConfig>(LS_CROP, { cubeDimen: 3, cubeWidth: 20, cubeHeight: 30 }),
  baseImageData: null,

  selection: null,

  effects: { ...DEFAULT_EFFECTS },
  pdfConfig: lsLoad<PdfConfig>(LS_PDF, DEFAULT_PDF_CONFIG),
  plasticColor: null,
  pdfProgress: null,

  goToStage: (s) => set({ stage: s, prevStage: null }),
  openPalette: () => set(st => ({ stage: 'palette', prevStage: st.stage === 'palette' ? st.prevStage : st.stage })),
  closePalette: () => set(st => ({ stage: st.prevStage ?? 'upload', prevStage: null })),

  setImage: (src, fileName) => set({
    origImgSrc: src,
    fileName,
    stage: 'crop',
    baseImageData: null,
    selection: null,
    effects: { ...DEFAULT_EFFECTS },
  }),
  resetAll: () => set({
    stage: 'upload',
    prevStage: null,
    origImgSrc: null,
    fileName: '',
    baseImageData: null,
    selection: null,
    effects: { ...DEFAULT_EFFECTS },
  }),
  setCropConfig: (cfg) => set(st => {
    const next = { ...st.cropConfig, ...cfg };
    lsSave(LS_CROP, next);
    return { cropConfig: next };
  }),
  setBaseImage: (id) => set({ baseImageData: id, stage: 'choose-method' }),

  selectMethod: (sel) => set({ selection: sel, stage: 'choose-variant' }),
  selectVariant: (chooseSet, opt) => set({ selection: { chooseSet, opt }, stage: 'adjust' }),

  setEffect: (key, value) => set(st => ({ effects: { ...st.effects, [key]: value } })),
  resetEffects: () => set({ effects: { ...DEFAULT_EFFECTS } }),
  setPdfConfig: (cfg) => set(st => {
    const next = { ...st.pdfConfig, ...cfg };
    lsSave(LS_PDF, next);
    return { pdfConfig: next };
  }),
  setPlasticColor: (c) => set({ plasticColor: c }),
  setPdfProgress: (p) => set({ pdfProgress: p }),

  setPalette: (p) => {
    lsSave(LS_PALETTE, p);
    set({ palette: p });
  },
  resetPalette: () => {
    lsSave(LS_PALETTE, DEFAULT_PALETTE);
    set({ palette: structuredClone(DEFAULT_PALETTE) });
  },
}));

// DevHelper: expose for debugging
if (typeof window !== 'undefined') {
  (window as unknown as { __mosaic?: unknown }).__mosaic = useMosaicStore;
}
