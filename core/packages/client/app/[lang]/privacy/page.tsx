'use client';

import { useT } from '@/hooks/useT';
import './privacy.css';

export default function PrivacyPage() {
  const t = useT();

  return (
    <main className="privacy-page">
      <h1>{t('CubeRoot 用户协议与隐私政策', 'CubeRoot User Agreement and Privacy Policy')}</h1>
      <p className="privacy-updated">{t('生效日期:2026-09-29', 'Effective date: September 29, 2026')}</p>
      <p>
        {t(
          '本政策适用于 CubeRoot 网站、官方 App（Android、iOS、HarmonyOS、Windows 和 macOS）以及微信与抖音小程序，包括其中打开的 CubeRoot 在线页面。各端可用功能和系统权限可能不同；下文按功能说明数据处理，不表示每个平台都提供全部功能。App 的核心离线计时无需登录；账号、社区、教学、订单等在线功能会按你的操作处理相应数据。',
          'This policy covers the CubeRoot website, official apps for Android, iOS, HarmonyOS, Windows and macOS, and WeChat and Douyin Mini Programs, including CubeRoot online pages opened within them. Features and system permissions vary by platform; the descriptions below do not mean every platform offers every feature. Core offline timing works without sign-in. Account, community, teaching, order and other online features process the relevant data when you use them.',
        )}
      </p>

      <h2 id="user-agreement">{t('用户协议', 'User Agreement')}</h2>
      <p>
        {t(
          '使用 CubeRoot 即表示你同意依法、合理地使用服务，不干扰服务运行、不侵害他人权益，也不利用服务发布违法或有害内容。登录不是使用公开工具和离线 App 计时器的前提；需要账号的功能由你主动登录后使用。功能可能因维护、平台规则或安全需要调整。你可以随时停止使用，并通过网站账号管理入口申请注销账号。',
          'By using CubeRoot, you agree to use the service lawfully and reasonably, without disrupting it, infringing others’ rights, or publishing unlawful or harmful content. Sign-in is not required for public tools or the offline app timer; you choose to sign in only for account features. Features may change for maintenance, platform rules, or security. You may stop using the service at any time and request account deletion through website account management.',
        )}
      </p>

      <h2 id="privacy-policy">{t('隐私政策：App 处理的数据', 'Privacy Policy: Data handled by the app')}</h2>
      <ul>
        <li>{t('普通离线计时的记录、打乱、罚时、备注和偏好设置保存在设备本地，不因登录而自动上传或跨设备同步。主动分享、发布或参加联网对战时，相关数据按下文所述发送。', 'Ordinary offline solve records, scrambles, penalties, comments and preferences stay on your device; signing in does not automatically upload or synchronize them. When you choose to share, publish or join an online battle, the relevant data is transmitted as described below.')}</li>
        <li>{t('App 会读取网络连接状态,用于显示在线或离线状态以及安排比赛打乱刷新。', 'The app reads network connection status to show whether the device is online or offline and to schedule competition-scramble refreshes.')}</li>
        <li>
          {t(
            'App 会自动从 CubeRoot API 下载公开的三阶比赛打乱,并在设备上最多缓存 50 条、最长 7 天。请求不会包含你的计时记录、备注或设置;服务器会处理并记录 IP 地址、设备或客户端类型等标准请求信息,用于提供服务、安全防护和故障诊断。',
            'The app automatically downloads public 3×3 competition scrambles from the CubeRoot API and caches at most 50 on the device for up to seven days. Requests do not include your solve times, comments, or settings. The server processes and logs standard request information such as IP address and device or client type to deliver the service, protect it, and diagnose failures.',
          )}
        </li>
        <li>{t('普通计时不需要摄像头或麦克风。你主动使用音视频通话、拍摄或媒体上传时，相应页面可能请求系统权限或打开文件选择器；拒绝不会影响普通计时。Android 11 及以下版本可能把蓝牙扫描兼容授权显示为定位权限，计时器不使用扫描结果推断位置。地区资料和服务器 IP 地域处理与蓝牙扫描无关，详见下文。', 'Ordinary timing does not require a camera or microphone. When you choose audio/video calls, capture or media uploads, the relevant page may request system permissions or open a file picker; declining does not affect ordinary timing. Android 11 and earlier may present Bluetooth scanning compatibility access as a location permission; the timer does not infer location from scan results. Profile regions and server-side IP region processing are separate from Bluetooth scanning and are described below.')}</li>
        <li>
          {t(
            '只有在你点击连接智能魔方后,App 才会请求附近设备或蓝牙权限,扫描并连接你选择的兼容魔方。蓝牙扫描不用于确定或记录位置;拒绝授权不会影响普通计时。',
            'Only after you tap Connect smart cube does the app request Nearby devices or Bluetooth access to scan for and connect to a compatible cube you select. Bluetooth scanning is not used to determine or record location, and denying access does not affect ordinary timing.',
          )}
        </li>
        <li>
          {t(
            '连接期间,App 在设备本地读取并处理魔方名称、蓝牙地址、转动和状态,用于协议解密、显示打乱进度和自动计时。扫描列表与连接地址不会自动上传或写入成绩库,断开连接或关闭 App 后从运行内存清除。成绩会在本机保存转动记录、设备型号和名称;开启“记录姿态”时也保存该次还原的姿态轨迹,用于复盘。设备名称可能含设备标识。你可以在设置中关闭姿态记录,也可以删除对应成绩。',
            'While connected, the app processes the cube name, Bluetooth address, turns, and state locally for protocol decryption, scramble progress, and automatic timing. Scan results and connection addresses are not automatically uploaded or written to the solve database and are cleared from runtime memory after disconnection or app exit. Solves retain turns, device model and name locally; when Record orientation is enabled, they also retain that solve’s orientation track for replay. Device names may contain device identifiers. You can turn off orientation recording in Settings or delete the corresponding solve.',
          )}
        </li>
      </ul>

      <h2>{t('纪录订阅与通知', 'Record subscriptions and notifications')}</h2>
      <p>{t(
        '纪录订阅在网站与 App 共用，可在「消息」调整项目、单次/平均、纪录级别和地区。绑定 WCA 后，本人纪录自动纳入。邮件通过既有邮件服务发送到已验证邮箱，并尊重邮件总开关。Android 推送仅在服务已配置、你同意推送用途且允许系统通知后启用；拒绝不影响计时和站内消息，可在系统设置关闭通知。',
        'Record subscriptions are shared by the website and apps. In Notifications you can choose events, single/average, record levels and regions. Records belonging to your linked WCA identity are included automatically. Email uses the existing email service, a verified address and your email switch. Android push starts only when configured, after your consent and system notification permission. Declining does not affect timing or the inbox; system settings let you disable notifications.',
      )}</p>
      <p>{t(
        'Android 使用每日互动股份有限公司的个推消息推送 SDK 及核心组件，配置相应通道时也使用手机厂商推送 SDK，以投递通知并统计投递结果。SDK 会处理推送标识、设备与应用信息、网络信息；具体字段以及可选的设备标识和位置相关信息以个推隐私政策及实际系统授权为准。个推还附带中互智安（北京）科技有限公司的卓信 ID SDK，用于设备识别与安全风控，可能处理设备特征和应用信息。CubeRoot 关闭个推的智能、应景、应急推送和跨应用链路合并扩展。通知正文为公开比赛纪录，可能显示在锁屏上。',
        'Android uses the Getui push SDK and core component from Daily Interactive Co., Ltd., plus manufacturer push SDKs when those channels are configured, to deliver notifications and report delivery results. The SDK processes push identifiers, device and application information, and network information. Specific fields and optional device identifiers or location-related information depend on Getui’s policy and system permissions. Getui also bundles the ZX ID SDK from Zhonghu Zhian (Beijing) Technology Co., Ltd. for device identification and security checks, which may process device characteristics and application information. CubeRoot disables Getui’s personalized, location-based and emergency push extensions and cross-app link merging. Notification text contains public competition records and may appear on the lock screen.',
      )} <a href="https://docs.getui.com/privacy/" target="_blank" rel="noopener noreferrer">{t('个推隐私政策', 'Getui privacy policy')}</a>{' '}<a href="https://zxid.mobileservice.cn/privacy" target="_blank" rel="noopener noreferrer">{t('卓信 ID 隐私政策', 'ZX ID privacy policy')}</a></p>
      <p>{t(
        '服务器保存账号与设备推送标识的绑定；定期清理连续 30 天未刷新的绑定和 7 天前的投递队列条目。退出此 App 时关闭本机推送并撤销绑定；断网时在安全存储保留仅能撤销该设备的凭据，联网后重试。删除账号会删除设备绑定。已经交给系统或厂商的通知可能仍在队列中。iOS 纪录推送已接入源码但尚未开放；启用时通过 Apple APNs 处理设备推送标识、应用标识和公开纪录通知，开发与生产环境隔离，设备绑定沿用上述退出、注销和清理规则。其他宿主的系统推送尚未开放。',
        'The server stores the account-to-push-device binding and periodically removes bindings not refreshed for 30 days and delivery queue entries older than seven days. Signing out stops local push and revokes the binding. Offline, secure storage retains a credential that can only revoke that device, for retry when online. Account deletion removes device bindings. Notifications already handed to the system or manufacturer may remain queued. The iOS record channel is implemented but not enabled yet. When enabled, Apple APNs processes device push tokens, the app identifier, and public record notifications. Sandbox and production are isolated, and device bindings follow the sign-out, deletion, and cleanup rules above. System push on other hosts is not enabled yet.',
      )}</p>

      <p>{t('微信小程序中，只有点击连接外接计时器后才会使用蓝牙；只有点击启动 Stackmat 音频输入后才会申请麦克风权限。有线输入音频在本机实时解码，不上传音频。设备名称、计时状态与读数通过短时内存中继交给网页计时器；断开连接后停止采集，录音中断或达到 10 分钟上限后需重新连接。拒绝权限不影响普通计时。', 'In the WeChat Mini Program, Bluetooth is used only after you choose to connect an external timer; microphone permission is requested only when you start Stackmat audio input. Wired audio is decoded locally and is not uploaded. The device name, timer state, and reading are passed to the web timer through a short-lived in-memory relay. Disconnecting stops capture; reconnect after an interruption or the 10-minute recording limit. Denying permission does not affect ordinary timing.')}</p>

      <h2>{t('App、小程序与账号数据', 'App, Mini Program, and account data')}</h2>
      <ul>
        <li>
          {t(
            '当 Apple 登录已开放且你主动选择登录或绑定时,服务器会验证 Apple 返回的凭据,保存 Apple 账号标识和加密的授权令牌,用于维护绑定和撤销授权。此流程不保存 Apple 返回的姓名或邮箱,也不按邮箱自动合并已有账号。解除 Apple 绑定或注销该账号时,需先完成 Apple 授权撤销;失败时会保留必要记录供你重试。',
            'When Apple sign-in is available and you choose to sign in or link it, the server verifies Apple’s credentials and stores the Apple account identifier and encrypted authorization token to maintain the link and revoke authorization. This flow does not store the name or email returned by Apple or automatically merge accounts by email. Unlinking Apple or deleting that account requires successful Apple authorization revocation first; if it fails, necessary records are retained so you can retry.',
          )}
        </li>
        <li>
          {t(
            '只有在你主动登录或绑定账号时,App 才会在系统浏览器打开 CubeRoot 网站的统一账号流程,使用当时已启用的邮箱、手机号或第三方登录方式。登录回到 App 时使用短时、单次使用且与本次请求绑定的换票;账号绑定在独立浏览器会话中完成。长期会话凭证不会放入网址。',
            'Only when you choose to sign in or link an account does the app open CubeRoot’s shared account flow in the system browser, using the email, phone, or third-party sign-in methods currently enabled. Sign-in returns to the app through a short-lived, single-use handoff ticket bound to that request; account linking takes place in a separate browser session. Long-lived session tokens are never placed in URLs.',
          )}
        </li>
        <li>
          {t(
            '登录后，iOS 和 Android App 将会话凭证和账号资料保存在由 Keychain 或 Keystore 保护的安全存储中，其他宿主使用相应的系统安全存储。App 向 CubeRoot API 校验账号并按需刷新凭证。登录本身不会上传普通离线计时的记录、备注和设置；在线功能的数据另行保存到服务器。',
            'After sign-in, the iOS and Android apps keep session credentials and account profiles in storage protected by Keychain or Keystore; other hosts use their corresponding secure storage. The app validates the account with the CubeRoot API and refreshes credentials as needed. Signing in itself does not upload ordinary offline solve records, comments or settings; online features separately store their data on the server.',
          )}
        </li>
        <li>
          {t(
            '只有在你点击“微信登录”后,小程序才会调用微信登录能力,并将一次性登录凭证发送到 CubeRoot 服务器。服务器与微信交换账号标识,用同一开放平台下的 UnionID 识别你在网站与小程序中的同一账号。',
            'Only after you tap WeChat sign-in does the Mini Program request a one-time login code and send it to the CubeRoot server. The server exchanges it with WeChat and uses the UnionID under the same WeChat Open Platform account to recognize the same CubeRoot account across the website and Mini Program.',
          )}
        </li>
        <li>
          {t(
            '只有在你点击“抖音登录”后,抖音小程序才会将一次性登录凭证发送到 CubeRoot 服务器,由服务器换取抖音 openid。未绑定身份需由你明确选择创建账号或验证并绑定原账号,不会按昵称或其他资料猜测合并账号。',
            'Only after you tap Douyin sign-in does the Douyin Mini Program send a one-time login code to the CubeRoot server, which exchanges it for a Douyin openid. An unlinked identity requires you to explicitly create an account or verify and link an existing one. Accounts are never merged by guessing from names or other profile data.',
          )}
        </li>
        <li>
          {t(
            '小程序不请求你的微信或抖音昵称和头像。微信首次未绑定时,你可以主动选择手机号实时验证授权。服务器向微信验证一次性凭证及所属小程序、当前微信用户,用取得的手机号查找原账号；你确认后才将手机号和微信绑定至同一账号。手机号未匹配时不会自动注册,也不会自动合并两个账号。拒绝或无法授权时可使用其他方式登录原账号,不影响公开工具和普通计时。抖音不请求手机号。',
            'The Mini Programs do not request your WeChat or Douyin nickname or avatar. For an unlinked WeChat identity, you may choose real-time phone authorization. The server verifies the one-time credential, app and current WeChat user with WeChat, then uses the phone number to find an existing account. Phone and WeChat identities are linked to one account only after confirmation. No match never triggers automatic registration, and two accounts are never merged automatically. If authorization is declined or unavailable, other existing-account sign-in methods remain available; public tools and ordinary timing are unaffected. Douyin does not request a phone number.',
          )}
        </li>
        <li>{t(
          '未完成的微信手机号认证资料仅在服务器的短期认证记录中保留,15 分钟过期并定期清理；成功后只在原账号身份表保存必要的手机号与微信标识,直到换绑、解绑或注销按对应流程删除。小程序不持久化手机号授权码或待确认票据；登录后在本地保存 CubeRoot 会话凭证和账号资料,用于保持登录状态。',
          'Unfinished WeChat phone verification data is held only in short-lived server authentication records, expiring after 15 minutes with periodic cleanup. After completion, necessary phone and WeChat identifiers remain in the existing account identity table until replacement, unlinking or account deletion removes them through the corresponding flow. The Mini Program does not persist phone authorization codes or pending tickets; after sign-in it stores the CubeRoot session token and account profile locally to maintain the session.',
        )}</li>
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
          'App 的工具和账号页面以及小程序中的部分功能使用 CubeRoot 在线页面。已登录时，可通过短时、单次使用的换票使网页识别同一账号，长期会话凭证不会放入网址。这些页面产生的账号资料、内容、订单和使用记录同样受本政策约束，不属于“全部仅在本地”的离线计时数据。',
          'App tools and account pages, and some Mini Program features, use CubeRoot online pages. A short-lived, single-use handoff ticket can let these pages recognize the signed-in account; long-lived session tokens are not placed in URLs. Account details, content, orders and usage records from these pages are covered by this policy and are separate from local-only offline timing data.',
        )}
      </p>

      <h2>{t('在线功能收集的信息与用途', 'Information collected by online features and its uses')}</h2>
      <ul>
        <li>{t('账号与资料：处理你提供或绑定的姓名、昵称、邮箱、手机号、头像、CubeRoot 用户标识、WCA 标识和第三方账号标识，以及你填写的生日、性别、国家、地区和城市，用于登录验证、展示资料、账号管理和提供相关功能。地区资料属于大致位置，并非 GPS 精确定位。', 'Accounts and profiles: we process names, nicknames, email addresses, phone numbers, avatars, CubeRoot user IDs, WCA IDs and linked third-party account IDs, plus any birth date, gender, country, region and city you provide, for authentication, profile display, account management and related features. Profile regions describe coarse location, not precise GPS location.')}</li>
        <li>{t('内容与交流：保存你上传或发布的图片、视频、音频、文章、帖子、回复、笔记、答题内容和评价，以及师生消息的发送方、接收方和正文，用于存储、展示、交流和内容管理。公开发布的内容及作者信息可被其他用户查看；师生交流内容向相应参与者提供。请勿在公开内容中包含不希望公开的个人信息。', 'Content and communication: we store uploaded or published images, videos, audio, articles, posts, replies, notes, answers and reviews, as well as senders, recipients and text of teacher–student messages, for storage, display, communication and content management. Public content and author information can be viewed by other users; teacher–student communication is provided to the relevant participants. Do not include personal information you do not want public in public posts.')}</li>
        <li>{t('音视频交流：主动加入音视频房间并启用摄像头、麦克风或屏幕分享时，媒体通过实时通信服务传输给房间参与者。实时传输不等于自动录制；当前通话流程没有自动录制存档。你另行上传的音视频文件则会保存到服务器，参与者也可能自行保存其接收到的内容。', 'Audio/video communication: when you join a room and enable your camera, microphone or screen sharing, media is transmitted to room participants through the real-time communication service. Live transmission is not automatic recording; the current call flow does not automatically archive recordings. Audio/video files you separately upload are stored on the server, and participants may independently save content they receive.')}</li>
        <li>{t('联网对战与学习：保存房间参与者、昵称或关联 WCA 标识、回合成绩、罚时和对战历史，以及课程进度、播放位置、完成状态和学习记录，用于对战、回看和教学。普通离线计时记录不会因为这些功能存在而全部上传。', 'Online battles and learning: we store room participants, nicknames or linked WCA IDs, round results, penalties and battle history, plus course progress, playback position, completion status and learning records, to support battles, history and teaching. These features do not cause all ordinary offline solve records to be uploaded.')}</li>
        <li>{t('订单与履约：保存订单、购买项目、金额、支付状态和交易关联标识，用于会员权益、订单查询、履约和售后。使用收货地址功能时，保存收件人、联系电话和地址；地址在服务器加密保存，但仍属于收集的数据。支付服务商按相应支付流程处理支付凭据。', 'Orders and fulfillment: we store orders, purchased items, amounts, payment status and transaction references to provide membership benefits, order history, fulfillment and after-sales support. Shipping-address features store recipient names, contact phone numbers and addresses. Addresses are encrypted on the server but are still collected data. Payment providers handle payment credentials through the applicable payment flow.')}</li>
        <li>{t('客服与反馈：保存反馈正文、联系方式、相关账号、客服对话，以及你附加的截图或视频。反馈还可能附带当前页面、语言、主题、窗口尺寸和浏览器信息，帮助重现问题、回复和排查故障。', 'Support and feedback: we store feedback text, contact details, the relevant account, support conversations and any screenshots or videos you attach. Feedback may also include the current page, language, theme, viewport size and browser information to help reproduce problems, respond and troubleshoot.')}</li>
      </ul>

      <h2>{t('请求日志、诊断与分析', 'Request logs, diagnostics and analytics')}</h2>
      <p>{t('访问在线服务时，服务器日志会记录 IP 地址、时间、请求路径及查询参数、来源页面、客户端信息、响应状态和请求耗时。查询参数可能包含你在应用内输入的搜索词。IP 地址可用于判断大致地域、安全限流和流量来源分析，不用于获取 GPS 精确位置。启动与错误诊断会处理事件标识、错误代码或消息、页面、网络状态和设备环境；这些信息用于维护服务、排查故障和改善性能。', 'When you access online services, server logs record IP addresses, timestamps, request paths and query parameters, referring pages, client information, response status and request duration. Query parameters may include searches you enter within the app. IP addresses may be used for coarse region checks, security rate limiting and traffic-source analysis, not precise GPS location. Startup and error diagnostics process event IDs, error codes or messages, pages, network status and device environment to maintain the service, investigate failures and improve performance.')}</p>
      <p>{t('我们使用账号、购买和产品使用记录进行用户、会员、订单及功能使用统计，使用请求日志分析流量和服务状态。部分可选分析受相应隐私设置控制；关闭可选分析不停止提供功能所必需的订单、学习进度、安全日志和诊断处理。网站集成 Vercel Web Analytics，只有该服务启用时才会收集对应访问事件；其开关与服务器日志相互独立。', 'We use account, purchase and product-interaction records for user, membership, order and feature-use statistics, and request logs to analyze traffic and service health. Some optional analytics are controlled by the relevant privacy settings; disabling optional analytics does not stop order processing, learning progress, security logs or diagnostics needed to provide features. The website integrates Vercel Web Analytics, which collects corresponding visit events only when enabled; its control is separate from server logging.')}</p>
      <p>{t('上述数据可能通过账号、内容作者、订单、请求或设备信息与你关联。加密保存或汇总展示不代表原始数据已匿名化。CubeRoot 不将这些数据与其他公司的数据结合用于定向广告或广告效果衡量，也不向数据经纪商提供这些数据。', 'The data described above may be linked to you through accounts, content authorship, orders, requests or device information. Encryption or aggregate display does not mean the source data is anonymous. CubeRoot does not combine this data with other companies’ data for targeted advertising or advertising measurement, or provide it to data brokers.')}</p>

      <h2>{t('服务提供方与信息共享', 'Service providers and sharing')}</h2>
      <p>{t('为提供所选功能，数据会由相关的服务器托管、存储、邮件或短信、身份验证、支付、实时通信和通知服务处理。第三方登录只在你选择相应方式时进行；邮件和短信服务处理验证或通知所需的联系方式与内容，支付服务处理交易所需的信息，实时通信服务处理房间连接与媒体。公开内容会按发布范围展示给其他用户；订单与教学资料向履约、教学或管理所需的相关角色提供。Android 推送的服务方与数据范围见上文，不能据此认为 iOS 也集成了这些推送 SDK。', 'Relevant hosting, storage, email or SMS, authentication, payment, real-time communication and notification services process data to deliver the features you choose. Third-party sign-in occurs when you select that method. Email and SMS services process contact details and content needed for verification or notifications; payment services process transaction information; real-time communication services process room connections and media. Public content is shown according to its publication scope, while order and teaching information is available to the relevant fulfillment, teaching or administrative roles. Android push providers and their data scope are described above; this does not mean those push SDKs are integrated into iOS.')}</p>

      <h2>{t('服务器数据保留与管理', 'Server retention and controls')}</h2>
      <p>{t('账号、已发布内容、消息、学习与对战记录、订单和客服记录按相关功能持续保存，不会因退出登录或卸载 App 而自动全部删除。不同数据采用不同的清理规则，没有适用于所有数据的统一自动删除期限。你可以通过功能内提供的编辑、删除、解绑和隐私设置管理数据，或联系下方邮箱提出查询、更正、导出或删除请求。账号注销按统一账号流程执行；公开内容、交易、客服及其他关联记录的处理范围需结合对应功能核实，不承诺注销会即时清除全部记录或备份。', 'Accounts, published content, messages, learning and battle history, orders and support records are retained for their respective features and are not all automatically deleted by signing out or uninstalling the app. Cleanup rules vary by data type; there is no single automatic deletion period for all data. Use available editing, deletion, unlinking and privacy controls, or contact the email below to request access, correction, export or deletion. Account deletion follows the shared account flow. The treatment of public content, transactions, support and other linked records depends on the relevant feature; account deletion does not promise immediate removal of every record or backup.')}</p>
      <p>{t('注销会删除账号及相应私有数据，并撤销相关身份绑定。部分公开内容会保留并调整作者关联；部分交易、教学消息和审计记录也会保留，其中可能仍有正文或姓名快照，不能视为完全匿名。注销前可能需要处理续费合约、转移机构所有权或完成第三方授权撤销。已下载、转发或由其他参与者保存的内容无法通过注销撤回；退出登录也不会删除这些服务器记录。', 'Account deletion removes the account and its corresponding private data and revokes relevant identity links. Some public content remains with adjusted authorship links. Some transactions, teaching messages and audit records also remain and may still contain text or name snapshots, so they are not necessarily anonymous. Deletion may require resolving recurring agreements, transferring organization ownership or revoking third-party authorization first. Copies downloaded, forwarded or retained by other participants cannot be recalled through account deletion; signing out does not delete these server records either.')}</p>

      <h2>{t('商店会员订阅', 'Store membership subscriptions')}</h2>
      <p>{t('Android 会员通过 Google Play 自动续费订阅购买（以商店开放状态为准）。Google 处理付款，CubeRoot 不接收银行卡信息。我们向 Google 提供随机的混淆账号标识，并保存购买 token、商品、到期时间和订阅状态，用于验单、权益、恢复、续费及退款处理；这些交易凭据不传给内嵌网页。恢复购买不会转绑账号；主动确认的账号合并会保留原购买归属标识。注销会解除账号关联并保留必要对账凭据，旧购买不能恢复到新账号。注销或卸载不会取消订阅，请先到 Google Play 取消自动续费。', 'Android memberships use Google Play auto-renewing subscriptions when available in the store. Google processes payment; CubeRoot does not receive payment-card information. We provide Google with a random obfuscated account identifier and retain purchase tokens, products, expiry dates and subscription states for verification, benefits, restoration, renewals and refunds. Transaction credentials are not sent to embedded web pages. Restoration cannot reassign a purchase; a confirmed account merge preserves its original ownership identifiers. Account deletion clears the account link but retains necessary accounting evidence, and old purchases cannot restore to a new account. Deleting the account or uninstalling does not cancel a subscription; cancel auto-renewal in Google Play first.')}</p>
      <p>{t(
        'iOS 会员月卡与年卡通过 Apple 自动续费订阅购买。购买前请登录要获得权益的 CubeRoot 账号；价格、周期和币种以 Apple 购买界面为准。费用由 Apple 向你的 Apple 账户收取，除非至少在当前周期结束前 24 小时取消，否则订阅自动续费。你可以通过 App 的“管理订阅”进入 Apple 设置取消续费，并通过“恢复购买”恢复同一 CubeRoot 账号的购买。注销 CubeRoot 账号不会自动取消 Apple 订阅，请先在 Apple 中取消。',
        'Monthly and yearly iOS memberships are Apple auto-renewable subscriptions. Sign in to the CubeRoot account that should receive the benefits before purchasing. The Apple purchase sheet shows the price, period, and currency. Apple charges your Apple Account, and the subscription renews automatically unless canceled at least 24 hours before the current period ends. Use Manage subscriptions in the app to cancel through Apple settings, or Restore purchases to restore purchases for the same CubeRoot account. Deleting your CubeRoot account does not cancel an Apple subscription; cancel it through Apple first.',
      )}</p>
      <p>{t(
        '为校验购买、提供会员权益并处理续期、退款及争议，CubeRoot 向 Apple 提交随机生成的账号关联标识，并保存 Apple 签名的交易记录、商品与交易标识、订阅状态、有效期及该标识与 CubeRoot 账号的关联。我们不接收你的银行卡号或 Apple 账户密码。账号注销后解除与账号的关联，必要的交易凭证仍保留用于财务核对和防止重复领取；不会用于广告追踪。Apple 自行处理付款与退款，适用 Apple 的条款和隐私政策。',
        'To verify purchases, provide membership benefits, and handle renewals, refunds, and disputes, CubeRoot sends Apple a randomly generated account association token. We retain Apple-signed transactions, product and transaction identifiers, subscription status and expiration, and the token’s link to your CubeRoot account. We do not receive your card number or Apple Account password. Account deletion removes the account link; necessary transaction evidence remains for financial reconciliation and prevention of duplicate claims, not advertising tracking. Apple handles payments and refunds under its own terms and privacy policy.',
      )}</p>

      <h2>{t('备份与删除', 'Backups and deletion')}</h2>
      <p>
        {t(
          '只有在你主动导出时,App 才会创建 JSON 备份并交给系统分享或下载界面。App 不会自动上传备份。你可以删除活动记录中的单条成绩;可使用应用或系统提供的数据清除操作移除本地计时数据。卸载是否移除全部应用数据取决于平台；导出副本、系统备份和安全存储需分别管理。导出文件由你选择的位置或接收方保管,需要由你自行删除。',
          'The app creates a JSON backup only when you choose Export and hands it to the system share or download interface. Backups are not uploaded automatically. You can delete individual solves from the active history; use available app or system data-clearing controls to remove local timing data. Whether uninstalling removes all app data depends on the platform; exported copies, system backups and secure storage need separate management. You control and must delete any exported copies from their chosen destination or recipient.',
        )}
      </p>

      <h2>{t('复盘分享', 'Replay sharing')}</h2>
      <p>
        {t(
          '主动分享复盘时,生成的链接会包含该条成绩的打乱、时间、动作、设备名称、可用的姿态轨迹以及已确认的复盘谱子。链接接收方可以查看并再次转发这些数据;删除本机成绩不会撤回已分享链接或导出副本。App 不会自动分享复盘。',
          'When you choose to share a replay, its link contains that solve’s scramble, time, turns, device name, available orientation track, and confirmed reconstruction lines. Recipients can view and forward these data; deleting the local solve does not revoke shared links or exported copies. The app does not share replays automatically.',
        )}
      </p>
      <h2>{t('导入与本地恢复', 'Import and local recovery')}</h2>
      <p>
        {t(
          '当你主动选择 JSON 文件导入时,App 只在设备上读取并校验该文件,然后把有效数据保存到 App 的本地数据库。替换前的有效数据会在本地保留为一次撤销恢复点,因此之后从活动记录删除的成绩仍可能存在于该恢复点中。使用一次“撤销导入”会删除恢复点;下一次成功导入会替换它;清除保存计时数据的本地数据库会将它一并删除；卸载是否清除该数据库取决于平台。导入文件和恢复点都不会由 App 上传。',
          'When you choose a JSON file to import, the app reads and validates it only on the device, then stores valid data in the app’s local database. Valid data replaced by the import is retained locally as a one-time undo recovery point, so a solve later deleted from the active history may still remain in that recovery point. Using Undo import deletes the recovery point, the next successful import replaces it, and clearing the local timing database removes it as well; whether uninstalling clears that database depends on the platform. Neither the imported file nor the recovery point is uploaded by the app.',
        )}
      </p>

      <h2>{t('安全、退出与删除', 'Security, sign-out, and deletion')}</h2>
      <p>
        {t(
          'App 使用操作系统提供的应用隔离存储,并在导入或保存前校验数据结构和大小。你可以在 App 设置或小程序“我的”页退出并清除对应设备的本地会话;App 还提供网站统一账号管理与注销入口,不复制第二套账号删除流程。CubeRoot 无法控制设备本身、系统备份或你导出文件的安全性;请为设备设置锁屏并谨慎选择备份接收方。',
          'The app uses operating-system app-isolated storage and validates data structure and size before importing or saving it. You can sign out in app Settings or on the Mini Program Account page to clear that device’s local session. The app also links to the website’s single account-management and deletion flows instead of duplicating account deletion. CubeRoot cannot control the security of your device, operating-system backups, or exported files; use a device lock and choose backup recipients carefully.',
        )}
      </p>

      <h2>{t('网站与第三方链接', 'Website and third-party links')}</h2>
      <p>
        {t(
          'App 内的 CubeRoot 在线页面适用本政策；需要系统浏览器的登录、绑定或外部链接会打开相应浏览器流程。你主动打开的第三方网站由其运营者负责，请查看其隐私说明。',
          'CubeRoot online pages within the app are covered by this policy. Sign-in, linking or external links that require a system browser open the corresponding browser flow. Third-party websites you choose to open are operated by their respective providers; review their privacy information.',
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
