export type UserAgentEngineFamily = 'chromium' | 'webkit' | 'gecko' | 'other';
export type UserAgentOsFamily = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'other';
export type UserAgentContainer = 'wechat' | 'webview' | 'browser';
export type UserAgentDeviceType = 'phone' | 'tablet' | 'desktop' | 'other';
export type UserAgentBrowserFamily = 'chrome' | 'edge' | 'firefox' | 'safari' | 'wechat' | 'webview' | 'other';

export interface UserAgentDimensions {
  deviceType: UserAgentDeviceType;
  osFamily: UserAgentOsFamily;
  osMajor: number | null;
  browserFamily: UserAgentBrowserFamily;
  browserMajor: number | null;
  engineFamily: UserAgentEngineFamily;
  engineMajor: number | null;
  container: UserAgentContainer;
}

function majorVersion(userAgent: string, pattern: RegExp): number | null {
  const match = userAgent.match(pattern);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) ? value : null;
}

function webkitVersion(userAgent: string): { major: number; minor: number } | null {
  const match = userAgent.match(/Version\/(\d+)(?:\.(\d+))?/i);
  if (!match?.[1]) return null;
  return { major: Number(match[1]), minor: Number(match[2] ?? 0) };
}

function iosVersion(userAgent: string): { major: number; minor: number } | null {
  const match = userAgent.match(/(?:CPU (?:iPhone )?OS|iPhone OS) (\d+)[._](\d+)/i);
  if (match?.[1]) return { major: Number(match[1]), minor: Number(match[2] ?? 0) };
  return webkitVersion(userAgent);
}

/** Derive privacy-safe, coarse device dimensions. The raw User-Agent is never returned or retained. */
export function classifyUserAgent(userAgent: string): UserAgentDimensions {
  const ios = /iPhone|iPad|iPod/i.test(userAgent) || /Macintosh[^)]*Mobile/i.test(userAgent);
  const android = /Android/i.test(userAgent);
  const wechat = /MicroMessenger/i.test(userAgent);
  const androidWebView = android && (/;\s*wv[;) ]/i.test(userAgent) || /Version\/4\.0[^)]*Chrome\//i.test(userAgent));
  const detectedIosVersion = ios ? iosVersion(userAgent) : null;

  let deviceType: UserAgentDeviceType = 'other';
  if (/iPad/i.test(userAgent) || /Macintosh[^)]*Mobile/i.test(userAgent) || (android && !/Mobile/i.test(userAgent))) {
    deviceType = 'tablet';
  } else if (/iPhone|iPod/i.test(userAgent) || (android && /Mobile/i.test(userAgent))) {
    deviceType = 'phone';
  } else if (/Windows NT|Mac OS X|Linux|CrOS/i.test(userAgent)) {
    deviceType = 'desktop';
  }

  let osFamily: UserAgentOsFamily = 'other';
  let osMajor: number | null = null;
  if (ios) {
    osFamily = 'ios';
    osMajor = detectedIosVersion?.major ?? null;
  } else if (android) {
    osFamily = 'android';
    osMajor = majorVersion(userAgent, /Android (\d+)/i);
  } else if (/Windows NT/i.test(userAgent)) {
    osFamily = 'windows';
    osMajor = majorVersion(userAgent, /Windows NT (\d+)/i);
  } else if (/Mac OS X/i.test(userAgent)) {
    osFamily = 'macos';
    osMajor = majorVersion(userAgent, /Mac OS X (\d+)[._]/i);
  } else if (/Linux|CrOS/i.test(userAgent)) {
    osFamily = 'linux';
  }

  const safariVersion = webkitVersion(userAgent);
  const edgeMajor = majorVersion(userAgent, /EdgA?\/(\d+)/i);
  const chromiumMajor = majorVersion(userAgent, /(?:CriOS|Chrome|Chromium)\/(\d+)/i);
  const firefoxMajor = majorVersion(userAgent, /(?:FxiOS|Firefox)\/(\d+)/i);

  let engineFamily: UserAgentEngineFamily = 'other';
  let engineMajor: number | null = null;
  if (ios) {
    engineFamily = 'webkit';
    engineMajor = safariVersion?.major ?? null;
  } else if (edgeMajor !== null || chromiumMajor !== null) {
    engineFamily = 'chromium';
    engineMajor = edgeMajor ?? chromiumMajor;
  } else if (firefoxMajor !== null) {
    engineFamily = 'gecko';
    engineMajor = firefoxMajor;
  } else if (/AppleWebKit/i.test(userAgent)) {
    engineFamily = 'webkit';
    engineMajor = safariVersion?.major ?? null;
  }

  let browserFamily: UserAgentBrowserFamily = 'other';
  let browserMajor: number | null = null;
  if (wechat) {
    browserFamily = 'wechat';
    browserMajor = majorVersion(userAgent, /MicroMessenger\/(\d+)/i);
  } else if (androidWebView) {
    browserFamily = 'webview';
    browserMajor = chromiumMajor;
  } else if (edgeMajor !== null) {
    browserFamily = 'edge';
    browserMajor = edgeMajor;
  } else if (firefoxMajor !== null) {
    browserFamily = 'firefox';
    browserMajor = firefoxMajor;
  } else if (chromiumMajor !== null) {
    browserFamily = 'chrome';
    browserMajor = chromiumMajor;
  } else if (/Safari\//i.test(userAgent) && safariVersion) {
    browserFamily = 'safari';
    browserMajor = safariVersion.major;
  }

  return {
    deviceType,
    osFamily,
    osMajor,
    browserFamily,
    browserMajor,
    engineFamily,
    engineMajor,
    container: wechat ? 'wechat' : androidWebView ? 'webview' : 'browser',
  };
}

export { iosVersion, webkitVersion };
