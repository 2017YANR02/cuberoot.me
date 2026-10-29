import { apiUrl, directApiUrl } from './api-base';
import type { DriveApiTransport } from './drive-api';

/** Only video capture opts into the local helper; ordinary Drive/API calls stay unchanged. */
const localCapture = process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_API_ORIGIN;
const LOCAL_CAPTURE_PREFIX = '/v1/recon-capture-local/';

function localUrl(path: string): string {
  if (!path.startsWith('/v1/')) throw new Error('Capture transport requires an API path');
  return LOCAL_CAPTURE_PREFIX + path.slice('/v1/'.length);
}

export function reconCaptureApiUrl(path: string): string {
  return localCapture ? localUrl(path) : apiUrl(path);
}

export const reconCaptureDriveTransport: DriveApiTransport = {
  apiUrl: reconCaptureApiUrl,
  directApiUrl: path => localCapture ? localUrl(path) : directApiUrl(path),
};

/** A pending local upload must never resume against production or another explicit API. */
export const reconCaptureEnvironment = localCapture
  ? 'development-local-3011'
  : process.env.NEXT_PUBLIC_API_ORIGIN || 'https://api.cuberoot.me';
