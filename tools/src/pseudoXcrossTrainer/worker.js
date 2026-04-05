
let xcrossSearchInstance;
const initPromise = new Promise((resolve, reject) => {
	self.Module = {
		onRuntimeInitialized: () => {
			try {
				xcrossSearchInstance = new self.Module.xcross_search();
				resolve();
			} catch (e) {
				reject("Error");
			}
		}
	};
});

importScripts('solver.js');

self.onmessage = async function (event) {
	const { scr, len } = event.data;
	try {
		await initPromise;
		if (xcrossSearchInstance) {
			const ret = xcrossSearchInstance.func(scr, len);
			self.postMessage(ret);
		}
	} catch (e) {
		self.postMessage("Error");
	}
};

