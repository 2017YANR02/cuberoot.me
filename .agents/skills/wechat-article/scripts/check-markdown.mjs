#!/usr/bin/env node

import fs from 'node:fs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node check-markdown.mjs <draft.md> [...]');
  process.exit(2);
}

const issues = [];

for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let fenced = false;

  lines.forEach((line, lineIndex) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;

    const text = line.replace(/`[^`]*`/g, '');
    const markers = [];
    for (let i = 0; i < text.length - 1; i += 1) {
      if (text[i] === '*' && text[i + 1] === '*' && text[i - 1] !== '\\') {
        markers.push(i);
        i += 1;
      }
    }

    if (markers.length % 2 !== 0) {
      issues.push(`${file}:${lineIndex + 1}: unbalanced ** marker`);
      return;
    }

    for (let i = 0; i < markers.length; i += 2) {
      const start = markers[i];
      const end = markers[i + 1];
      const content = text.slice(start + 2, end);
      const after = text[end + 2] ?? '';
      if (/^\s|\s$/.test(content)) {
        issues.push(`${file}:${lineIndex + 1}: whitespace touches ** content`);
      }
      if (/[\p{P}\p{S}]$/u.test(content) && /[\p{L}\p{N}]/u.test(after)) {
        issues.push(`${file}:${lineIndex + 1}: add a space after closing **`);
      }
    }
  });
}

if (issues.length > 0) {
  console.error(issues.join('\n'));
  process.exit(1);
}

console.log('Markdown emphasis checks passed.');
