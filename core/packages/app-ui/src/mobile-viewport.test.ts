import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  COMPACT_VIEWPORT_HEIGHT_PX,
  mobileShellViewportLayout,
  observeVisibleViewportHeight,
  usesCompactViewportLayout,
  visibleViewportHeight,
} from './mobile-viewport';

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

class ResizeTarget extends EventTarget {
  constructor(public height: number) {
    super();
  }
}

function directShellClassNames(): string[] {
  const source = ts.createSourceFile('App.tsx', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let shell: ts.JsxElement | undefined;
  const visit = (node: ts.Node) => {
    if (shell) return;
    if (ts.isJsxElement(node)
      && node.openingElement.tagName.getText(source) === 'main'
      && node.openingElement.getText(source).includes('app-shell app-shell--')) shell = node;
    else ts.forEachChild(node, visit);
  };
  visit(source);
  if (!shell) throw new Error('App shell JSX was not found');
  return shell.children.flatMap((child) => {
    if (!ts.isJsxElement(child)) return [];
    const className = child.openingElement.attributes.properties.find((attribute) => (
      ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'className'
    ));
    if (!className || !ts.isJsxAttribute(className) || !className.initializer) return [];
    return ts.isStringLiteral(className.initializer) ? [className.initializer.text] : [];
  });
}

describe('mobile visible viewport layout', () => {
  it('uses the visual viewport when an overlay keyboard is smaller than innerHeight', () => {
    expect(visibleViewportHeight({
      innerHeight: 749,
      visualViewport: { height: 461.4 },
    })).toBe(461);
  });

  it('falls back to innerHeight when visualViewport is absent or transiently invalid', () => {
    expect(visibleViewportHeight({ innerHeight: 749 })).toBe(749);
    expect(visibleViewportHeight({
      innerHeight: 749,
      visualViewport: { height: 0 },
    })).toBe(749);
  });

  it('compacts only short visible viewports and leaves the normal OPPO viewport unchanged', () => {
    expect(usesCompactViewportLayout(461)).toBe(true);
    expect(usesCompactViewportLayout(COMPACT_VIEWPORT_HEIGHT_PX)).toBe(false);
    expect(usesCompactViewportLayout(749)).toBe(false);
  });

  it('tracks visualViewport keyboard resize and restores shell class plus inline height', () => {
    const visualViewport = new ResizeTarget(749);
    const windowTarget = Object.assign(new EventTarget(), {
      innerHeight: 749,
      visualViewport,
    });
    const layouts: ReturnType<typeof mobileShellViewportLayout>[] = [];
    const disconnect = observeVisibleViewportHeight(
      (height) => layouts.push(mobileShellViewportLayout(height)),
      windowTarget,
    );

    visualViewport.height = 461;
    visualViewport.dispatchEvent(new Event('resize'));
    visualViewport.height = 749;
    visualViewport.dispatchEvent(new Event('resize'));
    disconnect();
    visualViewport.height = 461;
    visualViewport.dispatchEvent(new Event('resize'));

    expect(layouts).toEqual([
      { classNameSuffix: '', style: { height: 749, minHeight: 749 } },
      {
        classNameSuffix: ' app-shell--compact-viewport',
        style: { height: 461, minHeight: 461 },
      },
      { classNameSuffix: '', style: { height: 749, minHeight: 749 } },
    ]);
    expect(app).toContain('return observeVisibleViewportHeight(setViewportHeight)');
    expect(app).toContain('const shellViewport = mobileShellViewportLayout(viewportHeight)');
    expect(app).toContain('style={shellViewport.style}');
  });

  it('keeps the bottom navigation outside a vertically scrollable, non-horizontal content area', () => {
    expect(directShellClassNames()).toEqual([
      'view-container',
      'primary-nav',
      'toast',
    ]);
    expect(css).toMatch(/\.view-container \{[^}]*overflow-x: hidden;[^}]*overflow-y: auto;/s);
    expect(css).toMatch(/\.mobile-timer-stage \{[^}]*min-height: 520px;/s);
    expect(css).toMatch(/\.mobile-timer-stage > \.timing-surface \{[^}]*min-height: min-content;/s);
    expect(css).toMatch(/\.app-shell--compact-viewport \.mobile-timer-stage \{[^}]*min-height: 350px;/s);
    expect(css).toMatch(/\.app-shell--compact-viewport \.mobile-timer-stage > \.timing-surface \{[^}]*padding: 8px 0;/s);
  });

  it('keeps multiplayer device actions in normal flow without overflowing narrow screens', () => {
    expect(css).toMatch(/\.battle-local-tools \.shell-device-actions,\s*\.battle-net-timer > \.shell-device-actions \{[^}]*position: static;[^}]*max-width: calc\(100% - 24px\);[^}]*transform: none;/s);
    expect(css).toMatch(/\.battle-local-tools \.shell-device-connect span,\s*\.battle-net-timer > \.shell-device-actions \.shell-device-connect span \{[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;/s);
  });

  it('lets shared setting hints wrap within narrow screens', () => {
    expect(css).toMatch(/\.settings-view \.settings-row-control > \.hint:last-child:not\(:first-child\) \{[^}]*max-width: min\(40vw, 12rem\);[^}]*overflow-wrap: anywhere;[^}]*white-space: normal;/s);
  });
});
