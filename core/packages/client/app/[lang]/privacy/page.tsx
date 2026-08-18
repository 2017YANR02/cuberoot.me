'use client';

import { useT } from '@/hooks/useT';
import './privacy.css';

export default function PrivacyPage() {
  const t = useT();

  return (
    <main className="privacy-page">
      <h1>{t('CubeRoot 移动端与小程序隐私政策', 'CubeRoot Mobile and Mini Program Privacy Policy')}</h1>
      <p className="privacy-updated">{t('生效日期:2026-08-16', 'Effective date: August 16, 2026')}</p>
      <p>
        {t(
          '本政策适用于 CubeRoot 官方 Android、iOS App 与微信小程序。App 的核心计时功能可离线使用;小程序的公开内容可不登录浏览,只有在你主动选择微信登录时才会创建或识别 CubeRoot 账号。',
          'This policy applies to the official CubeRoot Android and iOS apps and the WeChat Mini Program. Core app timer features work offline, and public Mini Program content can be viewed without signing in. A CubeRoot account is created or recognized only when you actively choose WeChat sign-in.',
        )}
      </p>

      <h2>{t('App 处理的数据', 'Data handled by the app')}</h2>
      <ul>
        <li>{t('计时记录、打乱、罚时、备注和偏好设置只保存在设备本地。', 'Solve times, scrambles, penalties, comments, and preferences are stored only on your device.')}</li>
        <li>{t('App 会读取网络连接状态,仅用于显示在线或离线状态。', 'The app reads network connection status only to show whether the device is online or offline.')}</li>
        <li>{t('App 不包含广告或分析 SDK,也不使用摄像头、麦克风或定位权限。', 'The app contains no advertising or analytics SDK and does not use camera, microphone, or location permissions.')}</li>
      </ul>

      <h2>{t('小程序与账号数据', 'Mini Program and account data')}</h2>
      <ul>
        <li>
          {t(
            '只有在你点击“微信登录”后,小程序才会调用微信登录能力,并将一次性登录凭证发送到 CubeRoot 服务器。服务器与微信交换账号标识,用同一开放平台下的 UnionID 识别你在网站与小程序中的同一账号。',
            'Only after you tap WeChat sign-in does the Mini Program request a one-time login code and send it to the CubeRoot server. The server exchanges it with WeChat and uses the UnionID under the same WeChat Open Platform account to recognize the same CubeRoot account across the website and Mini Program.',
          )}
        </li>
        <li>
          {t(
            '小程序不请求你的微信昵称、头像或手机号。登录后会在小程序本地保存 CubeRoot 会话凭证、账号显示名与 WCA ID,用于保持登录状态和显示账号信息。',
            'The Mini Program does not request your WeChat nickname, avatar, or phone number. After sign-in, it stores the CubeRoot session token, account display name, and WCA ID locally to maintain the session and show account information.',
          )}
        </li>
        <li>
          {t(
            '小程序原生外壳不包含广告或分析 SDK,也不调用定位、摄像头、麦克风、相册或通讯录权限。只有在你主动进入智能魔方连接页并点击搜索后,才会使用蓝牙发现并连接附近的兼容魔方。',
            'The native Mini Program shell contains no advertising or analytics SDK and does not access location, camera, microphone, photo library, or contacts. Bluetooth is used only after you open the Smart Cube page and tap search, to discover and connect to a nearby compatible cube.',
          )}
        </li>
        <li>
          {t(
            '连接期间,小程序读取兼容魔方发送的转动、状态、电量和姿态数据,并通过仅保存在服务器内存中的短时中继实时交给网页计时器。扫描列表、蓝牙地址和实时魔方数据不会写入数据库;断开连接或会话结束后,中继状态会被清除。',
            'While connected, the Mini Program reads moves, cube state, battery level, and orientation sent by the compatible cube, then delivers them to the web timer through a short-lived relay held only in server memory. Scan results, Bluetooth addresses, and live cube data are not written to the database; relay state is cleared after disconnection or session end.',
          )}
        </li>
      </ul>

      <h2>{t('网页内容与跨端登录', 'Web content and cross-platform sign-in')}</h2>
      <p>
        {t(
          '小程序使用 web-view 打开 cuberoot.me 上的计时器、公式库、比赛、百科、课程和账号页。已登录时,小程序可申请一个短时、单次使用的换票交给网页,使网页识别同一账号。长期会话凭证不会放入网址。服务器可处理 IP 地址、浏览器或设备类型等标准请求信息,仅用于提供服务、安全防护与故障诊断。',
          'The Mini Program uses web-view to open the timer, algorithm library, competitions, wiki, courses, and account pages on cuberoot.me. When signed in, it may issue a short-lived, single-use handoff ticket so the webpage can recognize the same account. Long-lived session tokens are never placed in the URL. The server may process standard request information such as IP address and browser or device type only to deliver the service, protect it, and diagnose failures.',
        )}
      </p>

      <h2>{t('备份与删除', 'Backups and deletion')}</h2>
      <p>
        {t(
          '只有在你主动导出时,App 才会创建 JSON 备份并交给系统分享或下载界面。App 不会自动上传备份。你可以删除活动记录中的单条成绩;通过系统设置清除 App 数据或卸载 App 会删除 App 保存的全部本地数据。导出文件由你选择的位置或接收方保管,需要由你自行删除。',
          'The app creates a JSON backup only when you choose Export and hands it to the system share or download interface. Backups are not uploaded automatically. You can delete individual solves from the active history; clearing app storage in system settings or uninstalling the app deletes all local data stored by the app. You control and must delete any exported copies from their chosen destination or recipient.',
        )}
      </p>

      <h2>{t('导入与本地恢复', 'Import and local recovery')}</h2>
      <p>
        {t(
          '当你主动选择 JSON 文件导入时,App 只在设备上读取并校验该文件,然后把有效数据保存到 App 的本地数据库。替换前的有效数据会在本地保留为一次撤销恢复点,因此之后从活动记录删除的成绩仍可能存在于该恢复点中。使用一次“撤销导入”会删除恢复点;下一次成功导入会替换它;清除 App 数据或卸载 App 会将它一并删除。导入文件和恢复点都不会由 App 上传。',
          'When you choose a JSON file to import, the app reads and validates it only on the device, then stores valid data in the app’s local database. Valid data replaced by the import is retained locally as a one-time undo recovery point, so a solve later deleted from the active history may still remain in that recovery point. Using Undo import deletes the recovery point, the next successful import replaces it, and clearing app storage or uninstalling the app deletes it with all other local data. Neither the imported file nor the recovery point is uploaded by the app.',
        )}
      </p>

      <h2>{t('安全、退出与删除', 'Security, sign-out, and deletion')}</h2>
      <p>
        {t(
          'App 使用操作系统提供的应用隔离存储,并在导入或保存前校验数据结构和大小。你可以在小程序“我的”页退出登录并清除小程序本地会话;账号绑定与账号删除继续使用网站的统一账号管理页,不在小程序内复制第二套流程。CubeRoot 无法控制设备本身、系统备份或你导出文件的安全性;请为设备设置锁屏并谨慎选择备份接收方。',
          'The app uses operating-system app-isolated storage and validates data structure and size before importing or saving it. You can sign out on the Mini Program Account page to clear its local session. Account links and account deletion continue to use the website’s single account management page rather than a duplicate Mini Program flow. CubeRoot cannot control the security of your device, operating-system backups, or exported files; use a device lock and choose backup recipients carefully.',
        )}
      </p>

      <h2>{t('网站与第三方链接', 'Website and third-party links')}</h2>
      <p>
        {t(
          'App 中的“完整网站”会在系统浏览器中打开 cuberoot.me,小程序会在微信 web-view 中打开同一网站。你主动打开的第三方链接由对应的第三方负责,请同时查看它们的隐私说明。',
          'The app opens cuberoot.me in the system browser, while the Mini Program opens the same website in WeChat web-view. Third-party links you actively open are operated by their respective providers; review their privacy information as well.',
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
