
const solverPromise = new Promise(resolve => {
	self.Module = {
		onRuntimeInitialized: () => resolve(self.Module)
	};
});

importScripts('solver2.js');

self.onmessage = async function (event) {
	const { solver, scr, rot, slot, ll, num, len, move_restrict, post_alg, center_offset, max_rot_count, ma2, mcString } = event.data;
	try {
		const Module = await solverPromise;
		Module.solve(solver, scr, rot, slot, ll, num, len, move_restrict, post_alg, center_offset, max_rot_count, ma2, mcString);
	} catch (e) {
		self.postMessage("Error");
	}
};