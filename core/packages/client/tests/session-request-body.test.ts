import { describe, expect, it, vi } from 'vitest';
import { readSessionJson } from '../lib/session-request-body';

function streamedRequest(chunks: string[], cancel = vi.fn(), headers: Record<string, string> = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk === undefined) controller.close();
      else controller.enqueue(encoder.encode(chunk));
    }, cancel,
  });
  return new Request('https://example.com/api/web-session', { method: 'POST', body, headers, duplex: 'half' } as RequestInit);
}

describe('bounded session JSON request reader', () => {
  it('accepts chunked JSON at the byte limit', async () => {
    await expect(readSessionJson(streamedRequest(['{"a":', '"中"}']), 11)).resolves.toEqual({ a: '中' });
  });

  it('cancels oversized chunked UTF-8 bodies before reading the remaining input', async () => {
    const cancel = vi.fn();
    const chunks = ['{"a":"', '中'.repeat(10), 'ignored tail'];
    await expect(readSessionJson(streamedRequest(chunks, cancel), 20)).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('does not trust a falsely small declared content length', async () => {
    await expect(readSessionJson(streamedRequest(['{"a":"too long"}'], vi.fn(), { 'Content-Length': '1' }), 5))
      .rejects.toMatchObject({ status: 413 });
  });

  it('rejects declared oversized bodies and invalid JSON distinctly', async () => {
    await expect(readSessionJson(streamedRequest(['{}'], vi.fn(), { 'Content-Length': '999' }), 5))
      .rejects.toMatchObject({ status: 413 });
    await expect(readSessionJson(streamedRequest(['{']), 5)).rejects.toMatchObject({ status: 400 });
  });
});
