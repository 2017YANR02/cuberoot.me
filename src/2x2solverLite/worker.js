
let searchInstance;
const initPromise = new Promise((resolve, reject) => {
	self.Module = {
		onRuntimeInitialized: () => {
			try {
				searchInstance = new self.Module.search();
				resolve();
			} catch (e) {
				console.error(e);
				reject("Error");
			}
		}
	};
});

importScripts('solver.js');

self.onmessage = async function (event) {
	const { defString } = event.data;
	try {
		await initPromise;
		if (searchInstance) {
			ret = searchInstance.solve(defString);
		}
	} catch (e) {
		console.error(e);
		self.postMessage("Error");
	}
};

