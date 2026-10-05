import { mayUseMiniProgramBridge } from '../bluetooth/miniprogram_bridge';
import { createMiniProgramStackmatSource } from '../bluetooth/timer/miniprogram';
import { createStackmatMicSource as createBrowserStackmat } from '@cuberoot/timer-ui/external';
export * from '@cuberoot/shared/timer/external/stackmat-state';
export function createStackmatMicSource() { return mayUseMiniProgramBridge() ? createMiniProgramStackmatSource() : createBrowserStackmat(); }
