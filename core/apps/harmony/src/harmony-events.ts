type HarmonyEventDetail = string | boolean;

const launchUrls: string[] = [];
const seenLaunchUrls = new Set<string>();
const launchListeners = new Set<(url: string) => void>();
const networkListeners = new Set<(connected: boolean) => void>();
const backListeners = new Set<() => void>();

function acceptLaunchUrl(url: string): void {
  if (seenLaunchUrls.has(url)) return;
  seenLaunchUrls.add(url);
  launchUrls.push(url);
  launchListeners.forEach((listener) => listener(url));
}

window.addEventListener('cuberoot:launch-url', (event) => {
  const detail = (event as CustomEvent<HarmonyEventDetail>).detail;
  if (typeof detail === 'string') acceptLaunchUrl(detail);
});

window.addEventListener('cuberoot:network', (event) => {
  const detail = (event as CustomEvent<HarmonyEventDetail>).detail;
  if (typeof detail === 'boolean') networkListeners.forEach((listener) => listener(detail));
});

window.addEventListener('cuberoot:back', () => {
  backListeners.forEach((listener) => listener());
});

export function drainLaunchUrls(): string[] {
  return launchUrls.splice(0);
}

export function pushLaunchUrls(urls: string[]): void {
  urls.forEach(acceptLaunchUrl);
}

export function addLaunchUrlListener(listener: (url: string) => void): () => void {
  launchListeners.add(listener);
  return () => launchListeners.delete(listener);
}

export function addNetworkEventListener(listener: (connected: boolean) => void): () => void {
  networkListeners.add(listener);
  return () => networkListeners.delete(listener);
}

export function addBackEventListener(listener: () => void): () => void {
  backListeners.add(listener);
  return () => backListeners.delete(listener);
}
