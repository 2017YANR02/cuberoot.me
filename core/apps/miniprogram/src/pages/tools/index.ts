import { createWebViewPageOptions } from '../../lib/web-view-page';
declare const __MINI_PROGRAM_TARGET__: 'wechat' | 'douyin';

if (typeof __MINI_PROGRAM_TARGET__ !== 'undefined' && __MINI_PROGRAM_TARGET__ === 'douyin') {
  const { createNativeToolsPageOptions } = require('../../lib/native-tools-page') as typeof import('../../lib/native-tools-page');
  Page(createNativeToolsPageOptions());
} else Page(createWebViewPageOptions('home'));
