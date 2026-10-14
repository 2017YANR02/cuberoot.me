import type { Writable } from 'node:stream';

/** The child may exit between READY and a write; never let EPIPE crash the API. */
export function cubeoptInputWriter(input: Writable, onFailure: (error: Error) => void) {
  let failed = false;
  const fail = (error: Error) => {
    if (failed) return;
    failed = true;
    onFailure(error);
  };
  input.on('error', fail);
  return (line: string) => {
    if (failed) return;
    try {
      input.write(line, error => { if (error) fail(error); });
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  };
}
