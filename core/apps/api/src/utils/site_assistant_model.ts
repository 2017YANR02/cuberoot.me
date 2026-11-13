import { generateText, streamText, Output, NoObjectGeneratedError, tool, type ModelMessage, type ToolSet } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import { SITE_ASSISTANT_ANSWER_MAX_LENGTH, boundAssistantHistory, type AssistantImage, type AssistantMessage } from '@cuberoot/shared/site-assistant';
import { toolCallSchema } from './site_assistant_tools.js';
import { AssistantFailure, checkAssistantResponse, type AssistantModelDiagnostic } from './site_assistant_diagnostics.js';
import type { AssistantConfig } from './site_assistant.js';
import { recordAssistantModel } from './site_assistant_monitor.js';

const answerSchema = z.object({ imageTask: z.enum(['cube-state', 'other']).optional(), answerKind: z.enum(['general','site_content','grounded','image']).optional(), answer: z.string().max(SITE_ASSISTANT_ANSWER_MAX_LENGTH).refine(value => !!value.trim()), sourceIds: z.array(z.string()).max(100), reviewedSourceIds: z.array(z.string()).max(12).optional() });

/** A completed but malformed answer needs format repair, not another tool plan. */
export class AssistantOutputError extends AssistantFailure {
  constructor(reason: 'empty_output' | 'invalid_json' | 'invalid_schema' | 'output_truncated' | 'unexpected_tool_call', finishReason?: string, issues?: AssistantModelDiagnostic['issues']) {
    super('model_output_invalid', undefined, { reason, finishReason, issues });
    this.message = reason === 'output_truncated' ? 'Incomplete model output' : 'Invalid assistant answer format';
  }
  repairInstruction() {
    const issues = this.diagnostic?.issues?.map(issue => `${issue.path}: ${issue.code}`).join('; ');
    return `The previous answer failed validation (${this.diagnostic!.reason}${issues ? `; ${issues}` : ''}). Return one complete JSON object with answerKind, answer (a non-empty plain string), sourceIds (an array of source ID strings), and reviewedSourceIds (an array of at most 12 reviewed source ID strings when reviewing analysis). Do not call tools. Preserve verified evidence and do not invent sources. Example shape only: {"answerKind":"general","answer":"A complete answer.","sourceIds":[]}.`;
  }
}

function parseAssistantAnswer(text: string, finishReason?: string) {
  if (finishReason === 'length') throw new AssistantOutputError('output_truncated', finishReason);
  // Compatible endpoints sometimes include a Markdown fence in JSON mode.
  const json = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (!json.trim()) throw new AssistantOutputError('empty_output', finishReason);
  let parsed: unknown;
  try { parsed = JSON.parse(json); }
  catch { throw new AssistantOutputError('invalid_json', finishReason); }
  const final = answerSchema.safeParse(parsed);
  if (!final.success) {
    // Only schema-owned keys/array positions, never values or Zod messages.
    const issues = final.error.issues.slice(0, 8).map(issue => ({
      path: issue.path.map(part => typeof part === 'number' ? '[]' : Object.hasOwn(answerSchema.shape, String(part)) ? String(part) : '?').join('.') || '$',
      code: issue.code,
    }));
    throw new AssistantOutputError('invalid_schema', finishReason, issues);
  }
  return final.data;
}

