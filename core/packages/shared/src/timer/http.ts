/** JSON transport required by timer data clients; browser fetch is compatible. */
export interface TimerHttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}
export interface TimerHttpRequest {
  method?: 'GET' | 'POST' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}
export type TimerHttpFetch = (url: string, init?: TimerHttpRequest) => Promise<TimerHttpResponse>;
