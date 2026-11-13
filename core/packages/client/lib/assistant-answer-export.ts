import type {AssistantAnswer} from '@cuberoot/shared/site-assistant';
import { assistantAnswerText } from '@cuberoot/shared/site-assistant';
export { assistantAnswerText, assistantAnswerHistory, assistantSpokenText } from '@cuberoot/shared/site-assistant';

export async function downloadAssistantPdf(question: string, result: AssistantAnswer, lang: 'zh' | 'en' = 'zh', createdAt?: number) {
  const [{assistantPdfDocument}, {buildDocumentPdf, documentExportFilename, saveBlob}] = await Promise.all([
    import('@/lib/assistant-pdf'), import('@/lib/document-export'),
  ]);
  const document = await assistantPdfDocument(question, assistantAnswerText({...result, artifacts:[]}, window.location.origin), lang, result.artifacts);
  const date = createdAt ? new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {dateStyle:'medium', timeStyle:'short'}).format(createdAt) : '';
  const blob = await buildDocumentPdf(question || 'CubeRoot', document, {brand:true, subtitle:[lang === 'zh' ? '对话记录' : 'Conversation', date].filter(Boolean).join(' · ')});
  saveBlob(blob, documentExportFilename(question || 'CubeRoot', 'pdf'));
}
