if ('serviceWorker' in navigator) {
	// 按本脚本自身 URL 定位 sw.js —— 本站页面在子目录，相对页面解析会 404
	const swRegisterBase = document.currentScript ? document.currentScript.src : window.location.href;
	const postSwMessage = (msg) => {
		if (navigator.serviceWorker && navigator.serviceWorker.controller) {
			navigator.serviceWorker.controller.postMessage(msg);
		}
	};
	window.addEventListener('load', () => {
		navigator.serviceWorker.register(new URL('sw.js', swRegisterBase).href).then(registration => {
			console.log('Service Worker registered successfully:', registration);
			if (navigator.serviceWorker.controller) {
				postSwMessage({ type: 'DP_PRECACHE' });
			} else {
				registration.addEventListener('updatefound', () => {
					if (registration.installing) {
						registration.installing.addEventListener('statechange', (e) => {
							if (e.target.state === 'activated') {
								postSwMessage({ type: 'DP_PRECACHE' });
							}
						});
					}
				});
			}
			if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
				console.log('App is running in standalone mode (PWA). Triggering full cache.');
				postSwMessage({ type: 'APP_INSTALLED_FULL' });
			}
			window.addEventListener('appinstalled', () => {
				console.log('App installed. Triggering full cache.');
				postSwMessage({ type: 'APP_INSTALLED_FULL' });
			});
		}).catch(err => {
			console.log('Service Worker registration failed:', err);
		});
	});

	navigator.serviceWorker.addEventListener('message', async (ev) => {
		const data = ev.data || {};
		if (!data || data.type !== 'SW_UPDATE_AVAILABLE') return;

		const proceed = confirm('A new version is available.\nDo you want to update now and reload the page?\n\nPress OK to update and reload, Cancel to do it later.');
		if (!proceed) return;

		try {
			const reg = await navigator.serviceWorker.getRegistration();
			if (reg && reg.waiting) {
				reg.waiting.postMessage({ type: 'FORCE_ACTIVATE' });
			} else if (navigator.serviceWorker.controller) {
				navigator.serviceWorker.controller.postMessage({ type: 'FORCE_ACTIVATE' });
			}

			const onControllerChange = () => {
				navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
				window.location.reload();
			};
			navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
		} catch (e) {
			console.error('SW update activation failed:', e);
			alert('Failed to activate update. Please reload the page manually.');
		}
	});
}