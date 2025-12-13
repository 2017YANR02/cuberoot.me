
const solverPromise = new Promise(resolve => {
	self.Module = {
		onRuntimeInitialized: () => resolve(self.Module)
	};
});

importScripts('pairing_solver.js');

self.onmessage = async function (event) {
	const { scr, rot, slot, pslot, num, len, move_restrict, post_alg, center_offset, max_rot_count, ma2, mcString } = event.data;
	try {
		const Module = await solverPromise;
		Module.solve(scr, rot, slot, pslot, num, len, move_restrict, post_alg, center_offset, max_rot_count, ma2, mcString);
	} catch (e) {
		self.postMessage("Error");
	}
};