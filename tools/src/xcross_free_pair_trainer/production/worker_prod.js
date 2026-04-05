
let xxcrossSearchInstance_adjacent = null;
let xxcrossSearchInstance_opposite = null;
let Module = null; // Modulized WASM module

importScripts('solver_prod.js');

const modulePromise = (async() => {
	try {
		console.log('[Worker] Initializing WASM module (calling createModule)...');
		Module = await self.createModule();
		return Module;
	} catch (e) {
		console.log(e);
		reject("Initial Error");
	}
})();


self.onmessage = async function (event) {
	const { scr, len, pairType, bucketModel} = event.data;
	try {
		await modulePromise;
		if (pairType === 'adj' && !xxcrossSearchInstance_adjacent) {
			const adj = true;
			const model = bucketModel || "1M/1M/2M/2M";
			xxcrossSearchInstance_adjacent = new Module.xxcross_search(adj, model);
		} else if (pairType === 'opp' && !xxcrossSearchInstance_opposite) {
			const adj = false;
			const model = bucketModel || "1M/1M/2M/2M";
			xxcrossSearchInstance_opposite = new Module.xxcross_search(adj, model);
		}
		const instance = pairType === 'adj' 
			? xxcrossSearchInstance_adjacent 
			: xxcrossSearchInstance_opposite;
		const ret = instance.func(scr, len);
		self.postMessage(ret);
	} catch (e) {
		self.postMessage("Error");
	}
};