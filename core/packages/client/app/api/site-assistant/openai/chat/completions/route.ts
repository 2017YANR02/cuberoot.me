import { relayAssistantOpenAI } from '@/lib/assistant-openai-relay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'iad1';
export const maxDuration = 180;

export async function POST(request: Request): Promise<Response> {
  return relayAssistantOpenAI(request, 'chat/completions');
}
