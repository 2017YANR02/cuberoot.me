import { EVENTS } from '@cuberoot/shared/timer/types';

export const watchEvents = EVENTS.filter(event => ['222', '333', '444', 'pyra', 'skewb', 'cross', 'oll', 'pll'].includes(event.id))
  .map(({ id, nameEn, nameZh }) => ({ id, en: nameEn, zh: nameZh, training: ['cross', 'oll', 'pll'].includes(id) }));
