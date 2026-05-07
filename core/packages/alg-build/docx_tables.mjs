/**
 * Minimal docx → HTML table converter that preserves underline subtypes
 * (single / double / wave) which mammoth flattens to <u>.
 *
 * Reads word/document.xml, walks <w:tbl> elements, and emits HTML <table>
 * with <p> and inline run formatting:
 *   <w:b>      → <strong>
 *   <w:i>      → <em>
 *   <w:strike> → <s>
 *   <w:u val="single|double"> → <u>
 *   <w:u val="wave|wavy">     → <u class="wavy">
 *   <w:vertAlign val="superscript"> → <sup>
 *   <w:vertAlign val="subscript">   → <sub>
 *
 * Drawings / images / shapes / breaks: ignored (we only need text formatting).
 */
import { readFileSync } from 'node:fs';
import * as fflate from 'fflate';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
  textNodeName: '#text',
});

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Walk parsed children (preserveOrder array) and call cb(tagName, node). */
function* iter(nodes, tagFilter = null) {
  if (!Array.isArray(nodes)) return;
  for (const n of nodes) {
    const keys = Object.keys(n).filter(k => !k.startsWith('@') && k !== '#text');
    for (const k of keys) {
      if (!tagFilter || k === tagFilter) yield [k, n];
    }
  }
}

function findChild(node, tagName) {
  // node is one element of the preserveOrder array
  const children = node[Object.keys(node).find(k => !k.startsWith('@') && k !== '#text')];
  if (!Array.isArray(children)) return null;
  for (const c of children) {
    if (Object.prototype.hasOwnProperty.call(c, tagName)) return c;
  }
  return null;
}

/** Get the children array under the given tag for this node. */
function childrenOf(node, tagName) {
  const arr = node[tagName];
  return Array.isArray(arr) ? arr : [];
}

/** Run formatting → wrap inner with proper tags, in stable order: u/s/em/strong/sub/sup. */
function wrapRunInner(inner, fmt) {
  if (!inner) return '';
  let s = inner;
  // innermost first; emit outer tags last
  if (fmt.b) s = `<strong>${s}</strong>`;
  if (fmt.i) s = `<em>${s}</em>`;
  if (fmt.strike) s = `<s>${s}</s>`;
  if (fmt.uType) {
    const cls = fmt.uType === 'wave' || fmt.uType === 'wavy' ? ' class="wavy"' : '';
    s = `<u${cls}>${s}</u>`;
  }
  if (fmt.vertAlign === 'superscript') s = `<sup>${s}</sup>`;
  if (fmt.vertAlign === 'subscript')   s = `<sub>${s}</sub>`;
  return s;
}

/** Extract formatting flags from <w:rPr> children array. */
function readRunPr(rPrChildren) {
  const fmt = { b: false, i: false, strike: false, uType: null, vertAlign: null };
  if (!Array.isArray(rPrChildren)) return fmt;
  for (const c of rPrChildren) {
    if ('w:b' in c) {
      const v = c[':@']?.['@w:val'];
      // <w:b/> or <w:b w:val="1"/> or <w:b w:val="true"/> = on; "0" / "false" = off
      fmt.b = v === undefined || v === '1' || v === 'true' || v === 'on';
    } else if ('w:i' in c) {
      const v = c[':@']?.['@w:val'];
      fmt.i = v === undefined || v === '1' || v === 'true' || v === 'on';
    } else if ('w:strike' in c) {
      const v = c[':@']?.['@w:val'];
      fmt.strike = v === undefined || v === '1' || v === 'true' || v === 'on';
    } else if ('w:u' in c) {
      const v = c[':@']?.['@w:val'];
      // val undefined defaults to "single"; "none" means turn off
      if (v === 'none') fmt.uType = null;
      else fmt.uType = v || 'single';
    } else if ('w:vertAlign' in c) {
      const v = c[':@']?.['@w:val'];
      if (v === 'superscript' || v === 'subscript') fmt.vertAlign = v;
    }
  }
  return fmt;
}

