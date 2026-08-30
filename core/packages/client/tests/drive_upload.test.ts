import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadDriveChunk } from '@/lib/drive-api';

class FakeEventTarget {
  private readonly listeners = new Map<string, EventListener[]>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const handler = typeof listener === 'function'
      ? listener
      : listener.handleEvent.bind(listener);
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), handler]);
  }

  emit(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class FakeXMLHttpRequest extends FakeEventTarget {
  static latest: FakeXMLHttpRequest | null = null;

  readonly upload = new FakeEventTarget();
  readonly headers: Record<string, string> = {};
  method = '';
  url = '';
  body: XMLHttpRequestBodyInit | Document | null = null;
  status = 0;
  statusText = '';
  responseText = '';
  aborted = false;

  constructor() {
    super();
    FakeXMLHttpRequest.latest = this;
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  send(body: XMLHttpRequestBodyInit | Document | null): void {
    this.body = body;
  }

  abort(): void {
    this.aborted = true;
    this.emit('abort', {} as Event);
  }

  reportProgress(loaded: number): void {
    this.upload.emit('progress', { loaded } as ProgressEvent);
  }

  succeed(payload: unknown): void {
    this.status = 200;
    this.responseText = JSON.stringify(payload);
    this.emit('load', {} as Event);
  }
}

beforeEach(() => {
  FakeXMLHttpRequest.latest = null;
  vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Drive chunk upload', () => {
  it('reports in-flight bytes while preserving the resumable upload contract', async () => {
    const chunk = new Blob(['abcdef']);
    const onProgress = vi.fn();
    const upload = uploadDriveChunk('upload/id', 8, chunk, undefined, onProgress);

    await vi.waitFor(() => expect(FakeXMLHttpRequest.latest).not.toBeNull());
    const request = FakeXMLHttpRequest.latest!;
    request.reportProgress(3);
    request.succeed({ offset: 14, complete: false });

    await expect(upload).resolves.toEqual({ offset: 14, complete: false });
    expect(onProgress).toHaveBeenCalledWith(3);
    expect(request.method).toBe('PATCH');
    expect(request.url).toBe('https://api.cuberoot.me/v1/drive/uploads/upload%2Fid');
    expect(request.headers['Content-Type']).toBe('application/offset+octet-stream');
    expect(request.headers['Upload-Offset']).toBe('8');
    expect(request.headers['Upload-Checksum']).toMatch(/^sha256 /);
    expect(request.body).toBe(chunk);
  });

  it('aborts the active request when an upload is paused', async () => {
    const controller = new AbortController();
    const upload = uploadDriveChunk('upload-id', 0, new Blob(['abcdef']), controller.signal);

    await vi.waitFor(() => expect(FakeXMLHttpRequest.latest).not.toBeNull());
    const request = FakeXMLHttpRequest.latest!;
    const rejection = expect(upload).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();

    await rejection;
    expect(request.aborted).toBe(true);
  });
});
