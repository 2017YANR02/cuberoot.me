
const solverPromise = new Promise(resolve => {
	self.Module = {
		onRuntimeInitialized: () => resolve(self.Module)
	};
});

importScripts('solver.js');

self.onmessage = async function (event) {
	const { scr, rot, num, len, prune, move_restrict, post_alg, ma2, mcString } = event.data;
	try {
		const Module = await solverPromise;
		Module.solve(scr, rot, num, len, prune, move_restrict, post_alg, ma2, mcString);
	} catch (e) {
		console.error(e);
		self.postMessage("Error");
	}
};