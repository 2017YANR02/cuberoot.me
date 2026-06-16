// Normalized vector document model for /paint.
//
// Coordinates are a single "scene" space. The content <svg> uses a viewBox
// derived from the Camera for zoom/pan; shapes store their geometry in scene
// units. Every shape's box (x,y,width,height) is the UNROTATED axis-aligned
// bounding box in scene coords; `rotation` (deg) rotates the rendered element
// around the box center.

export type Point = { x: number; y: number };

// Unrotated axis-aligned box, scene coords.
export type Bounds = { x: number; y: number; width: number; height: number };

export type ShapeType =
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'polygon'
  | 'star'
  | 'path'
  | 'text'
  | 'freehand'
  | 'group';

export type ToolId =
  | 'select'
  | 'rect'
  | 'roundRect'
  | 'ellipse'
  | 'line'
  | 'polygon'
  | 'star'
  | 'pen'
  | 'pencil'
  | 'text'
  | 'eyedropper'
  | 'hand';

export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // deg, around bbox center
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDash?: number[];
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeLinejoin?: 'miter' | 'round' | 'bevel';
  opacity: number;
  name?: string;
  locked?: boolean;
  hidden?: boolean;
}

export interface RectShape extends BaseShape {
  type: 'rect';
  rx: number; // corner radius; rounded-rect is a rect with rx>0
}

export interface EllipseShape extends BaseShape {
  type: 'ellipse';
}

export interface LineShape extends BaseShape {
  type: 'line';
  flipped?: boolean; // line is a bbox diagonal; flipped picks the other diagonal
}

export interface PolygonShape extends BaseShape {
  type: 'polygon';
  sides: number;
  rx?: number;
}

export interface StarShape extends BaseShape {
  type: 'star';
  points: number;
  innerRatio: number;
  rx?: number;
}

export interface PathShape extends BaseShape {
  type: 'path';
  d: string;
  closed: boolean;
}

export interface TextShape extends BaseShape {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  textAlign: 'left' | 'center' | 'right';
}

export interface FreehandShape extends BaseShape {
  type: 'freehand';
  pts: [number, number][];
}

export interface GroupShape extends BaseShape {
  type: 'group';
  children: string[];
}

export type Shape =
  | RectShape
  | EllipseShape
  | LineShape
  | PolygonShape
  | StarShape
  | PathShape
  | TextShape
  | FreehandShape
  | GroupShape;

export type HandleId =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'rotate';

export type Camera = { x: number; y: number; zoom: number };

// The undoable document slice.
export interface PaintDoc {
  shapes: Record<string, Shape>;
  order: string[]; // z-order, bottom -> top
}

export const HANDLE_IDS: HandleId[] = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
];
