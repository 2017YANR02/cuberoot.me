#!/usr/bin/env node
// Shared component-reuse detector for PreToolUse and CI.
//
// A universal "is this semantically duplicated?" check would be noisy. This file is
// deliberately a registry of narrow, high-confidence source patterns. Each rule must
// name the canonical component, provide a copyable replacement, and support an
// explicit escape hatch. Add rules only after a real duplicate has been consolidated.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXEMPTION = 'allow-component-reimplementation';

const CLIENT_TSX = /(?:^|\/)core\/packages\/client\/(?:app|components)\/.*\.tsx$/i;
const SKIP_PATH = /(?:^|\/)(?:tests?|node_modules|\.next)(?:\/|$)|\/components\/(?:ClearButton|PuzzlePicker\/PuzzlePicker)\.tsx$/i;
const BUTTON_BLOCK = /<button\b[\s\S]{0,1600}?<\/button\s*>/gi;
const SELECT_BLOCK = /<select\b[\s\S]{0,1800}?<\/select\s*>/gi;
const PICKER_DECL = /(?:function\s+|const\s+)([A-Za-z_$][\w$]*)/gi;
const PICKER_OPEN_STATE = /const\s*\[\s*[A-Za-z_$][\w$]*(?:event|puzzle)[\w$]*(?:open|menu)[\w$]*\s*,[\s\S]{0,120}?useState\s*\(/gi;
const CROSS = /<X\b|[×✕]/;
const CLOSE_OR_CLEAR =
  /(?:aria-label|ariaLabel|title|className|class)\s*=\s*[\s\S]{0,260}?(?:关闭|清除|close|clear|dismiss)|\bonClose\b/i;
const BACK_HOME_TAG = /<BackHome\b([^>]*)\/>/gi;
const BACK_HOME_DIRECT_ROOT = /<(?:div|main|section)\b[^>]*className\s*=\s*['"]([^'"]+)['"][^>]*>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)*<BackHome\b([^>]*)\/>/gi;
const PAGE_ROOT_CLASS = /(?:^|[-_\s])(?:root|page|app)(?:$|[-_\s])/i;
const SAFE_BACK_HOME_CONTAINER = /(?:^|[-_\s])(?:header|topbar|head|wrap|container|hero|sidebar|back-row)(?:$|[-_\s])/i;
const OPEN_LAYOUT_CONTAINER = /<(?:div|main|section|header|nav|aside)\b[^>]*className\s*=\s*['"]([^'"]+)['"][^>]*>/gi;
const ALG_CASE_VIEW_PATH = /\/app\/\[lang\]\/alg\/\[puzzle\]\/\[set\]\/\[subgroup\]\/AlgCaseView\.tsx$/i;
const ALG_CASE_META_PATH = /\/components\/AlgCaseMetaContent\.tsx$/i;
const ALG_CSS_PATH = /\/app\/\[lang\]\/alg\/alg\.css$/i;

export const COMPONENT_REUSE_RULES = [
  {
    id: 'clear-button',
    component: 'ClearButton',
    importStatement: "import { ClearButton } from '@/components/ClearButton';",
    replacement:
      '<ClearButton variant="standalone" ariaLabel={tr({ zh: \'关闭\', en: \'Close\' })} onClick={onClose} />',
    reason:
      '检测到手写的关闭/清除叉号按钮。统一复用 ClearButton，保留全站一致的尺寸、主题、hover 与无障碍语义。',
  },
  {
    id: 'puzzle-picker',
    component: 'PuzzlePicker',
    importStatement: "import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';",
    replacement:
      '<PuzzlePicker selectedEvent={event} groups={groups} onSelect={setEvent} />',
    reason:
      '检测到页面内重新实现项目选择菜单。下拉统一复用 PuzzlePicker；/wca 页内展开式 21 项图标行复用 WcaEventSelector。',
  },
  {
    id: 'back-home-layout',
    component: 'BackHome',
    importStatement: "import BackHome from '@/components/BackHome';",
    replacement:
      '<div className="page-back-row"><BackHome /></div>',
    reason:
      '检测到 BackHome 直接挂在 full-bleed 页面根节点，或新增位置没有明确布局归属。请放进与正文同宽的 header/topbar/wrap/back-row，避免返回入口贴到视口边缘。',
  },
  {
    id: 'alg-case-detail-layout',
    component: 'AlgCaseView',
    importStatement: "import AlgCaseView from './AlgCaseView';",
    replacement: '<AlgCaseView puzzle={puzzle} set={set} caseObj={caseObj} data={data} />',
    reason:
      'PG 公式库 case 详情统一复用 AlgCaseView：静态主图走 CaseThumb，动画固定在公式左侧；禁止恢复行内播放器或只给部分公式集启用布局，meta 顶部与训练弹窗结构保持不动。',
  },
];

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function exemptionNear(source, index, block) {
  const before = source.slice(Math.max(0, index - 260), index);
  return before.includes(EXEMPTION) || block.includes(EXEMPTION);
}

function backHomeHasOwnLayout(props) {
  return /\bclassName\s*=/.test(props);
}

function hasSafeBackHomeContainer(source, index) {
  const before = source.slice(Math.max(0, index - 1600), index);
  OPEN_LAYOUT_CONTAINER.lastIndex = 0;
  let latestClass = '';
  let match;
  while ((match = OPEN_LAYOUT_CONTAINER.exec(before))) latestClass = match[1];
  return SAFE_BACK_HOME_CONTAINER.test(latestClass);
}

export function scanNewBackHomePlacements(source) {
  const violations = [];
  BACK_HOME_TAG.lastIndex = 0;
  let match;
  while ((match = BACK_HOME_TAG.exec(source))) {
    if (backHomeHasOwnLayout(match[1])) continue;
    if (exemptionNear(source, match.index, match[0])) continue;
    if (hasSafeBackHomeContainer(source, match.index)) continue;
    violations.push({
      ruleId: 'back-home-layout',
      index: match.index,
      snippet: match[0].replace(/\s+/g, ' ').slice(0, 180),
    });
  }
  return violations;
}

export function scanAlgCaseDetailLayout(filePath, source) {
  const normalized = normalizePath(filePath);
  const isView = ALG_CASE_VIEW_PATH.test(normalized);
  const isMeta = ALG_CASE_META_PATH.test(normalized);
  const isCss = ALG_CSS_PATH.test(normalized);
  if (!isView && !isMeta && !isCss) return [];
  const violation = (isView ? (
    /is-without-thumb/.exec(source)
    ?? /inlinePlayer/.exec(source)
    ?? (/!\s*multiOri/.test(source) && /(?:<CaseThumb\b|alg-case-detail-lean-thumb)/.test(source)
      ? /!\s*multiOri/.exec(source)
      : null)
    ?? (/\{\s*multiOri\s*\?\s*\([\s\S]{0,500}?alg-case-detail-ori-main/.exec(source))
    ?? (/\{\s*multiOri\s*&&\s*selectedEntry[\s\S]{0,500}?alg-case-detail-ori-player/.exec(source))
    ?? (/className\s*=\s*\{[^}]{0,500}?(?:multiOri|puzzle\s*===|set\s*===)[^}]{0,500}?alg-case-detail-ori-(?:main|player)/.exec(source))
  ) : null)
    ?? (isMeta
      ? /\{\s*(?:expanded|open)\w*\s*&&\s*\([\s\S]{0,1200}?<AlgPlayer\b/.exec(source)
      : null)
    ?? (isCss
      ? /\.alg-case-detail-lean-algs\.is-multi-ori\s*\{[^}]*grid-template-columns\s*:\s*repeat\(\s*2\b/i.exec(source)
      : null);
  if (!violation || exemptionNear(source, violation.index, violation[0])) return [];
  return [{
    ruleId: 'alg-case-detail-layout',
    index: violation.index,
    snippet: violation[0],
  }];
}

export function scanComponentReimplementations(source) {
  const violations = [];
  BUTTON_BLOCK.lastIndex = 0;
  let match;
  while ((match = BUTTON_BLOCK.exec(source))) {
    const block = match[0];
    if (!CROSS.test(block) || !CLOSE_OR_CLEAR.test(block)) continue;
    if (exemptionNear(source, match.index, block)) continue;
    violations.push({
      ruleId: 'clear-button',
      index: match.index,
      snippet: block.replace(/\s+/g, ' ').slice(0, 180),
    });
  }

  // Native project <select> is a high-confidence duplicate: a project selector must
  // keep the shared icon + name menu, not silently fall back to a page-local option list.
  SELECT_BLOCK.lastIndex = 0;
  while ((match = SELECT_BLOCK.exec(source))) {
    const block = match[0];
    const exactProjectLabel = /(?:aria-label|title)[\s\S]{0,260}?(?:zh\s*:\s*['"](?:项目|拼图)['"][\s\S]{0,120}?en\s*:\s*['"](?:Puzzle|Event)['"]|en\s*:\s*['"](?:Puzzle|Event)['"][\s\S]{0,120}?zh\s*:\s*['"](?:项目|拼图)['"])/i;
    if (!exactProjectLabel.test(block)) continue;
    if (exemptionNear(source, match.index, block)) continue;
    violations.push({
      ruleId: 'puzzle-picker',
      index: match.index,
      snippet: block.replace(/\s+/g, ' ').slice(0, 180),
    });
  }

  let hasPickerViolation = violations.some((item) => item.ruleId === 'puzzle-picker');
  const addPickerViolation = (index, block) => {
    if (hasPickerViolation || exemptionNear(source, index, block)) return;
    hasPickerViolation = true;
    violations.push({
      ruleId: 'puzzle-picker',
      index,
      snippet: block.replace(/\s+/g, ' ').slice(0, 180),
    });
  };

  // Named page-local dropdowns: require their own open state + icon button so thin
  // wrappers that merely feed data into PuzzlePicker/WcaEventSelector stay legal.
  PICKER_DECL.lastIndex = 0;
  while ((match = PICKER_DECL.exec(source))) {
    if (!/(?:Event|Puzzle)/i.test(match[1]) || !/(?:Picker|Select|Selector|Dropdown)/i.test(match[1])) continue;
    if (/^(?:PuzzlePicker|WcaEventSelector|EventSelect)$/.test(match[1])) continue;
    const block = source.slice(match.index, match.index + 7000);
    if (!/(?:\[\s*open\s*,|\bsetOpen\b|PickerOpen|SelectorOpen|DropdownOpen)/i.test(block)) continue;
    if (!/<button\b/i.test(block) || !/(?:<EventIcon\b|<CubingIcon\b)/i.test(block)) continue;
    if (/<(?:PuzzlePicker|WcaEventSelector)\b/.test(block)) continue;
    addPickerViolation(match.index, block);
  }

  // Inline variants (for example a timer topbar) may not extract a named component.
  PICKER_OPEN_STATE.lastIndex = 0;
  while ((match = PICKER_OPEN_STATE.exec(source))) {
    const block = source.slice(match.index, match.index + 7000);
    if (!/<button\b/i.test(block) || !/(?:<EventIcon\b|<CubingIcon\b)/i.test(block)) continue;
    if (/<(?:PuzzlePicker|WcaEventSelector)\b/.test(block)) continue;
    addPickerViolation(match.index, block);
  }

  // BackHome inherits only typography; its horizontal placement belongs to the page.
  // A bare link directly under a full-bleed root is therefore almost always the
  // viewport-edge bug this rule was introduced for. Existing intentional roots can
  // add a semantic className or a reasoned exemption.
  BACK_HOME_DIRECT_ROOT.lastIndex = 0;
  while ((match = BACK_HOME_DIRECT_ROOT.exec(source))) {
    if (SAFE_BACK_HOME_CONTAINER.test(match[1])) continue;
    if (!PAGE_ROOT_CLASS.test(match[1])) continue;
    if (backHomeHasOwnLayout(match[2])) continue;
    if (exemptionNear(source, match.index, match[0])) continue;
    violations.push({
      ruleId: 'back-home-layout',
      index: match.index,
      snippet: match[0].replace(/\s+/g, ' ').slice(0, 180),
    });
  }
  return violations;
}

function parseApplyPatch(patch) {
  const writes = [];
  let filePath = '';
  let added = [];
  const flush = () => {
    if (filePath) writes.push({ filePath: normalizePath(filePath), content: added.join('\n') });
    filePath = '';
    added = [];
  };
  for (const line of String(patch || '').split(/\r?\n/)) {
    const header = line.match(/^\*\*\* (?:Add|Update) File:\s*(.+)$/);
    if (header) {
      flush();
      filePath = header[1].trim();
      continue;
    }
    if (/^\*\*\* (?:Delete|Move to) File:/.test(line) || line === '*** End Patch') {
      flush();
      continue;
    }
    if (filePath && line.startsWith('+') && !line.startsWith('+++')) added.push(line.slice(1));
  }
  flush();
  return writes;
}

function parseEmbeddedApplyPatch(source) {
  const raw = String(source || '');
  if (!raw.includes('*** Begin Patch')) return [];
  const stringLiteral = /(?:const|let)\s+[A-Za-z_$][\w$]*\s*=\s*("(?:\\.|[^"\\])*")/gs;
  let match;
  while ((match = stringLiteral.exec(raw))) {
    try {
      const decoded = JSON.parse(match[1]);
      if (decoded.includes('*** Begin Patch')) return parseApplyPatch(decoded);
    } catch {
      // Malformed unrelated JS string:keep looking,then fail open.
    }
  }
  return parseApplyPatch(raw);
}

export function writesFromHookPayload(payload) {
  const ti = payload?.tool_input;
  if (typeof ti === 'string') return parseEmbeddedApplyPatch(ti);
  if (!ti || typeof ti !== 'object') return [];

  for (const key of ['patch', 'input', 'script', 'code']) {
    if (typeof ti[key] === 'string' && ti[key].includes('*** Begin Patch')) {
      return parseEmbeddedApplyPatch(ti[key]);
    }
  }

  const filePath = normalizePath(ti.file_path);
  if (!filePath) return [];
  const parts = [];
  if (typeof ti.content === 'string') parts.push(ti.content);
  if (typeof ti.new_string === 'string') parts.push(ti.new_string);
  if (Array.isArray(ti.edits)) {
    for (const edit of ti.edits) {
      if (edit && typeof edit.new_string === 'string') parts.push(edit.new_string);
    }
  }
  return [{ filePath, content: parts.join('\n') }];
}

function loadPathAllowlist() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const file = resolve(here, '../../../../.codex/component-reimplementation-allowlist.txt');
    return new Set(
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => normalizePath(line.split('\t')[0].trim())),
    );
  } catch {
    return new Set();
  }
}

function inScope(filePath) {
  const normalized = normalizePath(filePath);
  return (CLIENT_TSX.test(normalized) && !SKIP_PATH.test(normalized)) || ALG_CSS_PATH.test(normalized);
}

export function violationsFromHookPayload(payload, pathAllowlist = loadPathAllowlist()) {
  const violations = [];
  for (const write of writesFromHookPayload(payload)) {
    if (!inScope(write.filePath)) continue;
    const repoRelative = write.filePath.replace(/^.*?(core\/packages\/client\/)/i, '$1');
    if (pathAllowlist.has(repoRelative)) continue;
    const fileViolations = [
      ...scanComponentReimplementations(write.content),
      ...scanNewBackHomePlacements(write.content),
      ...scanAlgCaseDetailLayout(write.filePath, write.content),
    ];
    const seen = new Set();
    for (const violation of fileViolations) {
      const key = `${violation.ruleId}:${violation.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      violations.push({ ...violation, filePath: write.filePath });
    }
  }
  return violations;
}

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
}

const isMain = process.argv[1]
  && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isMain) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => {
    let payload;
    try { payload = JSON.parse(raw || '{}'); } catch { process.exit(0); }
    const violations = violationsFromHookPayload(payload);
    if (violations.length) {
      const rule = COMPONENT_REUSE_RULES.find((item) => item.id === violations[0].ruleId);
      const exceptionKind = rule.id === 'back-home-layout' || rule.id === 'alg-case-detail-layout' ? '不同布局' : '不同交互';
      deny(
        `${rule.reason}\n${rule.importStatement}\n替换为: ${rule.replacement}\n` +
        `确属${exceptionKind}时，在对应 JSX 前注明 // ${EXEMPTION}: <具体理由>。详见 /code/components。`,
      );
    }
    process.exit(0);
  });
}
