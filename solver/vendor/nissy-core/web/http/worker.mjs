import Nissy from "./nissy_web_module.mjs"

const nissy = await Nissy();

const log = (cstr) => postMessage({
	command: "log",
	id: -1,
	object: nissy.UTF8ToString(cstr)
});
nissy.setLogger(nissy.addFunction(log, "vp"));

var solveStatus = nissy.statusRUN; // For now this is a global variable
const pollStatus = () => solveStatus;
const pollStatusCallback = nissy.addFunction(pollStatus, "i");

const commands = [
  { name: "load solver data", exec: loadSolverDataFromStorage },
  { name: "download solver data", exec: downloadSolverData },
  { name: "generate solver data", exec: generateSolverData },
  { name: "validate scramble", exec: validateScramble },
  { name: "solve", exec: solve },
  { name: "update status", exec: updateStatus },
];

// Message structure:
// {
//   command: string // The function to run.
//   id: number      // An identification number for the command, used for
//                   // sending responses back to the caller and having them
//                   // caught by the correct handler.
//   arg: object     // The actual argument of the message, command-specific.
//                   // See below for details.
// }
onmessage = (event) => {
  for (var i = 0; i < commands.length; i++) {
    if (commands[i].name == event.data.command) {
      commands[i].exec(event.data.id, event.data.arg);
      console.log("[worker] Received '" + commands[i].name + "'");
      return;
    }
  }
 
  console.log("[nissy worker] unknown command " + event.data.command);
};

// Load solver data from storage.
// Argument: string (the name of the solver)
async function loadSolverDataFromStorage(id, solver) {
  const async_return = (success, message = "") => postMessage({
    command: "load solver data",
    id: id,
    arg: {
      success: success,
      message: message
    }
  });

  if (!(await nissy.isSolverAvailable(solver))) {
    async_return(false, "Error: solver " + solver +
      " is not available in this version of nissy.");
    return;
  }

  if (await nissy.isSolverLoaded(solver)) {
    async_return(true);
    return;
  }

  if (await nissy.initSolverFromStorage(solver)) {
    async_return(true);
  } else {
    async_return(false, "Could not read data for " + solver +
      " from local storage");
  }
}

// Download solver data.
// Argument: string (the name of the solver)
async function downloadSolverData(id, solver) {
  const async_return = (success, message = "") => postMessage({
    command: "download solver data",
    id: id,
    arg: {
      success: success,
      message: message
    }
  });

  if (!(await nissy.isSolverAvailable(solver))) {
    async_return(false, "Error: solver " + arg.solver +
      " is not available in this version of nissy.");
    return;
  }

  if (await nissy.initSolverDownload(solver, "/tables")) {
    async_return(true);
  } else {
    async_return(false, "Error retrieving solver data");
  }
}

// Generate solver data locally.
// Argument: string (the name of the solver)
async function generateSolverData(id, solver) {
  const async_return = (success, message = "") => postMessage({
    command: "generate solver data",
    id: id,
    arg: {
      success: success,
      message: message
    }
  });

  if (!(await nissy.isSolverAvailable(solver))) {
    async_return(false, "Error: solver " + arg.solver +
      " is not available in this version of nissy.");
    return;
  }

  if (await nissy.initSolverGenerate(solver)) {
    async_return(true);
  } else {
    async_return(false, "Error generating solver data");
  }
}

// Check if the scramble is valid.
// Argument: string (the scramble).
async function validateScramble(id, arg) {
  const async_return = (success) => postMessage({
    command: "validate scramble",
    id: id,
    arg: success
  });

  var cube = new nissy.Cube();
  async_return(cube.move(arg).ok());
}

// Solve the cube with the given options.
// Argument: {
//   solver: string
//   scramble: string
//   minmoves: number
//   maxmoves: number
//   maxsolutions: number
//   optimal: number
//   threads: number
// }
async function solve(id, arg) {
  const async_return = (success, solutions = [], message = "") => postMessage({
    command: "solve",
    id: id,
    arg: {
      success: success,
      solutions: solutions,
      message: message
    }
  });

  if (!(await nissy.isSolverAvailable(arg.solver))) {
    async_return(false, [], "Error: solver " + arg.solver +
      " is not available in this version of nissy.");
    return;
  }

  if (!(await nissy.isSolverLoaded(arg.solver)) &&
      !(await nissy.initSolverFromStorage(arg.solver))) {
    async_return(false, [], "Error: solver " + arg.solver + " has not been " +
      "loaded. Its data must be donwloaded or generated before using it.");
    return;
  }

  solveStatus = nissy.statusRUN;

  var cube = new nissy.Cube();
  cube.move(arg.scramble);

  const nissFlag = ((str) => {
    switch (str) {
      case "inverse": return nissy.NissFlag.inverse;
      case "mixed": return nissy.NissFlag.mixed;
      case "linear": return nissy.NissFlag.linear;
      case "all": return nissy.NissFlag.all;
      default: return nissy.NissFlag.normal;
    }
  })(arg.nissFlag);

  const result = await nissy.solve(arg.solver, cube, nissFlag, arg.minmoves,
    arg.maxmoves, arg.maxsolutions, arg.optimal, arg.threads,
    pollStatusCallback);

  if (result.err.ok()) {
    var solutions = result.solutions == "" ? [] : result.solutions.split("\n");
    solutions.pop(); // Solver always returns string ending in newline
    for (var i = 0; i < solutions.length; i++) {
      const movecount = await nissy.countMoves(solutions[i]);
      solutions[i] += " (" + movecount.value + ")";
    }
    async_return(true, solutions);
  } else {
    async_return(false, [],
      "Error while solving (error " + result.err.value + ")");
  }
};

function updateStatus(id, arg) {
  if (arg == "stop") {
    solveStatus = nissy.statusSTOP;
  } else if (arg == "pause") {
    solveStatus = nissy.statusPAUSE;
  } else {
    solveStatus = nissy.statusRUN;
  }
};
