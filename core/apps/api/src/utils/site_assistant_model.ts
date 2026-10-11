import { generateText, streamText, Output, tool, type ModelMessage, type ToolSet } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import type { AssistantImage, AssistantMessage } from '@cuberoot/shared/site-assistant';
import { toolCallSchema } from './site_assistant_tools.js';
import { AssistantFailure, checkAssistantResponse } from './site_assistant_diagnostics.js';
import type { AssistantConfig } from './site_assistant.js';

const answerSchema = z.object({ answer: z.string().max(6000), sourceIds: z.array(z.string()).max(100) });

/** One provider conversation per HTTP request. Reasoning stays here, never in UI/logs. */
export function createAssistantModel(config: AssistantConfig, fetcher: typeof fetch, signal: AbortSignal, guide: string, history: AssistantMessage[] = [], images: AssistantImage[] = []) {
  const deepseek = new URL(config.baseUrl).origin === 'https://api.deepseek.com';
  const boundedFetch: typeof fetch = async (input, init) => {
    const response = await fetcher(input, { ...init, signal, redirect: 'error' });
    checkAssistantResponse(response, 'model');
    if (!response.body) throw new AssistantFailure('model_unavailable');
    let bytes = 0;
    return new Response(response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytes += chunk.byteLength;
        if (bytes > 8_000_000) throw new AssistantFailure('model_unavailable');
        controller.enqueue(chunk);
      },
    })), { status: response.status, headers: response.headers });
  };
  const model = deepseek
    ? createDeepSeek({ apiKey: config.key, baseURL: config.baseUrl, fetch: boundedFetch })(config.model)
    : createOpenAICompatible({ name: 'bailian', apiKey: config.key, baseURL: config.baseUrl, fetch: boundedFetch })(config.model);
  const tools: ToolSet = {};
  for (const schema of toolCallSchema.options) {
    const name = schema.shape.tool.value;
    // Derive the provider contract from the same schema used at the data boundary.
    // Business refinements are rechecked by the executor, never removed there.
    tools[name] = tool({
      description: guide.split('\n').find(line => line.startsWith(name + ' ')) ?? name,
      inputSchema: z.strictObject(schema.shape).omit({ tool: true }),
    });
  }
  // Binary image parts go through the provider's multimodal API, never JSON text,
  // logs, public uploads or the knowledge index. Preserve the original turn order.
  const imageParts = (items: AssistantImage[]) => items.map(image => ({
    type: 'file' as const, data: image.data, mediaType: image.mediaType,
  }));
  const visualHistory: ModelMessage[] = images.length || history.some(message => message.images?.length)
    ? history.map(message => message.role === 'user'
      ? { role: 'user', content: [{ type: 'text', text: message.content }, ...imageParts(message.images ?? [])] }
      : { role: 'assistant', content: message.content }) : [];
  const transcript: ModelMessage[] = [];
  let pending: Array<{ raw: object; id: string; name: string; result?: unknown }> = [];
  return {
    record(raw: unknown, result: unknown) {
      const call = pending.find(item => item.raw === raw);
      if (call) call.result = result;
    },
    async complete(options: {
      system: string; context: unknown; finalOnly: boolean; thinking: boolean;
      effort: 'low' | 'high'; maxTokens: number; onText?: (text: string) => Promise<void>;
      followUp?: string;
    }) {
      if (pending.length) {
        transcript.push({ role: 'tool', content: pending.map(call => ({
          type: 'tool-result' as const, toolCallId: call.id, toolName: call.name,
          output: { type: 'json' as const, value: JSON.parse(JSON.stringify(call.result ?? { error: 'Not executed within the request budget. Use the available evidence.' })) },
        })) });
        pending = [];
      }
      if(options.followUp) transcript.push({role:'user',content:options.followUp});
      const request = {
        model, tools, toolChoice: options.finalOnly ? 'none' as const : 'auto' as const,
        system: options.system + '\nAll prose and presentation instructions apply inside the answer string. The final response must be one JSON object with answer and sourceIds, without Markdown fences or text outside that object.',
        messages: [...visualHistory, { role: 'user' as const, content: images.length ? [{ type: 'text' as const, text: JSON.stringify(options.context) }, ...imageParts(images)] : JSON.stringify(options.context) }, ...transcript],
        ...(deepseek ? { output: Output.object({schema:answerSchema}) } : {}),
        maxOutputTokens: options.maxTokens, maxRetries: 0, abortSignal: signal,
        ...(options.thinking ? {} : { temperature: 0 }),
        providerOptions: { [deepseek ? 'deepseek' : 'bailian']: deepseek
          ? { thinking: { type: options.thinking ? 'enabled' : 'disabled' }, ...(options.thinking ? { reasoningEffort: options.effort } : {}) }
          // Keep JSON mode on the wire, then validate the compatible response
          // below. SDK eager JSON parsing cannot handle the provider's fences.
          : { enable_thinking: false, response_format: { type: 'json_object' } } },
      };
      const response = options.onText ? streamText(request) : generateText(request);
      let result;
      if ('fullStream' in response) {
        let content = '';
        for await (const part of response.fullStream) {
          signal.throwIfAborted();
          if (part.type === 'error') throw part.error;
          if (part.type === 'text-delta') {
            content += part.text;
            if (content.length > 64000) throw new AssistantFailure('model_unavailable');
            await options.onText?.(content);
          }
        }
        result = { toolCalls: await response.toolCalls, text: await response.text, finishReason: await response.finishReason, response: await response.response };
      } else result = await response;
      if (result.finishReason === 'length') throw new Error('Incomplete model output');
      if (result.toolCalls.length) {
        const calls = result.toolCalls.map(call => ({ ...call.input as object, tool: call.toolName }));
        transcript.push(...result.response.messages);
        pending = result.toolCalls.map((call, index) => ({ raw: calls[index], id: call.toolCallId, name: call.toolName }));
        return { calls, answer: '', sourceIds: [] as string[] };
      }
      // Retain even a malformed final response so the bounded repair is a new
      // user turn, with the provider's reasoning preserved in its own transcript.
      transcript.push(...result.response.messages);
      // Some compatible vision endpoints append a Markdown fence even in JSON
      // mode. Accept only that wrapper; arbitrary prose or invalid fields still
      // fail the same schema and enter the existing bounded repair turn.
      const json = result.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const final = answerSchema.parse(JSON.parse(json));
      return { calls: [] as unknown[], ...final };
    },
  };
}
