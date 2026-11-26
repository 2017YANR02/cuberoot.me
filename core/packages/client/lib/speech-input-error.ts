const SPEECH_ERRORS: Record<string, { zh: string; en: string }> = {
  unsupported: { zh: '此浏览器不支持网页语音输入，请使用键盘上的听写功能或直接输入文字。', en: 'This browser does not support voice input. Use keyboard dictation or type instead.' },
  'not-allowed': { zh: '麦克风访问被拒绝，请检查网站和系统的麦克风权限。', en: 'Microphone access was denied. Check microphone permissions for this site and your system.' },
  'audio-capture': { zh: '无法获取麦克风声音，请检查输入设备。', en: 'Cannot capture audio. Check your microphone input device.' },
  'device-not-found': { zh: '没有找到可用的麦克风，请连接设备或检查默认输入设备。', en: 'No microphone was found. Connect one or check your default input device.' },
  'device-unreadable': { zh: '无法读取麦克风，请检查设备连接或关闭正在占用它的应用后重试。', en: 'The microphone could not be read. Check its connection or close apps using it and retry.' },
  'device-timeout': { zh: '网站已获授权，但麦克风没有启动。请检查系统的麦克风权限和输入设备。', en: 'Site access is allowed, but the microphone did not start. Check your system microphone permissions and input device.' },
  'capture-timeout': { zh: '浏览器未返回麦克风输入，请检查麦克风权限和输入设备后重试。', en: 'The browser did not provide microphone input. Check microphone permissions and your input device, then retry.' },
  network: { zh: '无法连接语音识别服务，请重试，或使用键盘上的听写功能。', en: 'Cannot connect to speech recognition. Retry or use keyboard dictation.' },
  'no-speech': { zh: '没有识别到文字，请检查麦克风是否静音、输入设备是否正确，然后重试。', en: 'No words were recognized. Check that the correct microphone is selected and unmuted, then retry.' },
  timeout: { zh: '语音识别长时间没有返回结果，已停止。请重试，或使用键盘上的听写功能。', en: 'Speech recognition did not respond in time and has stopped. Retry or use keyboard dictation.' },
  'language-not-supported': { zh: '语音服务不支持当前语言，请使用键盘上的听写功能。', en: 'The speech service does not support this language. Use keyboard dictation.' },
  'service-not-allowed': { zh: '浏览器的语音识别服务不可用，请使用键盘上的听写功能或直接输入文字。', en: 'The browser speech service is unavailable. Use keyboard dictation or type instead.' },
  aborted: { zh: '语音识别已中断，请重试。', en: 'Speech recognition was interrupted. Please retry.' },
};

export function speechInputError(reason: string) {
  return SPEECH_ERRORS[reason] ?? {
    zh: `语音识别失败（${reason}），请重试。`,
    en: `Speech recognition failed (${reason}). Try again.`,
  };
}
