import { createWebViewPageOptions } from '../../lib/web-view-page';
declare const __MINI_PROGRAM_TARGET__: 'wechat' | 'douyin';

// Compile-time branch keeps native solver/BLE initializers out of the WeChat bundle.
if (typeof __MINI_PROGRAM_TARGET__ !== 'undefined' && __MINI_PROGRAM_TARGET__ === 'douyin') {
  const { createNativeTimerPageOptions } = require('../../lib/native-timer-page') as typeof import('../../lib/native-timer-page');
  Page(createNativeTimerPageOptions());
} else Page(createWebViewPageOptions('timer'));
