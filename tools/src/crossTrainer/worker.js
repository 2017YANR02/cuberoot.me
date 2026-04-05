
let crossSearchInstance;
const initPromise = new Promise((resolve, reject) => {
    self.Module = {
        onRuntimeInitialized: () => {
            try {
                crossSearchInstance = new self.Module.cross_search();
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
        if (crossSearchInstance) {
            const ret = crossSearchInstance.func(scr, len);
            self.postMessage(ret);
        }
    } catch (e) {
        self.postMessage("Error");
    }
};

