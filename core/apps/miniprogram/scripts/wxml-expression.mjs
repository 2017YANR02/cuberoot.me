import { readFile } from 'node:fs/promises';

const WXML_EXPRESSION_PATTERN = /\{\{[\s\S]*?\}\}/g;
const HTML_ENTITY_PATTERN = /&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i;

export class WxmlExpressionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WxmlExpressionError';
  }
}

export function validateWxmlExpressionSource(source, options = {}) {
  const label = options.label ?? 'WXML';
  for (const match of source.matchAll(WXML_EXPRESSION_PATTERN)) {
    const entity = match[0].match(HTML_ENTITY_PATTERN);
    if (!entity) continue;

    const entityOffset = match.index + entity.index;
    const line = source.slice(0, entityOffset).split('\n').length;
    throw new WxmlExpressionError(
      `${label}:${line} 的 WXML 表达式包含 HTML 实体 ${entity[0]}；表达式运算符必须直接书写。`,
    );
  }
}

export async function validateWxmlExpressionFiles(paths, options = {}) {
  const labelForPath = options.labelForPath ?? ((path) => path);
  for (const path of paths) {
    validateWxmlExpressionSource(await readFile(path, 'utf8'), {
      label: labelForPath(path),
    });
  }
}
