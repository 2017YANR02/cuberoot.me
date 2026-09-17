import { compute222OptimalHtm } from './alg_222_optimal';

self.onmessage = async (event: MessageEvent<string[]>) => {
  const lengths = await compute222OptimalHtm(event.data);
  self.postMessage(lengths);
};
