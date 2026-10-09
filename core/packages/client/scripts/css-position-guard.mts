// Shared scanner for the Codex write hook and CI. Deliberately checks only
// recognizable shared-control classes and complete CSS rules, not arbitrary layout.
import ts from 'typescript';
import { resolve } from 'node:path';
import { prospectiveWritesFromHookPayload } from './hook-detect-nested-links.mjs';

export interface Source { filePath: string; content: string }
export interface Violation { filePath: string; selector: string; line: number; kind: string; detail: string }
type Rule = { selector: string; declarations: Map<string, string>; line: number; start: number; exempt: boolean };

const CONTROL_CLASSES: Record<string, Record<string, string[]>> = {
  SettingsPopover: { className: ['settings-popover'], triggerClassName: ['settings-popover-trigger'], panelClassName: ['settings-popover-panel'] },
  TrainingSettings: { className: ['settings-popover'] },
  ClearButton: { className: ['clear-btn', 'clear-btn--standalone'] },
  CountryInput: { className: ['country-input'] },
  PuzzlePicker: { className: ['pp'] },
  DateInput: { className: ['date-input'] },
  HeaderToggles: { className: ['header-toggles'] },
  BoolToggle: { className: ['bool-toggle'] },
  PillToggle: { className: ['pill-toggle'] },
  BackHome: { className: ['back-home'] },
};
const BASE_CLASSES = new Set(Object.values(CONTROL_CLASSES).flatMap(props => Object.values(props).flat()));
const REPO_ROOT = resolve(import.meta.dirname, '../../../..');
const OFFSET = /^(?:top|right|bottom|left|inset(?:-(?:inline|block)(?:-(?:start|end))?)?)$/;
const POSITION = /^(?:position|transform|translate|top|right|bottom|left|inset(?:-(?:inline|block)(?:-(?:start|end))?)?)$/;

export function inScope(filePath: string): boolean {
  const path = filePath.replaceAll('\\', '/');
  return /(?:^|\/)core\/packages\/(?:client\/(?:app|components)|(?:app-ui|timer-ui|shared)\/src)\/.*\.(?:css|tsx)$/.test(path)
    && !/(?:^|\/)(?:tests?|fixtures|node_modules|\.next|dist|build|out|coverage)(?:\/|$)|\.test\.tsx$/.test(path);
}

function classesIn(node: ts.Node): string[] {
  const classes: string[] = [];
  function visit(child: ts.Node) {
    if (ts.isStringLiteralLike(child) || ts.isTemplateHead(child) || ts.isTemplateMiddle(child) || ts.isTemplateTail(child)) {
      classes.push(...child.text.trim().split(/\s+/).filter(value => /^[a-zA-Z_][\w-]*$/.test(value)));
    }
    ts.forEachChild(child, visit);
  }
  visit(node);
  return classes;
}

export function sharedControlRoles(sources: Source[]): Map<string, Set<string>> {
  const roles = new Map<string, Set<string>>();
  function add(role: string, bases: string[]) {
    if (BASE_CLASSES.has(role)) return;
    const known = roles.get(role) ?? new Set<string>();
    bases.forEach(base => known.add(base));
    roles.set(role, known);
  }
  for (const { filePath, content } of sources.filter(source => source.filePath.endsWith('.tsx') && inScope(source.filePath))) {
    const file = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const names = new Map(Object.keys(CONTROL_CLASSES).map(name => [name, name]));
    for (const statement of file.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      const clause = statement.importClause;
      const module = ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text.split('/').pop() : undefined;
      if (clause?.name && module && CONTROL_CLASSES[module]) names.set(clause.name.text, module);
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const binding of clause.namedBindings.elements) {
          const name = (binding.propertyName ?? binding.name).text;
          if (CONTROL_CLASSES[name]) names.set(binding.name.text, name);
        }
      }
    }
    function visit(node: ts.Node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(file);
        const component = names.get(tag) ?? names.get(tag.split('.').pop() ?? '');
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute) || !attribute.initializer) continue;
          const prop = attribute.name.getText(file);
          const classes = classesIn(attribute.initializer);
          const bases = component ? CONTROL_CLASSES[component]?.[prop] : undefined;
          if (bases) classes.forEach(role => add(role, bases));
          // Also recognize explicit native markup carrying a shared control's classes.
          if (/^[a-z]/.test(tag) && prop === 'className') {
            const nativeBases = classes.filter(value => BASE_CLASSES.has(value));
            if (nativeBases.length) classes.forEach(role => add(role, nativeBases));
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(file);
  }
  return roles;
}

