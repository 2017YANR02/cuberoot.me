import type {AssistantArtifact} from '@cuberoot/shared/site-assistant';
import {assistantPdfDocument as createDocument} from '@cuberoot/shared/assistant-pdf';
import type {RichTextNode} from '@cuberoot/shared/document-export';

export async function assistantPdfDocument(question:string,answer:string,lang:'zh'|'en',artifacts:AssistantArtifact[]=[]):Promise<RichTextNode> {
  const {algCaseSvg}=await import('./alg_pdf/case_svg');
  return createDocument(question,answer,lang,artifacts,algCaseSvg);
}
