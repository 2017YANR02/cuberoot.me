import { describe, expect, it } from 'vitest';
import { imageUrlsFromMarkdown, excerptFromMarkdown } from '@cuberoot/shared/forum';
import { normalizeReconMoveSuffixOrder } from '@cuberoot/shared/recon-completion';
import { stripFtnBlocks } from '@cuberoot/shared/alg-notation';
import { canonicalizeReconSolution } from '@cuberoot/shared/recon-ground-truth';
import { scanComponentReimplementations } from '../scripts/hook-detect-component-reimplementation.mjs';

describe('bounded work for malformed parser inputs', () => {
  it('preserves unmatched image delimiters and still extracts the next valid image', () => {
    const input = '!['.repeat(25_000);
    expect(imageUrlsFromMarkdown(input)).toEqual([]);
    expect(excerptFromMarkdown(input, 8)).toBe('![![![![…');
    expect(imageUrlsFromMarkdown(`${input}](https://example.com/a.png)`))
      .toEqual(['https://example.com/a.png']);
  });

  it('preserves nested image/link excerpt semantics and optional image titles', () => {
    expect(excerptFromMarkdown('[before ![image](/a.png) after](/page)')).toBe('before after');
    expect(imageUrlsFromMarkdown('![a](<https://example.com/a b.png> "title") ![b](/b.png)'))
      .toEqual(['https://example.com/a b.png', '/b.png']);
  });

  it('consumes invalid numeric runs without changing prime normalization', () => {
    const digits = '1'.repeat(50_000);
    expect(normalizeReconMoveSuffixOrder(`${digits}! R\'2 // U\'3`))
      .toBe(`${digits}! R2' // U'3`);
    expect(normalizeReconMoveSuffixOrder("2-3Rw'2 M'3")).toBe("2-3Rw2' M3'");
  });

  it('keeps unmatched finger notation and non-timing parentheses', () => {
    const brackets = '['.repeat(25_000);
    expect(stripFtnBlocks(brackets)).toBe(brackets);
    expect(stripFtnBlocks(`${brackets}] R`)).toBe(' R');
    expect(canonicalizeReconSolution('R // (BO) (0.22 + 0.80) (18h*)')).toBe('R // (BO)');
  });

  it('handles long runs of JSX comments before a root child', () => {
    const comments = '{/* note */}'.repeat(100);
    expect(scanComponentReimplementations(`<div className="page-root">${comments}<p />`)).toEqual([]);
  });
});
