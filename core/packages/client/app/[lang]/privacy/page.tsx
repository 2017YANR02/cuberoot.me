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
          '只有在你主动导出时,App 才会创建 JSON 备份并交给系统分享或下载界面。App 不会自动上传备份。数据保留在设备上,直到你删除单条记录、通过系统设置清除 App 数据或卸载 App。导出文件由你选择的位置或接收方保管,需要由你自行删除。',
          'The app creates a JSON backup only when you choose Export and hands it to the system share or download interface. Backups are not uploaded automatically. Data remains on your device until you delete individual solves, clear app storage in system settings, or uninstall the app. You control and must delete any exported copies from their chosen destination or recipient.',
        )}
      </p>

      <h2>{t('导入与本地恢复', 'Import and local recovery')}</h2>
      <p>
        {t(
          '当你主动选择 JSON 文件导入时,App 只在设备上读取并校验该文件,然后把有效数据保存到 App 的本地数据库。替换前的有效数据会在本地保留为一次撤销恢复点;导入文件和恢复点都不会由 App 上传。',
          'When you choose a JSON file to import, the app reads and validates it only on the device, then stores valid data in the app’s local database. Valid data replaced by the import is retained locally as a one-time undo recovery point. Neither the imported file nor the recovery point is uploaded by the app.',
        )}
      </p>

      <h2>{t('安全处理', 'Security')}</h2>
      <p>
        {t(
          'App 使用操作系统提供的应用隔离存储,并在导入或保存前校验数据结构和大小。CubeRoot 无法控制设备本身、系统备份或你导出文件的安全性;请为设备设置锁屏并谨慎选择备份接收方。',
          'The app uses operating-system app-isolated storage and validates data structure and size before importing or saving it. CubeRoot cannot control the security of your device, operating-system backups, or exported files; use a device lock and choose backup recipients carefully.',
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
        {t('本 App 由商店页面列明的 CubeRoot 发布主体运营。如有隐私或支持问题,请发送邮件至 ', 'This app is operated by the CubeRoot publisher identified on its store listing. For privacy or support questions, email ')}
        <a href="mailto:yrmfxc@gmail.com">yrmfxc@gmail.com</a>{t('。', '.')}
      </p>
    </main>
  );
}
