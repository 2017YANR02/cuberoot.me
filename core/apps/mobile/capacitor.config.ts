import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'me.cuberoot.app',
  appName: 'CubeRoot',
  webDir: process.env.CUBEROOT_PUSH_ACCEPTANCE === '1' ? 'dist-push-acceptance' : 'dist',
};

export default config;
