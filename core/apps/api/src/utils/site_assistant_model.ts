import { generateText, streamText, Output, tool, type ModelMessage, type ToolSet } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import { toolCallSchema } from './site_assistant_tools.js';
import { AssistantFailure, checkAssistantResponse } from './site_assistant_diagnostics.js';
import type { AssistantConfig } from './site_assistant.js';

const answerSchema = z.object({ answer: z.string().max(6000), sourceIds: z.array(z.string()).max(100) });

/** One provider conversation per HTTP request. Reasoning stays here, never in UI/logs. */
export function createAssistantModel(config: AssistantConfig, fetcher: typeof fetch, signal: AbortSignal, guide: string) {
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
    }) {
      if (pending.length) {
        transcript.push({ role: 'tool', content: pending.map(call => ({
          type: 'tool-result' as const, toolCallId: call.id, toolName: call.name,
          output: { type: 'json' as const, value: JSON.parse(JSON.stringify(call.result ?? { error: 'Not executed within the request budget. Use the available evidence.' })) },
        })) });
        pending = [];
      }
      const request = {
        model, tools, toolChoice: options.finalOnly ? 'none' as const : 'auto' as const,
        system: options.system,
        messages: [{ role: 'user' as const, content: JSON.stringify(options.context) }, ...transcript],
        output: Output.json(),
        maxOutputTokens: options.maxTokens, maxRetries: 0, abortSignal: signal,
        ...(options.thinking ? {} : { temperature: 0 }),
        providerOptions: { [deepseek ? 'deepseek' : 'bailian']: deepseek
          ? { thinking: { type: options.thinking ? 'enabled' : 'disabled' }, ...(options.thinking ? { reasoningEffort: options.effort } : {}) }
          : { enable_thinking: false } },
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
      const final = answerSchema.parse(JSON.parse(result.text));
      transcript.push(...result.response.messages);
      return { calls: [] as unknown[], ...final };
    },
  };
}
