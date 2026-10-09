// Run ./build.sh web from the main folder before running this example.
// The necessary modules (including worker.mjs) will be built and / or moved
// to this folder when running ./build.sh web.

var solveButton = document.getElementById("solveButton");
var pauseResumeButton = document.getElementById("pauseResumeButton");
var cancelSolveButton = document.getElementById("cancelSolveButton");
var scrField = document.getElementById("scrambleText");
var resultsLabel = document.getElementById("resultsLabel");
var resultsText = document.getElementById("results");
var solverSelector = document.getElementById("solverSelector");
var toggleLog = document.getElementById("toggleShowLog");
var logPane = document.getElementById("logPane");
var minSlider = document.getElementById("minMovesSlider");
var maxSlider = document.getElementById("maxMovesSlider");
var minLabel = document.getElementById("minLabel");
var maxLabel = document.getElementById("maxLabel");
var maxSolsInput = document.getElementById("maxSolutions");
var optimalInput = document.getElementById("optimalInput");

var solveStatus = "run"; // For now this is global
var lastCallbackId = 0;
var callbacks = new Map(); // Values: { f: function, arg: object }
var worker = new Worker("./worker.mjs", { type: "module" });

// Periodically send status updates to the worker

const sendStatusUpdateToWorker = () =>
  worker.postMessage({command: "update status", id: -1, arg: solveStatus });
setInterval(() => sendStatusUpdateToWorker(), 500);

worker.onmessage = (event) => {
  if (event.data.command == "log") {
    logPane.innerText += event.data.object;
    console.log(event.data.object);
  } else if (!callbacks.has(event.data.id)) {
    console.log("[nissy app] Unknown callback " + event.data.id +
      " for command " + event.data.command);
  } else {
    var callback = callbacks.get(event.data.id);
    callbacks.delete(event.data.id);
    callback.f(callback.arg, event.data.arg);
  }
};

function updateResults(label, results, enable) {
  resultsLabel.innerText = label;
  resultsText.innerText = results;
  solveButton.disabled = !enable;
  solverSelector.disabled = !enable;
  minSlider.disabled = !enable;
  maxSlider.disabled = !enable;
  maxSolsInput.disabled = !enable;
  optimalInput.disabled = !enable;
}

scrField.addEventListener("input", (e) => {
  const scramble = scrField.value;

  const callbackId = ++lastCallbackId;
  callbacks.set(callbackId, {
    f: (callbackArg, validateResult) => {
      if (validateResult) {
        scrField.style.border = "";
      } else {
        scrField.style.border = "2px solid red";
      }
    },
    arg: scramble
  });

  worker.postMessage({
    command: "validate scramble",
    id: callbackId,
    arg: scramble
  });
});

minSlider.addEventListener("input", () =>
  minLabel.innerText = "Minimum moves: " + minSlider.value);

maxSlider.addEventListener("input", () =>
  maxLabel.innerText = "Maximum moves: " + maxSlider.value);

function enforceMinMax() {
  if (this.value != "") {
    if (parseInt(this.value) < parseInt(this.min))
      this.value = this.min;
    if (parseInt(this.value) > parseInt(this.max))
      this.value = this.max;
  }
}

maxSolsInput.addEventListener("keyup", enforceMinMax);
optimalInput.addEventListener("keyup", enforceMinMax);

var logVisible = false;
toggleLog.addEventListener("click", () => {
  logVisible = !logVisible;
  if (logVisible) {
    logPane.style.display = "block";
    toggleLog.innerText = "Hide nissy log messages";
  } else {
    logPane.style.display = "none";
    toggleLog.innerText = "Show nissy log messages";
  }
});

solveButton.addEventListener("click", () => {
  const solver = solverSelector.options[solverSelector.selectedIndex].value;
  const scramble = scrField.value;

  const callbackId = ++lastCallbackId;
  callbacks.set(callbackId, {
    f: (callbackArg, validateResult) => {
      if (validateResult) {
        loadDataThenSolve(callbackArg.solver, callbackArg.scramble);
      } else {
        updateResults("Scramble is invalid", "", true);
      }
    },
    arg: {
      solver: solver,
      scramble: scramble
    }
  });

  worker.postMessage({
    command: "validate scramble",
    id: callbackId,
    arg: scramble
  });
});

