const CACHE_NAME = 'pwa-cache_v63';

const urlsToPrecache = [
	'index.html',
	'manifest.json',
	'icons/icon-512x512.png',
	'icons/icon-192x192.png',
	'sw-register.js',
	'analytics.js',
	'url_params_compressor_simple.js'
];

const urlsToCache = [
	'index.html',
	'2x2x2.html',
	'cross_trainer.html',
	'documentation.html',
	'eocross_trainer.html',
	'pairing_trainer.html',
	'xcross_pairing_trainer.html',
	'pseudo_pairing_trainer.html',
	'pseudo_xcross_trainer.html',
	'xcross_trainer.html',
	'xxcross_trainer.html',
	'jsonEditor.html',
	'algTrainer.html',
	'manifest.json',
	'icons/icon-512x512.png',
	'icons/icon-192x192.png',
	'sw-register.js',
	'analytics.js',
	'url_params_compressor_simple.js',
	'src/2x2solver/solver.js',
	'src/2x2solver/solver.wasm',
	'src/2x2solver/worker.js',
	'src/2x2solverLite/solver.js',
	'src/2x2solverLite/solver.wasm',
	'src/2x2solverLite/worker.js',
	'src/2x2solverLite/worker_scrambler.js',
	'src/crossAnalyzer/analyzer.js',
	'src/crossAnalyzer/analyzer.wasm',
	'src/crossAnalyzer/worker_analyzer.js',
	'src/crossSolver/solver.js',
	'src/crossSolver/solver.wasm',
	'src/crossSolver/worker.js',
	'src/crossTrainer/solver.js',
	'src/crossTrainer/solver.wasm',
	'src/crossTrainer/worker.js',
	'src/EOCrossAnalyzer/analyzer.js',
	'src/EOCrossAnalyzer/analyzer.wasm',
	'src/EOCrossAnalyzer/worker_analyzer.js',
	'src/EOCrossSolver/solver.js',
	'src/EOCrossSolver/solver.wasm',
	'src/EOCrossSolver/worker.js',
	'src/eocrossTrainer/solver.js',
	'src/eocrossTrainer/solver.wasm',
	'src/eocrossTrainer/worker.js',
	'src/F2L_PairingSolver/pairing_solver.js',
	'src/F2L_PairingSolver/pairing_solver.wasm',
	'src/F2L_PairingSolver/worker_pairing.js',
	'src/functions/functions.js',
	'src/functions/functions.wasm',
	'src/functions/list.js',
	'src/highMemorySolver/solver2.js',
	'src/highMemorySolver/solver2.wasm',
	'src/highMemorySolver/worker2.js',
	'src/min2phase.js/min2phase.js',
	'src/pairAnalyzer/analyzer.js',
	'src/pairAnalyzer/analyzer.wasm',
	'src/pairAnalyzer/worker_analyzer.js',
	'src/pairingTrainer/solver.js',
	'src/pairingTrainer/solver.wasm',
	'src/pairingTrainer/worker.js',
	'src/pseudoCrossAnalyzer/pseudo_analyzer.js',
	'src/pseudoCrossAnalyzer/pseudo_analyzer.wasm',
	'src/pseudoCrossAnalyzer/worker_panalyzer.js',
	'src/pseudoCrossSolver/pseudo.js',
	'src/pseudoCrossSolver/pseudo.wasm',
	'src/pseudoCrossSolver/worker3.js',
	'src/pseudoPairAnalyzer/analyzer.js',
	'src/pseudoPairAnalyzer/analyzer.wasm',
	'src/pseudoPairAnalyzer/worker_analyzer.js',
	'src/pseudoPairingSolver/pseudoPairingSolver.js',
	'src/pseudoPairingSolver/pseudoPairingSolver.wasm',
	'src/pseudoPairingSolver/workerPseudoPairing.js',
	'src/pseudoPairingTrainer/solver.js',
	'src/pseudoPairingTrainer/solver.wasm',
	'src/pseudoPairingTrainer/worker.js',
	'src/pseudoXcrossTrainer/solver.js',
	'src/pseudoXcrossTrainer/solver.wasm',
	'src/pseudoXcrossTrainer/worker.js',
	'src/xcrossTrainer/solver.js',
	'src/xcrossTrainer/solver.wasm',
	'src/xcrossTrainer/worker.js',
	'src/xxcrossTrainer/production/solver_prod.js',
	'src/xxcrossTrainer/production/solver_prod.wasm',
	'src/xxcrossTrainer/production/worker_prod.js',
	'src/xcross_free_pair_trainer/production/solver_prod.js',
	'src/xcross_free_pair_trainer/production/solver_prod.js',
	'src/xcross_free_pair_trainer/production/worker_prod.js'
];

let precacheDone = false;
let fullcacheStarted = false;

