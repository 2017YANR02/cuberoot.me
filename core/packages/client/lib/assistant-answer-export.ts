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

export async function downloadAssistantPdf(question: string, result: AssistantAnswer, lang: 'zh' | 'en' = 'zh', createdAt?: number) {
  const [{assistantPdfDocument}, {buildDocumentPdf, documentExportFilename, saveBlob}] = await Promise.all([
    import('@/lib/assistant-pdf'), import('@/lib/document-export'),
  ]);
  const document = await assistantPdfDocument(question, assistantAnswerText({...result, artifacts:[]}, window.location.origin), lang, result.artifacts);
  const date = createdAt ? new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {dateStyle:'medium', timeStyle:'short'}).format(createdAt) : '';
  const blob = await buildDocumentPdf(question || 'CubeRoot', document, {brand:true, subtitle:[lang === 'zh' ? '对话记录' : 'Conversation', date].filter(Boolean).join(' · ')});
  saveBlob(blob, documentExportFilename(question || 'CubeRoot', 'pdf'));
}
