
const solverPromise = new Promise(resolve => {
	self.Module = {
		onRuntimeInitialized: () => resolve(self.Module)
	};
});

importScripts('analyzer.js');

self.onmessage = async function (event) {
	const { scramble, cross, x, xx, xxx, n, rot_set } = event.data;
	try {
		const Module = await solverPromise;
		Module.analyze(scramble, cross, x, xx, xxx, n, rot_set);
	} catch (e) {
		self.postMessage("Error");
	}
};