import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDriveShare,
  downloadDriveFile,
  revokeDriveShare,
  uploadDriveChunk,
} from '@/lib/drive-api';

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

describe('Drive streaming download', () => {
  it('writes response chunks directly to the destination and reports downloaded bytes', async () => {
    const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
    }))));
    const sink = {
      write: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      abort: vi.fn(async () => {}),
    };
    const onProgress = vi.fn();

    await expect(downloadDriveFile('https://api.cuberoot.me/file', 5, sink, { onProgress })).resolves.toBe(5);
    expect(sink.write).toHaveBeenCalledTimes(2);
    expect(sink.close).toHaveBeenCalledOnce();
    expect(sink.abort).not.toHaveBeenCalled();
    expect(onProgress.mock.calls.map(([bytes]) => bytes)).toEqual([2, 5]);
  });

  it('aborts the destination when the response ends before the expected size', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2]))));
    const sink = {
      write: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      abort: vi.fn(async () => {}),
    };

    await expect(downloadDriveFile('https://api.cuberoot.me/file', 3, sink)).rejects.toThrow('before the expected file size');
    expect(sink.close).not.toHaveBeenCalled();
    expect(sink.abort).toHaveBeenCalledOnce();
  });

  it('resumes with a byte range and keeps a valid partial file after interruption', async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([3, 4]), { status: 206 }));
    vi.stubGlobal('fetch', fetchMock);
    const sink = {
      write: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      abort: vi.fn(async () => {}),
    };

    await expect(downloadDriveFile('https://api.cuberoot.me/file', 5, sink, {
      offset: 2,
      keepPartialOnError: () => true,
    })).rejects.toThrow('before the expected file size');
    expect(fetchMock).toHaveBeenCalledWith('https://api.cuberoot.me/file', expect.objectContaining({
      headers: { Range: 'bytes=2-' },
    }));
    expect(sink.close).toHaveBeenCalledOnce();
    expect(sink.abort).not.toHaveBeenCalled();
  });

  it('completes a resumed byte-range download from the existing offset', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([3, 4, 5]), { status: 206 })));
    const sink = {
      write: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      abort: vi.fn(async () => {}),
    };
    const onProgress = vi.fn();

    await expect(downloadDriveFile('https://api.cuberoot.me/file', 5, sink, {
      offset: 2,
      onProgress,
    })).resolves.toBe(5);
    expect(onProgress).toHaveBeenLastCalledWith(5);
    expect(sink.close).toHaveBeenCalledOnce();
    expect(sink.abort).not.toHaveBeenCalled();
  });
});

describe('Drive sharing', () => {
  it('turns an opaque share id into a canonical copyable download URL', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'share-id' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createDriveShare('file/id')).resolves.toEqual({
      url: 'https://api.cuberoot.me/v1/drive/shared/share-id',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cuberoot.me/v1/drive/files/file%2Fid/share',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('revokes the same file share without requiring a request body', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(revokeDriveShare('file/id')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cuberoot.me/v1/drive/files/file%2Fid/share',
      expect.objectContaining({ method: 'DELETE', body: undefined }),
    );
  });
});