/** Render a <w:r> node (children array) to HTML markup. */
function renderRun(rChildren) {
  if (!Array.isArray(rChildren)) return '';
  let fmt = { b: false, i: false, strike: false, uType: null, vertAlign: null };
  let textParts = [];
  for (const c of rChildren) {
    if ('w:rPr' in c) fmt = readRunPr(c['w:rPr']);
    else if ('w:t' in c) {
      // w:t children: array containing one #text node
      const tChildren = c['w:t'];
      if (Array.isArray(tChildren)) {
        for (const tc of tChildren) {
          if ('#text' in tc) textParts.push(tc['#text']);
        }
      }
    } else if ('w:tab' in c) textParts.push('\t');
    else if ('w:br' in c) textParts.push('\n');
    else if ('w:noBreakHyphen' in c) textParts.push('-');
  }
  const text = textParts.join('');
  if (!text) return '';
  return wrapRunInner(escapeHtml(text), fmt);
}

/** Render <w:p> children (paragraph children) → markup string ending with \n. */
function renderParagraph(pChildren) {
  if (!Array.isArray(pChildren)) return '<p></p>';
  const parts = [];
  for (const c of pChildren) {
    if ('w:r' in c) parts.push(renderRun(c['w:r']));
    else if ('w:hyperlink' in c) {
      // hyperlink wraps runs; just flatten
      const hl = c['w:hyperlink'];
      if (Array.isArray(hl)) {
        for (const hc of hl) {
          if ('w:r' in hc) parts.push(renderRun(hc['w:r']));
        }
      }
    }
  }
  return `<p>${parts.join('')}</p>`;
}

/** Render <w:tc> children → <td>...</td> */
function renderCell(tcChildren) {
  if (!Array.isArray(tcChildren)) return '<td></td>';
  // Find tcPr for gridSpan (colspan)
  let colspan = 1;
  const ps = [];
  for (const c of tcChildren) {
    if ('w:tcPr' in c) {
      const tcPr = c['w:tcPr'];
      if (Array.isArray(tcPr)) {
        for (const x of tcPr) {
          if ('w:gridSpan' in x) {
            const v = parseInt(x[':@']?.['@w:val'] || '1', 10);
            if (v > 1) colspan = v;
          }
        }
      }
    } else if ('w:p' in c) {
      ps.push(renderParagraph(c['w:p']));
    }
  }
  const attr = colspan > 1 ? ` colspan="${colspan}"` : '';
  return `<td${attr}>${ps.join('')}</td>`;
}

/** Render <w:tr> children → <tr>...</tr> */
function renderRow(trChildren) {
  if (!Array.isArray(trChildren)) return '<tr></tr>';
  const tds = [];
  for (const c of trChildren) {
    if ('w:tc' in c) tds.push(renderCell(c['w:tc']));
  }
  return `<tr>${tds.join('')}</tr>`;
}

/** Render <w:tbl> children → <table>...</table> */
function renderTable(tblChildren) {
  if (!Array.isArray(tblChildren)) return '<table></table>';
  const trs = [];
  for (const c of tblChildren) {
    if ('w:tr' in c) trs.push(renderRow(c['w:tr']));
  }
  return `<table>${trs.join('')}</table>`;
}

/** Top-level: convert docx file → HTML containing only the tables (concatenated). */
export function docxToTablesHtml(docxPath) {
  const buf = readFileSync(docxPath);
  const unzipped = fflate.unzipSync(new Uint8Array(buf));
  const docXml = new TextDecoder().decode(unzipped['word/document.xml']);
  const parsed = parser.parse(docXml);

  // Walk to find all <w:tbl>; preserveOrder gives nested arrays.
  const tables = [];
  function walk(nodes) {
    if (!Array.isArray(nodes)) return;
    for (const n of nodes) {
      for (const k of Object.keys(n)) {
        if (k.startsWith('@') || k === '#text' || k === ':@') continue;
        if (k === 'w:tbl') {
          tables.push(renderTable(n[k]));
        } else if (Array.isArray(n[k])) {
          walk(n[k]);
        }
      }
    }
  }
  walk(parsed);

  return tables.join('\n');
}
