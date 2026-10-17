declare module 'watch-cubing-333' {
  export function setIsInsideWorker(value: boolean): void;
  export function random333Scramble(): Promise<{ toString(): string }>;
}
