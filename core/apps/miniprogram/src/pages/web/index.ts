import { createWebViewPageOptions } from '../../lib/web-view-page';
import { createNativeRoutePageOptions } from '../../lib/native-route-page';
declare const __MINI_PROGRAM_TARGET__: 'wechat' | 'douyin';

if (typeof __MINI_PROGRAM_TARGET__ === 'string' && __MINI_PROGRAM_TARGET__ === 'douyin') Page(createNativeRoutePageOptions());
else Page(createWebViewPageOptions());
