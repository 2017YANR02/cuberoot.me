declare module '@absinthe/socket' {
  import type { Socket as PhoenixSocket } from 'phoenix';

  // 实际定义比这里复杂得多,我们只用到的子集。其余 any。
  interface AbsintheSocket {
    phoenixSocket: PhoenixSocket;
  }

  interface Notifier {
    operation: string;
    variables: Record<string, unknown>;
  }

  interface ObserveCallbacks<T = unknown> {
    onStart?: (notifier: Notifier) => void;
    onAbort?: (error: Error) => void;
    onError?: (error: { message?: string }) => void;
    onResult?: (result: T) => void;
    onCancel?: () => void;
  }

  export function create(socket: PhoenixSocket): AbsintheSocket;
  export function send(socket: AbsintheSocket, request: { operation: string; variables?: Record<string, unknown> }): Notifier;
  export function observe<T = unknown>(socket: AbsintheSocket, notifier: Notifier, callbacks: ObserveCallbacks<T>): void;
  export function cancel(socket: AbsintheSocket, notifier: Notifier): void;
  export function unobserve(socket: AbsintheSocket, notifier: Notifier, observer: ObserveCallbacks): void;
}
