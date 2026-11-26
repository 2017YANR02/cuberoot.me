// Run with TeX Live, LaTeXML and Python 3.11+ on PATH to regenerate all three site editions.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function renderPaper(paperDir: URL, slug: string) {
  const root = new URL('../../../../', paperDir);
  const scratch = fileURLToPath(new URL('.tmp/scratch/', root));
  mkdirSync(scratch, { recursive: true });
  const work = mkdtempSync(join(scratch, 'cubing-paper-html-'));
  const tex = fileURLToPath(new URL('main.tex', paperDir));
  execFileSync('latexmlc', [
    '--format=html5', '--pmml', '--nodefaultresources', '--strict',
    '--log=conversion.log', '--dest=paper.html', tex,
  ], { cwd: work, stdio: 'inherit' });

  const document = readFileSync(join(work, 'paper.html'), 'utf8');
  const article = document.match(/<article\b[^>]*>([\s\S]*?)<\/article>/)?.[1];
  if (!article) throw new Error('LaTeXML did not generate an article');
  const sections = Array.from(article.matchAll(/<section id="([^"]+)"[^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>/g),
    ([, id, heading]) => ({ id, title: heading.replace(/<[^>]*>/g, '').trim() }));
  const html = article.trim()
    .replace(/<br class="ltx_break">/g, ' ')
    .replace(/<h6([^>]*)>([\s\S]*?)<\/h6>/g, (_, attrs: string, heading: string) => {
      const tag = attrs.includes('ltx_title_abstract') ? 'h2' : attrs.includes('ltx_title_theorem') ? 'h3' : 'strong';
      return '<' + tag + attrs + '>' + heading + '</' + tag + '>';
    });
  if (!sections.length || !html.includes('<math') || /<script\b|<iframe\b|\son\w+=/i.test(html)) {
    throw new Error('Unexpected markup in the paper');
  }
  const output = new URL('core/packages/client/app/[lang]/math/cubing-lean/papers/' + slug + '/manuscript.json', root);
  for (let pass = 0; pass < 3; pass++) {
    execFileSync('pdflatex', ['-halt-on-error', '-no-shell-escape', '-interaction=batchmode', tex], { cwd: work });
  }
  const log = readFileSync(join(work, 'main.log'), 'utf8');
  if (/undefined references|undefined citations|Missing character|Overfull \\[hv]box/i.test(log)) {
    throw new Error('Review the PDF compiler log at ' + join(work, 'main.log'));
  }
  const zip = join(work, 'source.zip');
  execFileSync('python3', [fileURLToPath(new URL('package.py', paperDir)), zip]);
  for (const dir of ['core/packages/client/public/papers/cubing-lean/', 'output/pdf/']) {
    mkdirSync(new URL(dir, root), { recursive: true });
    copyFileSync(join(work, 'main.pdf'), new URL(dir + slug + '.pdf', root));
    copyFileSync(zip, new URL(dir + slug + '-source.zip', root));
  }
  writeFileSync(output, JSON.stringify({ sections, html }, null, 2) + '\n');
}
