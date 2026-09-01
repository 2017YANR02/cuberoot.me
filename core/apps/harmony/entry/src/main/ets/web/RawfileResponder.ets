import { common } from '@kit.AbilityKit';

const APP_PREFIX = 'https://localhost/app/';
const CUBING_WORKER_PREFIX = 'https://localhost/cubing-chunks/';

function mimeType(path: string): string {
  const extension = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
  if (extension === 'html') return 'text/html';
  if (extension === 'js' || extension === 'mjs') return 'application/javascript';
  if (extension === 'css') return 'text/css';
  if (extension === 'json') return 'application/json';
  if (extension === 'wasm') return 'application/wasm';
  if (extension === 'svg') return 'image/svg+xml';
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'ico') return 'image/x-icon';
  if (extension === 'woff') return 'font/woff';
  if (extension === 'woff2') return 'font/woff2';
  if (extension === 'ttf') return 'font/ttf';
  return 'application/octet-stream';
}

function rawfilePath(url: string): string | null {
  let path: string;
  if (url.startsWith(APP_PREFIX)) {
    path = url.substring(APP_PREFIX.length);
  } else if (url.startsWith(CUBING_WORKER_PREFIX)) {
    path = `cubing-chunks/${url.substring(CUBING_WORKER_PREFIX.length)}`;
  } else {
    return null;
  }
  const query = path.indexOf('?');
  if (query >= 0) path = path.substring(0, query);
  const fragment = path.indexOf('#');
  if (fragment >= 0) path = path.substring(0, fragment);
  try {
    path = decodeURIComponent(path);
  } catch (_) {
    return '';
  }
  if (!path || path.includes('\\') || path.includes('\0')) return '';
  const segments = path.split('/');
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..') return '';
  }
  return `app/${path}`;
}

function finishError(response: WebResourceResponse): void {
  response.setResponseData('Not Found');
  response.setResponseEncoding('utf-8');
  response.setResponseMimeType('text/plain');
  response.setResponseHeader([{ headerKey: 'Cache-Control', headerValue: 'no-store' }]);
  response.setResponseCode(404);
  response.setReasonMessage('Not Found');
  response.setResponseIsReady(true);
}

export class RawfileResponder {
  private readonly context: common.UIAbilityContext;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  intercept(url: string): WebResourceResponse | null {
    const path = rawfilePath(url);
    if (path === null) return null;
    const response = new WebResourceResponse();
    response.setResponseIsReady(false);
    if (!path) {
      finishError(response);
      return response;
    }
    this.context.resourceManager.getRawFileContent(path).then((content) => {
      response.setResponseData(content.buffer as ArrayBuffer);
      response.setResponseEncoding('utf-8');
      response.setResponseMimeType(mimeType(path));
      response.setResponseHeader([
        { headerKey: 'Access-Control-Allow-Origin', headerValue: 'https://localhost' },
        { headerKey: 'Cache-Control', headerValue: 'no-cache' }
      ]);
      response.setResponseCode(200);
      response.setReasonMessage('OK');
      response.setResponseIsReady(true);
    }).catch(() => finishError(response));
    return response;
  }
}