function cssRules(source: string): Rule[] {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, comment => ' '.repeat(comment.length));
  const rules: Rule[] = [];
  // Restrict the cascade check to simple class selectors. Complex selectors,
  // CSS modules and dynamic JSX classes still need browser verification.
  for (const match of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = new Map<string, string>();
    for (const declaration of match[2].matchAll(/(?:^|;)\s*([\w-]+)\s*:\s*([^;{}]+)/g)) {
      declarations.set(declaration[1], declaration[2].trim());
    }
    const start = match.index + match[0].indexOf('{');
    const original = source.slice(start + 1, match.index + match[0].length);
    const exempt = /\/\*\s*allow-css-position:\s*[^*\s][^*]*\*\//.test(original);
    for (const selector of match[1].split(',').map(value => value.trim())) {
      if (!/^\.[\w-]+(?:\.[\w-]+)*$/.test(selector)) continue;
      rules.push({ selector, declarations, start, exempt, line: source.slice(0, start).split('\n').length });
    }
  }
  return rules;
}

function resetBy(rule: Rule, property: string): boolean {
  if (rule.declarations.has(property)) return true;
  if (OFFSET.test(property) && rule.declarations.has('inset')) return true;
  if (/^inset-inline-/.test(property) && rule.declarations.has('inset-inline')) return true;
  if (/^inset-block-/.test(property) && rule.declarations.has('inset-block')) return true;
  return rule.declarations.has('all');
}

export function scanCssPosition(sources: Source[]): Violation[] {
  const scoped = sources.filter(source => inScope(source.filePath));
  const roles = sharedControlRoles(scoped);
  const styles = scoped.filter(source => source.filePath.endsWith('.css') && !source.filePath.endsWith('.module.css'))
    .map(source => ({ ...source, rules: cssRules(source.content) }));
  const baseProperties = new Map<string, Set<string>>();
  for (const style of styles) for (const rule of style.rules) {
    const base = rule.selector.slice(1);
    if (!BASE_CLASSES.has(base)) continue;
    const properties = baseProperties.get(base) ?? new Set<string>();
    for (const property of rule.declarations.keys()) if (POSITION.test(property)) properties.add(property);
    baseProperties.set(base, properties);
  }
  const violations: Violation[] = [];
  for (const { filePath, rules } of styles) for (const rule of rules) {
    if (rule.exempt) continue;
    const bases = roles.get(rule.selector.slice(1));
    if (bases) {
      const conflicts = [...rule.declarations.keys()].filter(property => POSITION.test(property)
        && [...bases].some(base => baseProperties.get(base)?.has(property)));
      if (conflicts.length) violations.push({ filePath, selector: rule.selector, line: rule.line, kind: 'shared-position',
        detail: `${conflicts.join(', ')} 与共享控件单 class 样式同优先级；用 .${[...bases][0]}${rule.selector} 明确覆盖，避免依赖 CSS 加载顺序。` });
    }
    const position = rule.declarations.get('position');
    if (position !== 'relative' && position !== 'static') continue;
    const previous = rules.filter(peer => peer.start < rule.start && peer.selector === rule.selector
      && /^(?:absolute|fixed)$/.test(peer.declarations.get('position') ?? ''));
    const missing = new Set<string>();
    for (const peer of previous) for (const [property, value] of peer.declarations) {
      const relevant = property === 'transform' || property === 'translate' || (position === 'relative' && OFFSET.test(property));
      if (relevant && !/^(?:auto|none|0(?:px|%)?)$/.test(value) && !resetBy(rule, property)) missing.add(property);
    }
    if (missing.size) violations.push({ filePath, selector: rule.selector, line: rule.line, kind: 'position-reset',
      detail: `从 absolute/fixed 切到 ${position} 时需显式重置 ${[...missing].join(', ')}；偏移用 auto，transform/translate 用 none。static 下未生效的 inset 不报错。` });
  }
  return violations;
}

export function positionViolationsFromHookPayload(payload: any, sources: Source[]): Violation[] {
  const input = payload?.original_tool_input ?? payload?.tool_input;
  const patch = typeof input === 'string' ? input : input?.command ?? input?.patch ?? input?.input;
  // The shared adapter retains the original patch. Reconstruct the proposed
  // complete files so a one-line property edit cannot bypass the scanner.
  const normalized = typeof patch === 'string' && patch.includes('*** Begin Patch')
    ? { ...payload, tool_input: { patch: patch.replace(/^(\*\*\* (?:Add|Update|Delete) File: )(.+)$/gm,
      (_match, prefix, filePath) => prefix + resolve(payload.cwd || REPO_ROOT, filePath.trim())) } }
    : payload;
  const existing = new Map(sources.map(source => [source.filePath.replaceAll('\\', '/'), source.content]));
  const writes = prospectiveWritesFromHookPayload(normalized, (filePath: string) => existing.get(filePath.replaceAll('\\', '/')) ?? null)
    .filter((write: any) => inScope(write.filePath));
  if (!writes.length) return [];
  const proposed = new Map(existing);
  for (const write of writes) proposed.set(write.filePath.replaceAll('\\', '/'), write.after);
  const identity = (hit: Violation) => `${hit.filePath}|${hit.selector}|${hit.kind}|${hit.detail}`;
  const before = new Set(scanCssPosition(sources).map(identity));
  return scanCssPosition([...proposed].map(([filePath, content]) => ({ filePath, content })))
    .filter(hit => !before.has(identity(hit)));
}
