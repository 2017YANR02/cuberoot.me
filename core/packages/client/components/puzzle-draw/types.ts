import type { ReactNode } from 'react';

/** A straight SVG line. Missing coordinates fall back to zero, matching SVG. */
export interface DrawLine {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

/**
 * Geometry accepted by the shared puzzle drawing canvas.
 *
 * This intentionally covers cubing.pro's historical `PathSvg` shape so the
 * authorised puzzle definitions can move over without a geometry rewrite.
 * `cellId` is the paint document key; when omitted, `key` is used.
 */
export interface DrawElement {
  key: string;
  cellId?: string;
  /** Historical PathSvg accepted an open string here; known values are inferred below. */
  type?: string;
  d?: string;
  points?: string;
  line?: DrawLine;
  text?: string;
  textSize?: number;
  textPoint?: readonly [number, number] | readonly number[];
  textRouteResetPoint?: readonly [number, number] | readonly number[];
  disableStrokeWidth?: boolean;
  disableDrawing?: boolean;
  baseRotate?: number;
  rotate?: number;
  rotatePoint?: string;
  translate?: readonly number[];
  /** Preferred explicit transform. `transformStr` remains PathSvg-compatible. */
  transform?: string;
  transformStr?: string;
  /** Paint this linked cell with the inverse colour at the same time. */
  unColorBindKey?: string;
  disShow?: boolean;
  defaultFill?: string;
}

/** Sparse paint overrides. Element defaults remain in the geometry definition. */
export type DrawColorDocument = Record<string, string>;

export interface DrawExport {
  svg: string;
  width: number;
  height: number;
  filenameBase: string;
}

export interface RenderDrawSvgOptions {
  elements: readonly DrawElement[];
  colors?: Readonly<DrawColorDocument>;
  viewBox: string;
  width: number;
  height: number;
  strokeWidth?: number;
  strokeWidthScale?: number;
}

export interface DrawCanvasProps {
  elements: readonly DrawElement[];
  viewBox: string;
  width?: number;
  height?: number;
  filenameBase?: string;
  presetColors?: readonly string[];
  historyStorageKey?: string;
  /** Controlled sparse colour document. Omit for local state. */
  colors?: Readonly<DrawColorDocument>;
  /** Initial value and reset target for the uncontrolled or controlled document. */
  defaultColors?: Readonly<DrawColorDocument>;
  onColorsChange?: (colors: DrawColorDocument) => void;
  onDocumentChange?: (doc: DrawExport) => void;
  controls?: ReactNode;
  strokeWidthScale?: number;
  className?: string;
}