/** One provider conversation per HTTP request. Reasoning stays here, never in UI/logs. */
export function createAssistantModel(config: AssistantConfig, fetcher: typeof fetch, signal: AbortSignal, guide: string, history: AssistantMessage[] = [], images: AssistantImage[] = []) {
  const deepseek = new URL(config.baseUrl).origin === 'https://api.deepseek.com';
  const origin = new URL(config.baseUrl).origin;
  // This compatibility mode is verified for the configured text model only.
  const nativeQwenTools = /^https:\/\/(?:dashscope\.aliyuncs\.com|ws-[a-z0-9]+\.cn-beijing\.maas\.aliyuncs\.com)$/.test(origin)
    && config.model === 'qwen-plus' && !images.length && !history.some(message=>message.images?.length);
  const qwenThinking = /^https:\/\/(?:dashscope\.aliyuncs\.com|ws-[a-z0-9]+\.cn-beijing\.maas\.aliyuncs\.com)$/.test(origin)
    && /^qwen3\.8-(?:flash|plus|max)(?:-|$)/.test(config.model);
  const boundedFetch: typeof fetch = async (input, init) => {
    let response: Response;
    try { response = await fetcher(input, { ...init, signal, redirect: 'error' }); }
    catch (error) {
      signal.throwIfAborted();
      if (error instanceof TypeError || (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))) {
        throw new AssistantFailure('model_unavailable', undefined, { reason: 'network_error' });
      }
      throw error;
    }
    checkAssistantResponse(response, 'model');
    if (!response.body) throw new AssistantFailure('model_unavailable', undefined, { reason: 'empty_body' });
    let bytes = 0;
    const reader = response.body.getReader();
    return new Response(new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) { controller.close(); reader.releaseLock(); return; }
          bytes += value.byteLength;
          if (bytes > 8_000_000) throw new AssistantFailure('model_unavailable', undefined, { reason: 'response_too_large' });
          controller.enqueue(value);
        } catch (error) {
          controller.error(signal.aborted ? signal.reason : error instanceof AssistantFailure ? error
            : new AssistantFailure('model_unavailable', undefined, { reason: 'network_error' }));
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
      },
      async cancel(reason) { try { await reader.cancel(reason); } finally { reader.releaseLock(); } },
    }), { status: response.status, headers: response.headers });
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
  const conversation: ModelMessage[] = boundAssistantHistory(history).map(message => message.role === 'user'
    ? { role: 'user', content: message.images?.length ? [{ type: 'text', text: message.content }, ...imageParts(message.images)] : message.content }
    : { role: 'assistant', content: message.content });
  const transcript: ModelMessage[] = [];
  let pending: Array<{ raw: object; id: string; name: string; result?: unknown }> = [];
  return {
    record(raw: unknown, result: unknown) {
      const call = pending.find(item => item.raw === raw);
      if (call) call.result = result;
      return !!call;
    },
    async complete(options: {
      system: string; context: unknown; finalOnly: boolean; thinking: boolean;
      effort: 'low' | 'high'; maxTokens: number; onText?: (text: string) => Promise<void>;
      followUp?: string;
      requiredTool?: 'lookup_cube_photo';
      unavailableTools?: string[];
      allowTools?: boolean; requireStructuredAnswer?: boolean; isolated?: boolean;
      round?: number; attempt?: number;
    }) {
      const thinking = options.thinking && (deepseek || qwenThinking);
      const allowTools = options.allowTools ?? !options.finalOnly;
      const structured = options.requireStructuredAnswer ?? !allowTools;
      if (pending.length) {
        transcript.push({ role: 'tool', content: pending.map(call => ({
          type: 'tool-result' as const, toolCallId: call.id, toolName: call.name,
          output: { type: 'json' as const, value: JSON.parse(JSON.stringify(call.result ?? { error: 'Not executed within the request budget. Use the available evidence.' })) },
        })) });
        pending = [];
      }
      if(options.followUp) transcript.push({role:'user',content:options.followUp});
      const request = {
        model, tools: !allowTools ? undefined : options.unavailableTools?.length
          ? Object.fromEntries(Object.entries(tools).filter(([name])=>!options.unavailableTools!.includes(name))) : tools,
        toolChoice: !allowTools ? 'none' as const
          : options.requiredTool ? { type: 'tool' as const, toolName: options.requiredTool } : 'auto' as const,
        system: options.system + '\nAll prose and presentation instructions apply inside the answer string. The final response must be one JSON object with answer and sourceIds, without Markdown fences or text outside that object.',
        messages: [...(options.isolated ? conversation.filter(message=>message.role==='user') : conversation), { role: 'user' as const, content: images.length ? [{ type: 'text' as const, text: JSON.stringify(options.context) }, ...imageParts(images)] : JSON.stringify(options.context) }, ...(options.isolated ? options.followUp ? [{role:'user' as const,content:options.followUp}] : [] : transcript)],
        ...(deepseek ? { output: Output.object({schema:answerSchema}) } : {}),
        maxOutputTokens: thinking ? options.maxTokens : Math.min(options.maxTokens, 4096), maxRetries: 0, abortSignal: signal,
        ...(thinking ? {} : { temperature: 0 }),
        providerOptions: { [deepseek ? 'deepseek' : 'bailian']: deepseek
          ? { thinking: { type: thinking ? 'enabled' : 'disabled' }, ...(thinking ? { reasoningEffort: options.effort } : {}) }
          // Keep JSON mode on the wire, then validate the compatible response
          // below. SDK eager JSON parsing cannot handle the provider's fences.
          : { enable_thinking: thinking, ...(!nativeQwenTools || structured ? { response_format: { type: 'json_object' } } : {}), ...(qwenThinking ? { preserve_thinking: false, ...(thinking ? { thinking_budget: 4096, max_completion_tokens: 8192 } : {}) } : {}) } },
      };
      const recordUsage = recordAssistantModel(config.model, thinking, origin, { round: options.round, attempt: options.attempt });
      try {
        const response = options.onText ? streamText(request) : generateText(request);
        let result;
        if ('fullStream' in response) {
          let content = '';
          for await (const part of response.fullStream) {
            signal.throwIfAborted();
            recordUsage.chunk(part.type);
            if (part.type === 'error') throw part.error;
            if (part.type === 'text-delta') {
              content += part.text;
              if (content.length > 64000) throw new AssistantFailure('model_unavailable', undefined, { reason: 'response_too_large' });
              await options.onText?.(content);
            }
          }
          result = { toolCalls: await response.toolCalls, text: await response.text, finishReason: await response.finishReason, response: await response.response, totalUsage: await response.totalUsage };
        } else result = await response;
        recordUsage(result.totalUsage);
        if (result.finishReason === 'length') throw new AssistantOutputError('output_truncated', result.finishReason);
        if (result.toolCalls.length) {
          if (!allowTools) throw new AssistantOutputError('unexpected_tool_call', result.finishReason);
          const calls = result.toolCalls.map(call => ({ ...call.input as object, tool: call.toolName }));
          // The SDK already supplies error results for invalid tool inputs. Our
          // executor reports these calls too, so retain the native assistant and
          // reasoning but let pending own each tool result exactly once.
          const callIds = new Set(result.toolCalls.map(call => call.toolCallId));
          for (const message of result.response.messages) {
            if (message.role !== 'tool') { transcript.push(message); continue; }
            const content = message.content.filter(part => part.type !== 'tool-result' || !callIds.has(part.toolCallId));
            if (content.length) transcript.push({ ...message, content });
          }
          pending = result.toolCalls.map((call, index) => ({ raw: calls[index], id: call.toolCallId, name: call.toolName }));
          return { calls, answer: '', sourceIds: [] as string[] };
        }
        // Retain even a malformed final response so the bounded repair is a new
        // user turn, with the provider's reasoning preserved in its own transcript.
        transcript.push(...result.response.messages);
        return { calls: [] as unknown[], ...parseAssistantAnswer(result.text, result.finishReason) };
      } catch (error) {
        // The SDK can wrap a body-read failure in APICallError. Recover only
        // our own classified cause; provider messages/bodies remain private.
        let cause: unknown = error;
        for (let depth = 0; depth < 4 && cause instanceof Error; depth++, cause = cause.cause) {
          if (cause instanceof AssistantFailure) { error = cause; break; }
        }
        // generateText can validate before returning a result. Preserve usage
        // and use the same parser as streaming, without logging SDK error text.
        if (NoObjectGeneratedError.isInstance(error)) {
          recordUsage(error.usage);
          try {
            const final = parseAssistantAnswer(error.text ?? '', error.finishReason);
            transcript.push({ role: 'assistant', content: error.text ?? '' });
            return { calls: [] as unknown[], ...final };
          }
          catch (outputError) { error = outputError; }
        }
        recordUsage(undefined, {
          ...(error instanceof AssistantFailure && error.diagnostic ? error.diagnostic : { reason: signal.aborted ? 'aborted' : 'provider_error' }),
          ...(error instanceof AssistantFailure && error.upstreamStatus !== undefined ? { upstreamStatus: error.upstreamStatus } : {}),
        });
        if (error instanceof AssistantFailure || signal.aborted) throw error;
        throw new AssistantFailure('model_unavailable', undefined, { reason: 'provider_error' });
      }
    },
  };
}
