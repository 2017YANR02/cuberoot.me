import ts from 'typescript';

export interface HistoryPushSite {
  call: string;
  line: number;
}

/** Inspect executable syntax only: documentation strings and comments are not policy violations. */
export function findHistoryPushSites(source: string, filename = 'page.tsx'): HistoryPushSite[] {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const sites: HistoryPushSite[] = [];
  const compact = (node: ts.Node) => ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, node, file).replace(/\s+/g, ' ').trim();
  const containsPush = (node: ts.Node): boolean => {
    if (ts.isStringLiteralLike(node) && node.text === 'push') return true;
    return ts.forEachChild(node, containsPush) ?? false;
  };
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node)
      && (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name))
      && node.name.text === 'history' && containsPush(node.initializer)) {
      let owner: ts.CallExpression | undefined;
      for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent) {
        if (!ts.isCallExpression(parent)) continue;
        owner ??= parent;
        if (ts.isIdentifier(parent.expression) && /^(useQueryState|useQueryStates|useTrainingQueryState|useTrainingQueryStates)$/.test(parent.expression.text)) {
          owner = parent;
          break;
        }
      }
      // Match the exact navigation target AND policy, never allow an entire file.
      const argument = owner?.arguments[0];
      let target = argument ? compact(argument) : '';
      if (argument && ts.isObjectLiteralExpression(argument)) {
        const containingParser = argument.properties.find(property => property.pos <= node.pos && property.end >= node.end);
        // A per-parser option applies only to that key; batch options apply to the listed keys.
        const properties = containingParser ? [containingParser] : argument.properties;
        target = `{${properties.map(property => property.name ? compact(property.name) : compact(property)).join(',')}}`;
      }
      const call = owner
        ? `${compact(owner.expression)}(${target}) history=${compact(node.initializer)}`
        : `<unbound> history=${compact(node.initializer)}`;
      sites.push({ call, line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return sites;
}
