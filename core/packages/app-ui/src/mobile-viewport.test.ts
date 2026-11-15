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
const stageCss = readFileSync(new URL(import.meta.resolve('@cuberoot/timer-ui/timer-stage-layout.css')), 'utf8');
const surfaceCss = readFileSync(new URL(import.meta.resolve('@cuberoot/timer-ui/timing-surface.css')), 'utf8');

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
    expect(app).toContain('const shellViewport = mobileShellViewportLayout(shellHeight)');
    expect(app).toContain('style={{ ...shellViewport.style,');
  });

  it('keeps the bottom navigation outside a vertically scrollable, non-horizontal content area', () => {
    expect(directShellClassNames()).toEqual([
      'view-container',
      'primary-nav',
      'toast',
    ]);
    expect(css).toMatch(/\.view-container \{[^}]*overflow-x: hidden;[^}]*overflow-y: auto;/s);
    expect(css).toMatch(/\.mobile-timer-stage \{[^}]*min-height: 0;[^}]*overflow: auto;/s);
    expect(surfaceCss).toMatch(/\.timing-surface--solo,\s*\.timing-surface--net \{[^}]*min-height: 280px;/s);
    // Every viewport override must let this inner scrollport shrink above nav.
    const stageRules = [...css.matchAll(/[^{}]*\.mobile-timer-stage\s*\{([^}]*)\}/g)];
    for (const [, declarations] of stageRules) {
      const minimum = declarations.match(/min-height:\s*([^;]+);/)?.[1];
      if (minimum) expect(minimum).toBe('0');
    }
    expect(css).not.toMatch(/\.mobile-timer-stage \.timing-surface-(?:core|sub)\s*\{/);
    expect(app).toContain('const primaryNavRef = useRef<HTMLElement>(null)');
    expect(app).toContain('primaryNavRef.current?.getBoundingClientRect().height ?? 0');
    const primaryNav = app.match(/<nav\b[^>]*>/g)?.find((tag) => tag.includes('className="primary-nav"'));
    expect(primaryNav).toBeDefined();
    expect(primaryNav).toContain('aria-label={copy.title}');
    expect(primaryNav).toContain('ref={primaryNavRef}');
    const source = ts.createSourceFile('App.tsx', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const insetConsumers: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const inset = node.attributes.properties.find(attribute => (
          ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'viewportBottomInset'
        ));
        if (inset && ts.isJsxAttribute(inset)) {
          expect(inset.initializer?.getText(source)).toBe('{primaryNavBottomInset}');
          insetConsumers.push(node.tagName.getText(source));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    // Workspace extraction changes the JSX count; require each actual overlay
    // owner (including both save-failure and undo toasts) to receive the inset.
    expect(insetConsumers.sort()).toEqual([
      'TimerHistoryWorkspace', 'TimerInfoToast', 'TimerInfoToast', 'TimerMoreMenu',
      'TimerNetOutboxNotice', 'TimerResultsSessionBar', 'TimerStatisticsWorkspace',
      'TimerWcaScrambleProgress',
    ].sort());
    expect(app).not.toMatch(/viewportBottomInset=\{(?:64|96)\}/);
  });

  it('keeps multiplayer device actions in the shared footer flow', () => {
    expect(stageCss).toMatch(/\.timer-stage-footer \{[^}]*display: flex;[^}]*flex: 0 0 auto;/s);
    expect(stageCss).toMatch(/\.timer-stage-footer \.shell-device-center \{[^}]*position: relative;[^}]*inset: auto;/s);
    expect(css).not.toMatch(/\.battle-(?:local-tools|net-timer)[^{]*\.shell-device-center\s*\{/);
  });

  it('fits every installed solo workspace, with an older-WebView baseline and preserved layout preferences', () => {
    expect(app).toContain('<TimerWorkspace className="view-container" data-fit-viewport=""');
    expect(surfaceCss).toContain('@supports not (container-type: size)');
    expect(surfaceCss).toContain('@container timer-stage (min-width: 520px) and (max-height: 500px)');
    // Rotation may compact the vertical stack, never move the readout beside
    // the scramble. This covers both the legacy media and container branches.
    const fitRules = [...surfaceCss.matchAll(/[^{}]*\.timer-workspace\[data-fit-viewport\][^{}]*\{([^}]*)\}/g)];
    for (const [, declarations] of fitRules) {
      const columns = declarations.match(/grid-template-columns:\s*([^;]+);/)?.[1];
      if (columns) expect(columns).toBe('minmax(0, 1fr)');
      expect(declarations).not.toMatch(/grid-column:\s*2\b/);
    }
    expect(surfaceCss).toContain('--timer-readout-max-size: clamp(40px, 18cqh, 64px)');
    expect(surfaceCss).toContain('--timer-cube-h: clamp(36px, 18cqh, 72px)');
    expect(surfaceCss).toContain('.timing-surface-sub { flex: 0 0 auto; height: auto; max-height: none; }');
    expect(surfaceCss).toMatch(/:not\(\[data-spacing-flow\]\) \.timing-surface--solo \{\s*flex: 1 0 auto;\s*min-height: min-content;/);
    expect(surfaceCss).toMatch(/\.timer-workspace\[data-fit-viewport\] \.timing-surface-scramble-top \{\s*max-height: 32vh;\s*overflow-y: auto;/);
    expect(surfaceCss).toContain('padding-top: var(--solo-scramble-gap, 16px)');
    expect(surfaceCss).toContain('row-gap: var(--solo-timer-gap, 20px)');
    expect(surfaceCss).toContain('height: calc(var(--timer-cube-h) * var(--solo-cube-scale, 1))');
    expect(app).toContain("(['scrambleGap', 'sourceGap', 'timerGap', 'cubeGap'] as const)");
    expect(app).toContain('> DEFAULT_SOLO_LAYOUT[key]');
    expect(app).toContain("data-spacing-flow={expandedSoloSpacing ? '' : undefined}");
    expect(surfaceCss).toMatch(/\[data-spacing-flow\] \.timing-surface--solo \{\s*flex: 1 0 auto;\s*min-height: min-content;/);
    expect(surfaceCss).toMatch(/\[data-spacing-flow\] \.timing-surface-core \{[^}]*height: auto;/);
  });

  it('uses the shared settings dialog and its wrapping rules on narrow screens', () => {
    const settingsCss = readFileSync(new URL(import.meta.resolve('@cuberoot/timer-ui/timer-settings-panel.css')), 'utf8');
    expect(app).toContain('<TimerSettingsPanel');
    expect(css).not.toContain('.settings-view');
    expect(settingsCss).toContain('overflow-wrap: anywhere;');
    expect(settingsCss).toMatch(/@media \(max-width: 720px\)[\s\S]*\.settings-category-rail \{ display: none; \}/);
  });
});
