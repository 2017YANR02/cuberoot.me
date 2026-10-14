// Shared by the daemon and bounded protocol checks; never allocates a table.
export function captureCubeoptOutput() {
  const state = { htm: null, solution: '' };
  return {
    print(line) {
      const text = String(line);
      const solution = text.match(/Solution found!:\s*(.*)/);
      if (solution) state.solution = solution[1].trim().replace(/\s+/g, ' ');
      const length = text.match(/finished in (\d+)/);
      if (length) state.htm = Number(length[1]);
    },
    reset() { state.htm = null; state.solution = ''; },
    result() { return { ...state }; },
  };
}

export async function initializeCubeoptSolver(module, threads, output) {
  await module.init(0, threads);
  return async (scramble) => {
    output.reset();
    await module.solve_scramble(scramble, threads, 1, true);
    return output.result();
  };
}

export async function serveCubeoptLines(lines, solve, write) {
  // Await each request: async EventEmitter callbacks would overlap worker pools.
  for await (const line of lines) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const id = line.slice(0, tab);
    const tokens = line.slice(tab + 1).trim().split(/\s+/).filter(Boolean);
    if (!tokens.length || tokens.length > 50 || tokens.some(t => !/^[URFDLB][2']?$/.test(t))) {
      write(`${id}\tERROR\tinvalid scramble\n`);
      continue;
    }
    try {
      const { htm, solution } = await solve(tokens.join(' '));
      if (!Number.isInteger(htm) || htm < 0 || htm > 20 || (htm > 0 && !solution)) {
        write(`${id}\tERROR\tno solution\n`);
        continue;
      }
      write(`${id}\t${htm}\t${solution}\n`);
    } catch (error) {
      write(`${id}\tERROR\t${String(error?.message ?? error).replace(/\s+/g, ' ')}\n`);
      // A failed worker cannot be counted as an exhausted search shard.
      throw error;
    }
  }
}
