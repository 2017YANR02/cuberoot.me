import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  countDocumentText,
  literalMatches,
  relativePositionFromBase64,
  relativePositionToBase64,
  sortByCreatedAt,
} from '@/lib/document-collaboration';

describe('document collaboration metadata', () => {
  it('round-trips relative positions', () => {
    const document = new Y.Doc();
    const text = document.getText('body');
    text.insert(0, 'agreement');
    const encoded = relativePositionToBase64(Y.createRelativePositionFromTypeIndex(text, 4));
    const decoded = relativePositionFromBase64(encoded);
    expect(decoded).not.toBeNull();
    expect(Y.createAbsolutePositionFromRelativePosition(decoded!, document)?.index).toBe(4);
  });

  it('sorts activity newest first', () => {
    expect(sortByCreatedAt([{ createdAt: 2 }, { createdAt: 7 }, { createdAt: 4 }]).map((item) => item.createdAt)).toEqual([7, 4, 2]);
  });

  it('counts CJK characters and Latin words without treating spaces as words', () => {
    expect(countDocumentText('魔方 root project')).toEqual({ characters: 15, words: 4 });
    expect(countDocumentText('   ')).toEqual({ characters: 0, words: 0 });
  });

  it('finds literal non-overlapping matches', () => {
    expect(literalMatches('aaa', 'aa')).toEqual([{ from: 0, to: 2 }]);
    expect(literalMatches('a.b a.b', 'a.b')).toEqual([{ from: 0, to: 3 }, { from: 4, to: 7 }]);
  });
});