self.addEventListener('install', (event) => {
	event.waitUntil((async () => {
		const cache = await caches.open(CACHE_NAME);
		try {
			await cache.addAll(urlsToPrecache);
			precacheDone = true;
		} catch (e) {
			console.warn('Precache required assets failed, falling back to individual fetch:', e);
			let precacheFailed = false;
			await Promise.all(urlsToPrecache.map(async (url) => {
				try {
					const res = await fetch(url);
					if (res && res.ok) {
						await cache.put(url, res.clone());
					} else {
						console.error(`Failed to cache (bad response): ${url}`);
						precacheFailed = true;
					}
				} catch (err) {
					console.error(`Failed to cache (fetch error): ${url}`, err);
					precacheFailed = true;
				}
			}));

			if (precacheFailed) {
				console.error('One of more critical precache assets failed. Install will fail.');
				throw new Error('Critical precache failed.');
			}
			precacheDone = true;
		}
	})());
});

self.addEventListener('activate', (event) => {
	event.waitUntil((async () => {
		if (self.registration && self.registration.navigationPreload) {
			try { await self.registration.navigationPreload.enable(); } catch (e) { }
		}
		const cacheWhitelist = [CACHE_NAME];
		const keys = await caches.keys();
		const hadOldCaches = keys.some(name => name !== CACHE_NAME);
		await Promise.all(keys.map(name => cacheWhitelist.indexOf(name) === -1 ? caches.delete(name) : Promise.resolve()));
		try {
			await self.clients.claim();
		} catch (e) {
			console.error('clients.claim() failed:', e);
		}
		if (hadOldCaches) {
			const notify = async (msg) => {
				try {
					const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
					for (const client of all) {
						client.postMessage(msg);
					}
				} catch (e) {
					console.error('Broadcast to clients failed:', e);
				}
			};
			notify({ type: 'SW_UPDATE_AVAILABLE', cacheName: CACHE_NAME });
		}
	})());
});

self.addEventListener('message', (event) => {
	const data = event.data || {};
	if (!data || !data.type) return;

	if (data && (data.type === 'DP_PRECACHE' || data.type === 'APP_INSTALLED')) {
		if (precacheDone) return;
		event.waitUntil((async () => {
			const cache = await caches.open(CACHE_NAME);
			let precacheFailed = false;
			try {
				await cache.addAll(urlsToPrecache);
			} catch (e) {
				console.warn('Precache required assets failed (from message), falling back to individual fetch:', e);
				await Promise.all(urlsToPrecache.map(async (url) => {
					try {
						const res = await fetch(url);
						if (res && res.ok) {
							await cache.put(url, res.clone());
						} else {
							console.error(`Failed to cache (bad response): ${url}`);
							precacheFailed = true;
						}
					} catch (err) {
						console.error(`Failed to cache (fetch error): ${url}`, err);
						precacheFailed = true;
					}
				}));
			}
			if (precacheFailed) {
				console.error('One or more critical precache assets failed (from message).');
				throw new Error('Critical precache failed (from message).');
			}
			precacheDone = true;
		})());
	}
	if (data.type === 'DP_FULLCACHE' || data.type === 'APP_INSTALLED_FULL') {
		event.waitUntil((async () => {
			if (fullcacheStarted) return;
			fullcacheStarted = true;
			const cache = await caches.open(CACHE_NAME);
			const concurrency = 4;
			const list = urlsToCache.filter(u => !urlsToPrecache.includes(u));
			let idx = 0;
			const worker = async () => {
				while (idx < list.length) {
					const i = idx++;
					const url = list[i];
					try {
						const res = await fetch(url);
						if (res && res.ok) await cache.put(url, res.clone());
					} catch (e) { }
				}
			};
			await Promise.all(new Array(concurrency).fill(0).map(() => worker()));
		})());
	}

	if (data.type === 'FORCE_ACTIVATE') {
		event.waitUntil((async () => {
			try {
				self.skipWaiting();
				await self.clients.claim();
			} catch (e) { }
		})());
	}
})

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;

	if (req.mode === 'navigate') {
		event.respondWith((async () => {
			const match = await caches.match(req, { ignoreSearch: true });
			if (match) return match;

			const preload = await event.preloadResponse;
			if (preload) return preload;

			try {
				const net = await fetch(req);
				return net;
			} catch (err) {
				const pageSpecific = await caches.match(req.url);
				if (pageSpecific) return pageSpecific;
				const idx = await caches.match('index.html');
				if (idx) return idx;
			}
		})());
		return;
	}

	event.respondWith((async () => {
		const cache = await caches.open(CACHE_NAME);
		const cachedResponse = await cache.match(req);
		const networkPromise = fetch(req).then(async (networkResponse) => {
			if (networkResponse && networkResponse.status === 200) {
				try { await cache.put(req, networkResponse.clone()); } catch (e) { }
			}
			return networkResponse;
		}).catch(() => null);

		return cachedResponse || await networkPromise || new Response(null, { status: 504 });
	})());
});

