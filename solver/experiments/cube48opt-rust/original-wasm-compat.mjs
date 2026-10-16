// Patch only the JS pthread runtime in a private benchmark copy. WASM and PDB
// bytes stay upstream-identical; neither search code nor thread count changes.
import assert from 'node:assert/strict';

export const mailboxOld = '    wait.value.then(checkMailbox);';
export const mailboxFixed = `    if (wait.async) {
      wait.value.then(checkMailbox);
    } else {
      // A recycled/exiting pthread may already have changed its self pointer.
      // Atomics.waitAsync then returns a string, not a Promise. Yield so queued
      // thread lifecycle messages can run before checking the current mailbox.
      Module["printErr"]?.("[cubeopt-compat] synchronous mailbox wake: " + wait.value);
      setTimeout(checkMailbox, 0);
    }`;

export function patchOriginalWrapper(source) {
  assert.equal(source.split(mailboxOld).length, 2, 'Expected one known upstream mailbox wait');
  const crashOld = '    } catch (ex) {\n      __emscripten_thread_crashed();\n      throw ex;';
  assert.equal(source.split(crashOld).length, 2, 'Expected one upstream pthread error handler');
  return source.replace(mailboxOld, mailboxFixed).replace(crashOld,
    '    } catch (ex) {\n      if (ENVIRONMENT_IS_NODE) process.stderr.write("[cubeopt-pthread] " + (ex?.stack ?? ex) + "\\n");\n      __emscripten_thread_crashed();\n      throw ex;');
}