function loadDataThenSolve(solver, scramble) {
  updateResults("Loading solver " + solver + "...", "", false);

  const callbackId = ++lastCallbackId;
  callbacks.set(callbackId, {
    f: (callbackArg, loadResult) => {
      if (loadResult.success)
        startSolve(callbackArg.solver, callbackArg.scramble);
      else
        askDownloadThenSolve(callbackArg.solver, callbackArg.scramble);
    },
    arg: { solver: solver, scramble: scramble }
  });

  worker.postMessage({
    command: "load solver data",
    id: callbackId,
    arg: solver
  });
}

function askDownloadThenSolve(solver, scramble) {
  var confirmDiv = document.getElementById("confirmDownload");
  var cancel = document.getElementById("confirmDownloadCancel");
  var download = document.getElementById("confirmDownloadConfirm");
  var generate = document.getElementById("confirmDownloadGenerate");
  const cleanup = () => {
    confirmDiv.style.display = "none";

    // Remove event listeners by cloning the buttons
    cancel.outerHTML = cancel.outerHTML;
    download.outerHTML = download.outerHTML;
    generate.outerHTML = generate.outerHTML;
  };

  updateResults("", "", false);
  confirmDiv.style.display = "block";

  cancel.addEventListener("click", () => {
    cleanup();
    updateResults("", "", true);
  });

  download.addEventListener("click", () => {
    cleanup();
    downloadDataThenSolve(solver, scramble);
  });

  generate.addEventListener("click", () => {
    cleanup();
    generateDataThenSolve(solver, scramble);
  });
}

const downloadDataThenSolve = (solver, scramble) =>
  downloadOrGenerateThenSolve(solver, scramble, true);

const generateDataThenSolve = (solver, scramble) =>
  downloadOrGenerateThenSolve(solver, scramble, false);

function downloadOrGenerateThenSolve(solver, scramble, download) {
  const msg = download ? "Downloading data for " : "Generating data for ";
  const command = download ? "download solver data" : "generate solver data";

  updateResults(msg + solver + "...", "", false);

  const callbackId = ++lastCallbackId;
  callbacks.set(callbackId, {
    f: (callbackArg, loadResult) => {
      if (loadResult.success)
        startSolve(callbackArg.solver, callbackArg.scramble);
      else
        updateResults("Failed", loadResult.message, true);
    },
    arg: { solver: solver, scramble: scramble }
  });

  worker.postMessage({
    command: command,
    id: callbackId,
    arg: solver
  });
}

pauseResumeButton.addEventListener("click", (e) => {
  if (pauseResumeButton.innerText == "Pause") {
    solveStatus = "pause";
    pauseResumeButton.innerText = "Resume";
    updateResults("Solver paused - click Resume to continue", "", false);
  } else {
    solveStatus = "run";
    pauseResumeButton.innerText = "Pause";
    updateResults("Solving...", "", false);
  }
});

cancelSolveButton.addEventListener("click", (e) => {
  solveStatus = "stop";
  pauseResumeButton.innerText = "Pause";
});

function startSolve(solver, scramble) {
  updateResults("Solving...", "", false);

  const callbackId = ++lastCallbackId;
  pauseResumeButton.disabled = false;
  cancelSolveButton.disabled = false;
  solveStatus = "run";

  callbacks.set(callbackId, {
    f: (callbackArg, solveResult) => {
      pauseResumeButton.disabled = true;
      cancelSolveButton.disabled = true;
      pauseResumeButton.innerText = "Pause";
      solveStatus = "stop";

      if (solveResult.success) {
        const n = solveResult.solutions.length;
        const label = n == 0 ? "No solution found" :
          ("Found " + n + " solution" + (n == 1 ? "" : "s")) + ":";
        const text = solveResult.solutions.join("\n");
        updateResults(label, text, true);
      } else {
        updateResults("Unexpected error while solving!", "", true);
      }
    },
    arg: "" // Currently unused
  });

  worker.postMessage({
    command: "solve",
    id: callbackId,
    arg: {
      solver: solver,
      scramble: scramble,
      minmoves: Number(minSlider.value),
      maxmoves: Number(maxSlider.value),
      maxsolutions: Number(maxSolsInput.value),
      optimal: Number(optimalInput.value),
      threads: window.navigator.hardwareConcurrency,
    }
  });
}
