// Puzzle-image preview/export must never replace live state with a plausible static image.
// Paired hook: .codex/hooks/block-puzzle-image-state-parity.ps1.
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scanPuzzleImageStateParity, violationsFromHookPayload,
} from '../scripts/hook-detect-puzzle-image-state-parity.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(ROOT, '..', '..', '..');
const STUDIO = join(ROOT, 'components', 'puzzle-image', 'PuzzleImageStudio.tsx');
const SIM = join(ROOT, 'app', '[lang]', 'sim', 'SimPage.tsx');

describe('puzzle-image state parity guard', () => {
  it('blocks a new host without an explicit static fallback capability', () => {
    const file = 'D:/cube/cuberoot.me/core/packages/client/app/demo/page.tsx';
    expect(scanPuzzleImageStateParity(file,
      '<PuzzleImageStudio spec={spec} onSpecChange={setSpec} engineSvg={svg} />'))
      .toHaveLength(1);
    expect(scanPuzzleImageStateParity(file,
      '<PuzzleImageStudio spec={spec} onSpecChange={setSpec} engineSvg={svg} staticFallbackExact={exact} />'))
      .toEqual([]);
    expect(violationsFromHookPayload({
      tool_input: { file_path: file, content: '<PuzzleImageStudio spec={spec} engineSvg={svg} />' },
    })).toHaveLength(1);
  });

  it('requires the studio to wait instead of silently rendering a different static state', () => {
    const source = readFileSync(STUDIO, 'utf8');
    expect(source).toMatch(/staticFallbackExact:\s*boolean/);
    expect(source).not.toMatch(/staticFallbackExact\?\s*:/);
    expect(source.indexOf('if (!staticFallbackExact) return')).toBeLessThan(source.indexOf('renderSpecSvg(s)'));
    expect(source).toContain('!staticFallbackExact && !engineShown');
    expect(source).toContain('disabled={!exportReady}');
    expect(source).toContain('!engineOnly && staticFallbackExact && !externalImage');
  });

  it('all website hosts declare capability and /sim computes it from visible stickering state', () => {
    const source = readFileSync(SIM, 'utf8');
    const tags = [...source.matchAll(/<PuzzleImageStudio\b[\s\S]*?(?:\/>|>)/g)].map((m) => m[0]);
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.every((tag) => /\bstaticFallbackExact\s*=/.test(tag))).toBe(true);
    expect(source).toContain("query.stickering !== 'full'");
    expect(source).toContain('resolveCaps(puzzleParam, query.renderer).supports.stickering');
    expect(source).toContain('visualcubeMaskForStickering(puzzleParam, query.stickering)');
    expect(source).toMatch(/const active = imageOpen && \(!srCompanionForced \|\|[^;]*!staticFallbackExact\);/);
    expect(source).toMatch(/if \(!\w*ImageStudioEngineOnly && staticFallbackExact\)/);
  });

  it('the write hook exists and is registered for both command fields', () => {
    const hookName = 'block-puzzle-image-state-parity.ps1';
    expect(existsSync(join(REPO_ROOT, '.codex', 'hooks', hookName))).toBe(true);
    const config = JSON.parse(readFileSync(join(REPO_ROOT, '.codex', 'hooks.json'), 'utf8'));
    const writeGroup = config.hooks.PreToolUse.find((group: { matcher: string }) => group.matcher === 'apply_patch');
    expect(writeGroup.hooks.some((hook: { command?: string }) => hook.command?.includes(hookName))).toBe(true);
    expect(writeGroup.hooks.some((hook: { commandWindows?: string }) => hook.commandWindows?.includes(hookName))).toBe(true);
  });
});
