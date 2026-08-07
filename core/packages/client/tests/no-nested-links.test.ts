// JSX links may not contain another link. React reports <a> inside <a> only at
// runtime as a hydration error; tsgo stays green. This AST guard covers native
// anchors plus the shared/framework components known to render anchors.
// Paired hook: .claude/hooks/block-nested-links.ps1.
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXEMPTION,
  scanNestedLinks,
  violationsFromHookPayload,
} from '../scripts/hook-detect-nested-links.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(ROOT, '..', '..', '..');
const SCAN_DIRS = ['app', 'components'];

function safeReaddir(dir: string) {
  try { return readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of safeReaddir(dir)) {
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      out = out.concat(walk(join(dir, entry.name)));
    } else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

describe('nested link guard', () => {
  it('detects native and component links nested in a link', () => {
    expect(scanNestedLinks('<a href="/x"><a href="/y">Y</a></a>')).toHaveLength(1);
    expect(scanNestedLinks('<AppLink href="/x"><PersonLink wcaId="2017YANR02" /></AppLink>')).toHaveLength(1);
    expect(scanNestedLinks('<Link href="/x"><a href="/y">Y</a></Link>')).toHaveLength(1);
    expect(scanNestedLinks(`
      import Foo from '@/components/AppLink';
      export default function Demo() { return <a href="/x"><Foo href="/y">Y</Foo></a>; }
    `)).toHaveLength(1);
  });

  it('allows sibling links, non-link parents, and a reasoned exception', () => {
    expect(scanNestedLinks('<><a href="/x">X</a><PersonLink wcaId="2017YANR02" /></>')).toEqual([]);
    expect(scanNestedLinks('<div><PersonLink wcaId="2017YANR02" /></div>')).toEqual([]);
    expect(scanNestedLinks(`<a href="/x">{/* ${EXEMPTION}: test fixture */}<PersonLink wcaId="bad" /></a>`)).toEqual([]);
  });

  it('reconstructs Claude Edit and Codex apply_patch before checking', () => {
    const path = 'D:/cube/cuberoot.me/core/packages/client/app/demo/page.tsx';
    const current = '<a href="/x">\n  <span>Author</span>\n</a>';
    const readCurrent = () => current;
    const edit = {
      tool_input: {
        file_path: path,
        old_string: '<span>Author</span>',
        new_string: '<PersonLink wcaId="2017YANR02" />',
      },
    };
    const patch = {
      tool_input: {
        patch: `*** Begin Patch\n*** Update File: ${path}\n@@\n-  <span>Author</span>\n+  <PersonLink wcaId="2017YANR02" />\n*** End Patch`,
      },
    };
    expect(violationsFromHookPayload(edit, readCurrent)).toHaveLength(1);
    expect(violationsFromHookPayload(patch, readCurrent)).toHaveLength(1);
  });

  it('finds no nested links in current source', () => {
    const violations: string[] = [];
    for (const base of SCAN_DIRS) {
      for (const file of walk(join(ROOT, base))) {
        for (const hit of scanNestedLinks(readFileSync(file, 'utf8'), file)) {
          violations.push(`${relative(ROOT, file)}:${hit.line}:${hit.column} ${hit.outerTag} > ${hit.innerTag}`);
        }
      }
    }
    expect(
      violations,
      '链接内不能再放链接；把整行链接改成覆盖层，或让两个链接成为同级。\n命中:\n' + violations.join('\n'),
    ).toEqual([]);
  });

  it('is wired into the repository Codex hook configuration', () => {
    const codex = JSON.parse(readFileSync(join(REPO_ROOT, '.codex', 'hooks.json'), 'utf8'));
    const preTool = codex.hooks?.PreToolUse ?? [];
    expect(preTool.some((group: { matcher?: string; hooks?: Array<{ command?: string }> }) =>
      group.matcher?.includes('apply_patch')
      && group.hooks?.some((hook) => hook.command?.includes('block-nested-links.ps1')),
    )).toBe(true);
    expect(existsSync(join(REPO_ROOT, '.claude', 'hooks', 'block-nested-links.ps1'))).toBe(true);
  });
});
