import * as Y from 'yjs';
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  type ProsemirrorBinding,
} from 'y-prosemirror';

export type DocumentMode = 'edit' | 'suggest' | 'view';

export interface DocumentAnchor {
  from: string;
  to: string;
  quote: string;
}

export interface DocumentReply {
  id: string;
  authorKey: string;
  authorName: string;
  body: string;
  createdAt: number;
}

export interface DocumentComment {
  id: string;
  authorKey: string;
  authorName: string;
  body: string;
  createdAt: number;
  resolvedAt: number | null;
  anchor: DocumentAnchor | null;
  replies: DocumentReply[];
}

export interface DocumentSuggestion {
  id: string;
  authorKey: string;
  authorName: string;
  anchor: DocumentAnchor;
  beforeText: string;
  replacement: string;
  summary: string;
  createdAt: number;
  status: 'open' | 'accepted' | 'rejected';
}

export interface DocumentActivity {
  id: string;
  authorKey: string;
  authorName: string;
  kind: 'edit' | 'comment' | 'reply' | 'resolve' | 'suggestion' | 'accept' | 'reject';
  summary: string;
  createdAt: number;
}

export function relativePositionToBase64(position: Y.RelativePosition): string {
  const bytes = Y.encodeRelativePosition(position);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function relativePositionFromBase64(encoded: string): Y.RelativePosition | null {
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return Y.decodeRelativePosition(bytes);
  } catch {
    return null;
  }
}

type ProsemirrorMapping = ProsemirrorBinding['mapping'];

export function createDocumentAnchor(fragment: Y.XmlFragment, mapping: ProsemirrorMapping, from: number, to: number, quote: string): DocumentAnchor | null {
  if (from < 0 || to < from) return null;
  return {
    from: relativePositionToBase64(absolutePositionToRelativePosition(from, fragment, mapping)),
    to: relativePositionToBase64(absolutePositionToRelativePosition(to, fragment, mapping)),
    quote: quote.slice(0, 240),
  };
}

export function resolveDocumentAnchor(ydoc: Y.Doc, fragment: Y.XmlFragment, mapping: ProsemirrorMapping, anchor: DocumentAnchor): { from: number; to: number } | null {
  const from = relativePositionFromBase64(anchor.from);
  const to = relativePositionFromBase64(anchor.to);
  if (!from || !to) return null;
  const absoluteFrom = relativePositionToAbsolutePosition(ydoc, fragment, from, mapping);
  const absoluteTo = relativePositionToAbsolutePosition(ydoc, fragment, to, mapping);
  if (absoluteFrom == null || absoluteTo == null || absoluteTo < absoluteFrom) return null;
  return { from: absoluteFrom, to: absoluteTo };
}

export function countDocumentText(text: string): { characters: number; words: number } {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return { characters: 0, words: 0 };
  const cjkPattern = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
  const cjk = normalized.match(cjkPattern)?.length ?? 0;
  const words = normalized.replace(cjkPattern, ' ').match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  return { characters: text.length, words: cjk + words };
}

export function literalMatches(text: string, query: string): Array<{ from: number; to: number }> {
  if (!query) return [];
  const matches: Array<{ from: number; to: number }> = [];
  let from = 0;
  while (from <= text.length - query.length) {
    const index = text.indexOf(query, from);
    if (index < 0) break;
    matches.push({ from: index, to: index + query.length });
    from = index + Math.max(1, query.length);
  }
  return matches;
}

export function mapValues<T>(map: Y.Map<T>): T[] {
  return Array.from(map.values());
}

export function sortByCreatedAt<T extends { createdAt: number }>(values: T[]): T[] {
  return [...values].sort((left, right) => right.createdAt - left.createdAt);
}

export function nextDocumentRecordId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomUUID()}`;
}
