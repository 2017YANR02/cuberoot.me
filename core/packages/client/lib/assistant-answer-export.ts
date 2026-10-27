import { isAssistantSourceHref, type AssistantAnswer } from '@cuberoot/shared/site-assistant';
import { formatWcaResult } from '@/lib/wca-format-result';

/** Export a single answer, including its citations and structured results. */
export function assistantAnswerText(result: AssistantAnswer, origin: string) {
  const text = result.answer.replace(/\[\[([^\]\n]+)\]\]/g, (_marker, id: string) => {
    const source = result.sources.find(s => s.id === id && isAssistantSourceHref(s.href));
    return source ? `[${source.title}](${new URL(source.href, origin).href})` : '';
  });
  const tables = (result.artifacts ?? []).map(a => a.kind === 'table'
    ? [a.title, a.columns.join('\t'), ...a.rows.map(row => row.join('\t'))].join('\n')
    : [a.title, ...a.points.map(p => `${p.date}\t${formatWcaResult(p.value, a.event, a.metric)}`)].join('\n'));
  return [text, ...tables].join('\n\n');
}

export function assistantSpokenText(text: string) {
  return text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>|]/g, '').trim();
}

export async function downloadAssistantPdf(question: string, answer: string) {
  const [{ jsPDF }, fonts] = await Promise.all([import('jspdf'), import('@/lib/pdf-fonts')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await fonts.loadPdfFonts(doc);
  const text = `${question}\n\n${answer}`;
  if (fonts.hasCjk(text)) await fonts.ensureCjkFont(doc);
  doc.setFont(fonts.hasCjk(text) ? fonts.FONT_CJK : fonts.FONT_SANS);
  doc.setFontSize(11);
  doc.setProperties({ title: question || 'CubeRoot', creator: 'CubeRoot' });
  const lines: string[] = doc.splitTextToSize(text, 174);
  let y = 20;
  for (const line of lines) {
    if (y > 277) { doc.addPage(); y = 20; }
    doc.text(line, 18, y); y += 6;
  }
  doc.save('CubeRoot.pdf');
}
