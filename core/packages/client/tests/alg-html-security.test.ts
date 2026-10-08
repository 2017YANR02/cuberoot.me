import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import { algHtmlText, sanitizeAlgHtml } from '@/lib/alg_html';
import { displayCaseAlgHtml } from '@/lib/alg_display';

describe('algorithm markup at the stored-content rendering boundary', () => {
  it.each([
    'R U <<x>img src=x onerror=alert(1)>',
    'R <u onclick="alert(1)" class="wavy other">U</u><svg onload="alert(1)"></svg>',
    'R <script>alert(1)</script><iframe srcdoc="<script>alert(1)</script>"></iframe> U',
    '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">',
  ])('never creates executable elements or attributes from %s', input => {
    const html = sanitizeAlgHtml(displayCaseAlgHtml('3x3', 'pll', input));
    const { document } = parseHTML(`<html><body>${html}</body></html>`);
    const allowed = new Set(['U', 'S', 'EM', 'STRONG', 'SUB', 'SUP']);
    for (const element of document.body.querySelectorAll('*')) {
      expect(allowed.has(element.tagName)).toBe(true);
      for (const attribute of element.attributes) {
        expect([element.tagName, attribute.name, attribute.value]).toEqual(['U', 'class', 'wavy']);
      }
    }
    expect(sanitizeAlgHtml(html)).toBe(html);
  });

  it('preserves every supported finger annotation without changing moves', () => {
    const html = `<u>U'</u> <u class="wavy">R</u> <s>M</s> <em>D</em> <strong>F</strong><sub>2</sub><sup>'</sup>`;
    expect(sanitizeAlgHtml(html)).toBe(html);
    expect(algHtmlText(html)).toBe("U' R M D F2'");
    expect(algHtmlText('&lt;u&gt;R&lt;/u&gt; &amp; &#39; &#x2191;')).toBe("<u>R</u> & ' ↑");
  });
});
