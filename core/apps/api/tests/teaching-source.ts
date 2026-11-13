import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { readLocalModuleSource } from '../../../scripts/read-local-module-source.mjs';

/** Read only modules reachable from the supported teaching API entry. */
export function teachingSource(): string {
  return readLocalModuleSource(new URL('../src/routes/teaching_saas.ts', import.meta.url), {
    roots: [fileURLToPath(new URL('../src/teaching', import.meta.url))],
  });
}

/** Select a complete implementation, independent of adjacent file layout. */
export function teachingDeclaration(source: string, name: string): string {
  const parsed = ts.createSourceFile('teaching.ts', source, ts.ScriptTarget.Latest, true);
  const matches: string[] = [];
  function visit(node: ts.Node): void {
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node))
        && node.name?.getText(parsed) === name && node.body) {
      matches.push(node.getText(parsed));
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  if (matches.length !== 1) throw new Error(`Expected one teaching implementation for ${name}, found ${matches.length}`);
  return matches[0];
}
