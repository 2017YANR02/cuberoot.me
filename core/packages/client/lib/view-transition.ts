import { flushSync } from 'react-dom';
import { runViewTransition } from '@cuberoot/app-ui/appearance';

export { runViewTransition };
export function runPlayerFullscreenTransition(commit: () => void) {
  runViewTransition(() => flushSync(commit), true, 'player-fullscreen');
}
