import { gunzipSync } from 'fflate';
import { attachCrossSolverWorker } from '../../../../tools/solver/rust-cross/cross-solver-worker.js';
import * as solverWasm from '../../../../tools/solver/rust-cross/cross_solver.js';
import packagedCrossTable from '../../../../tools/solver/rust-cross/tables/pt_cross.bin.gz';
import packagedSolverWasm from 'stage-solver-worker-wasm';
import { standardWebAssembly, useWebAssemblyRuntime } from './douyin-stage-solver-runtime.mjs';

let loadedModule;
let readyNeed;
let hasXCross = false;
let compressedTables;
let lastReply;
const loadedTableSizes = new Map();
let tableReads;

async function loadSolverWasm() {
  if (loadedModule) return loadedModule;
  let module;
  let runtime = standardWebAssembly;
  if (typeof standardWebAssembly?.Module === 'function' && typeof standardWebAssembly.Instance === 'function') {
    try { module = new standardWebAssembly.Module(gunzipSync(packagedSolverWasm)); }
    catch (error) {
      if (typeof TTWebAssembly === 'undefined') throw error;
    }
  }
  if (!module) {
    if (typeof TTWebAssembly === 'undefined') throw new Error('WebAssembly unavailable in timer worker');
    runtime = TTWebAssembly;
    module = await runtime.compile('workers/stage-solver.wasm.br');
  }
  useWebAssemblyRuntime(runtime);
  solverWasm.initSync({ module });
  loadedModule = solverWasm;
  return loadedModule;
}

const engine = attachCrossSolverWorker({
  postMessage(reply) {
    if (reply.type === 'face_progress' || reply.type.endsWith('_partial')) return;
    lastReply = reply;
  },
  now: Date.now,
  loadModule: loadSolverWasm,
  async readTable(name) {
    const data = compressedTables?.[name];
    if (name !== 'pt_cross' && (!(data instanceof ArrayBuffer) || data.byteLength < 18)) {
      throw new Error(`Missing stage solver table: ${name}`);
    }
    const decoded = gunzipSync(name === 'pt_cross' ? packagedCrossTable : new Uint8Array(data));
    tableReads?.set(name, decoded.byteLength);
    return decoded;
  },
});

async function dispatch(message) {
  lastReply = null;
  await engine.handle(message);
  if (!lastReply) throw new Error(`Stage solver did not respond to ${message.type}`);
  if (lastReply.type === 'error') throw new Error(lastReply.error);
  return lastReply;
}

async function loadTables(message) {
  const sizes = tableReads = new Map();
  try {
    await dispatch(message);
    for (const [name, bytes] of sizes) loadedTableSizes.set(name, bytes);
  } finally {
    tableReads = undefined;
  }
}

/** The shared timer worker serializes this native host's requests. */
export async function handleStageSolverPayload({ need, command, tables }) {
  if (command.type === 'stage_prepare') await loadSolverWasm();
  if (command.type === 'stage_prepare' || command.type === 'stage_status') {
    return { readyNeed: readyNeed ?? null, hasXCross };
  }
  if (command.type === 'stage_release') {
    engine.release();
    readyNeed = undefined;
    hasXCross = false;
    loadedTableSizes.clear();
    return null;
  }
  compressedTables = tables;
  try {
    if (readyNeed !== need) {
      engine.release();
      readyNeed = undefined;
      hasXCross = false;
      loadedTableSizes.clear();
      await loadTables({ type: 'init', need, xcross: false });
      readyNeed = need;
    }
    if (need === 'cross' && Number(command.variant) > 0 && !hasXCross) {
      await loadTables({ type: 'ensure_xcross' });
      hasXCross = true;
    }
    const startedAt = Date.now();
    let result;
    if (command.type === 'stage_masked_grid') {
      const values = [];
      for (let face = 0; face < 6; face++) {
        const row = await dispatch({ ...command, type: 'face', face });
        values.push(row.value);
      }
      result = { values };
    } else result = await dispatch(command);
    return { ...result, elapsedMs: Date.now() - startedAt,
      tables: Array.from(loadedTableSizes, ([name, bytes]) => ({ name, bytes })) };
  } finally {
    compressedTables = undefined;
  }
}
