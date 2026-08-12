'use client';

import { useT } from '@/hooks/useT';
import './privacy.css';

export default function PrivacyPage() {
  const t = useT();

  return (
    <main className="privacy-page">
      <h1>{t('CubeRoot 移动端隐私政策', 'CubeRoot Mobile Privacy Policy')}</h1>
      <p className="privacy-updated">{t('生效日期:2026-08-12', 'Effective date: August 12, 2026')}</p>
      <p>
        {t(
          '本政策适用于 CubeRoot 官方 Android 与 iOS App。App 的核心计时功能可离线使用,不要求注册账号。',
          'This policy applies to the official CubeRoot Android and iOS apps. Core timer features work offline and do not require an account.',
        )}
      </p>

      <h2>{t('App 处理的数据', 'Data handled by the app')}</h2>
      <ul>
        <li>{t('计时记录、打乱、罚时、备注和偏好设置只保存在设备本地。', 'Solve times, scrambles, penalties, comments, and preferences are stored only on your device.')}</li>
        <li>{t('App 会读取网络连接状态,仅用于显示在线或离线状态。', 'The app reads network connection status only to show whether the device is online or offline.')}</li>
        <li>{t('App 不包含广告或分析 SDK,也不使用摄像头、麦克风或定位权限。', 'The app contains no advertising or analytics SDK and does not use camera, microphone, or location permissions.')}</li>
      </ul>

      <h2>{t('备份与删除', 'Backups and deletion')}</h2>
      <p>
        {t(
          '只有在你主动导出时,App 才会创建 JSON 备份并交给系统分享或下载界面。App 不会自动上传备份。你可以删除单条记录,也可以通过系统设置清除 App 数据或卸载 App 来删除全部本地数据。',
          'The app creates a JSON backup only when you choose Export and hands it to the system share or download interface. Backups are not uploaded automatically. You can delete individual solves or remove all local data by clearing app storage in system settings or uninstalling the app.',
        )}
      </p>

      <h2>{t('外部网站', 'External website')}</h2>
      <p>
        {t(
          'App 中的“完整网站”和隐私政策链接会在系统浏览器中打开 cuberoot.me。浏览器中的网站功能、账号登录以及你主动访问的第三方链接,不属于 App 的本地离线计时数据。',
          'The Full website and privacy links open cuberoot.me in the system browser. Website features, account sign-in, and third-party links you choose to visit are separate from the app’s local offline timer data.',
        )}
      </p>

      <h2>{t('联系我们', 'Contact')}</h2>
      <p>
        {t('如有隐私或支持问题,请发送邮件至 ', 'For privacy or support questions, email ')}
        <a href="mailto:yrmfxc@gmail.com">yrmfxc@gmail.com</a>{t('。', '.')}
      </p>
    </main>
  );
}
