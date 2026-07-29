'use client';

/**
 * /account —— 「我的」页,全站唯一。地址里**不带 wcaId**:这是当前登录者的页面,不接受
 * 「看谁的」参数,所以没有 isSelf 分支。别人的东西各归各页(选手档案 /wca/persons/:id、
 * 选手复盘 /recon/person/:id),这里只放属于我的:账号凭据、学习进度、关注的比赛、登出。
 * 也没有登录弹层:未登录就直接渲染登录表单,登录后按 ?next= 回到来处。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import { ChevronLeft, ChevronRight, LogOut, Settings, Rewind, IdCard, GraduationCap } from 'lucide-react';
import AppLink from '@/components/AppLink';
import HomeLink from '@/components/HomeLink';
import FollowedComps from '@/components/FollowedComps';
import AlgValidationAlert from '@/components/AlgValidationAlert';
import PageNoticesAdmin from '@/components/PageNoticesAdmin';
import { AccountPanel, LoginForm, WcaLinkPrompt, DeleteAccountPanel, type SignedIn } from '@/components/AuthPanel';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';
import { useAuthStore, safeNext, takeWcaLinkPrompt } from '@/lib/auth-store';
import { tr, useLang } from '@/i18n/tr';
import './account.css';

export default function AccountPage() {
  const t = useT();
  const router = useRouter();
  const uiLang: 'zh' | 'en' = useLang() === 'en' ? 'en' : 'zh';

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // 齿轮切「登录方式」视图,再往里一层是「注销账号」。切换全靠真 <a>(中键可新开),页面只
  // 跟着 URL 走;push 进历史,浏览器后退能层层退回。setter 只用来在登出时清掉参数。
  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum<'main' | 'signin' | 'delete'>(['main', 'signin', 'delete']).withDefault('main').withOptions({ history: 'push' }),
  );

  // 'wait' = 还没判定(SSR / 正在跳走)—— auth-store 从 localStorage 同步初始化,服务端恒为
  // null,所以判定只能在挂载后做,渲染前固定空壳避免 hydration 错配。
  // 'onboard' = 刚注册完的那一步「你有 WCA ID 吗」,挡在回跳 ?next= 之前。
  const [mode, setMode] = useState<'wait' | 'login' | 'onboard' | 'me'>('wait');
  const next = useRef<string | null>(null);

  useDocumentTitle(
    mode !== 'me' ? '登录' : view === 'delete' ? '注销账号' : '我的',
    mode !== 'me' ? 'Sign in' : view === 'delete' ? 'Delete account' : 'My account',
  );

  /** 拿到会话后该去哪:有回跳就回去,否则留在本页。 */
  const leave = useCallback(() => {
    if (next.current) { router.replace(next.current); return; }
    setMode('me');
  }, [router]);

  /**
   * 登录/注册完成。**只有新注册、且账号还没绑 WCA** 才多问一步 —— 老用户每次登录都被问
   * 一遍会很烦,用 WCA 注册的人本来就有。问不问都不拦路:引导那步随时可跳过。
   */
  const settle = useCallback((info?: SignedIn) => {
    if (info?.isNew && !info.hasWca) { setMode('onboard'); return; }
    leave();
  }, [leave]);

  // 只在挂载时判一次。**不能**改成盯着 user 变化自动跳:忘记密码流在验证码通过时就已经登录,
  // 但人还得留在表单里设新密码 —— 一盯 user 就会把那一步抽走。何时算完成由表单的 onDone 说了算。
  useEffect(() => {
    next.current = safeNext(new URLSearchParams(window.location.search).get('next'));
    const u = useAuthStore.getState().user;
    if (!u) { setMode('login'); return; }
    // 三方(微信/QQ/支付宝)注册那条路:授权是整页跳走再回来的,回来时人已不在 LoginForm 里,
    // 拿不到 onDone —— 靠回调页留下的标记把同一步引导接上。
    setMode(takeWcaLinkPrompt() && !u.wcaId ? 'onboard' : 'me');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mode === 'wait') return <div className="account-page" />;

  // 我的公开页入口 —— 只有绑了 WCA 的账号才有;学习进度是本地公式标记,人人都有。
  // 没绑的人在原位看到「绑定 WCA 账号」:注册那步跳过了、或后来才拿到 WCA ID,都从这里回来。
  const wcaId = user?.wcaId;
  const cards = [
    ...(wcaId ? [
      {
        key: 'recon',
        href: `/recon/person/${wcaId}`,
        icon: <Rewind size={22} className="account-card-icon" />,
        title: tr({ zh: '我的复盘', en: 'My Reconstructions' }),
        desc: tr({ zh: '逐步还原我的解法', en: 'Step-by-step reconstructions of my solves' }),
      },
      {
        key: 'wca',
        href: `/wca/persons/${wcaId}`,
        icon: <IdCard size={22} className="account-card-icon" />,
        title: tr({ zh: '我的 WCA 档案', en: 'My WCA Profile' }),
        desc: tr({ zh: '个人纪录 / 比赛历史 / 奖牌', en: 'Records, competition history, medals' }),
      },
    ] : [
      {
        key: 'link-wca',
        href: '/account?view=signin',
        icon: <img src="/icons/wca.svg" alt="" width={22} height={22} className="account-card-icon" />,
        title: tr({ zh: '绑定 WCA 账号', en: 'Link your WCA account' }),
        desc: tr({ zh: '把比赛成绩、个人纪录和复盘接进来', en: 'Bring your results, records and reconstructions here' }),
      },
    ]),
    {
      key: 'progress',
      href: '/alg/progress',
      icon: <GraduationCap size={22} className="account-card-icon" />,
      title: tr({ zh: '学习进度', en: 'Learning Progress' }),
      desc: tr({ zh: '跨公式集的掌握进度总览', en: 'Mastery progress across all sets' }),
    },
  ];

  return (
    <div className="account-page">
      <header className="account-header">
        {/* 面包屑往上一层:设置视图回「我的」,主视图回首页。设置视图里**不再放齿轮** ——
            人已经在里面了,亮着的齿轮长得像入口却干着出口的活,没人读得出来。
            一个方向一个入口:进设置靠齿轮,出设置靠这条面包屑。 */}
        {view === 'signin' ? (
          <AppLink href="/account" className="account-back" prefetch={false}>
            <ChevronLeft size={16} />
            <span>{t('我的', 'My account')}</span>
          </AppLink>
        ) : view === 'delete' ? (
          /* 注销是设置里再往里一层,退一步回设置(而不是一路弹回「我的」)—— 面包屑跟着层级走。 */
          <AppLink href="/account?view=signin" className="account-back" prefetch={false}>
            <ChevronLeft size={16} />
            <span>{t('账号设置', 'Account settings')}</span>
          </AppLink>
        ) : (
          <HomeLink className="account-back">
            <ChevronLeft size={16} />
            <span>{t('首页', 'Home')}</span>
          </HomeLink>
        )}
        {mode === 'me' && view === 'main' && (
          <AppLink
            href="/account?view=signin"
            className="account-gear"
            title={t('账号设置', 'Account settings')}
            aria-label={t('账号设置', 'Account settings')}
            prefetch={false}
          >
            <Settings size={18} />
          </AppLink>
        )}
      </header>

      {mode === 'login' ? (
        <LoginForm onDone={settle} />
      ) : mode === 'onboard' ? (
        /* 注册流程的最后一步。这里不渲染账号页本体(名字、卡片)—— 人还在「注册」这件事里,
           把「我的」摊开会让人以为已经结束了,而这一步恰恰要他做个选择。 */
        <WcaLinkPrompt returnTo={next.current} onSkip={leave} />
      ) : view === 'delete' ? (
        /* 同理,注销这一屏也只有它自己:名字和入口卡片留在这儿,读起来像「你的东西都还在」,
           正好和这一屏要说的话相反。 */
        <DeleteAccountPanel backHref="/account?view=signin" />
      ) : (
        <>
          <div className="account-id-row">
            <h1 className="account-name">{user?.name || t('未命名', 'Unnamed')}</h1>
            {wcaId && <div className="account-wid">{wcaId}</div>}
          </div>

          {view === 'signin' ? (
            <section className="account-creds">
              <h2 className="account-creds-title">{t('登录方式', 'Sign-in methods')}</h2>
              <AccountPanel />
              {/* 清掉 ?view= —— 否则重新登录后会莫名其妙落在登录方式视图 */}
              <button type="button" className="account-logout" onClick={() => { logout(); void setView(null); setMode('login'); }}>
                <LogOut size={14} />
                <span>{t('退出', 'Log out')}</span>
              </button>
              {/* 注销入口:压在设置最底、与上面拉开一大段,存在但不招手 —— 真要找的人找得到,
                  顺着往下读的人不会误触。真 <a>,进的是独立一屏(?view=delete),不是弹窗。 */}
              <AppLink href="/account?view=delete" className="account-delete" prefetch={false}>
                {t('注销账号', 'Delete account')}
              </AppLink>
            </section>
          ) : (
            <>
              <nav className="account-cards">
                {cards.map(({ key, href, icon, title, desc }) => (
                  <AppLink key={key} href={href} className="account-card">
                    {icon}
                    <div className="account-card-body">
                      <div className="account-card-title">{title}</div>
                      <div className="account-card-desc">{desc}</div>
                    </div>
                    <ChevronRight size={18} className="account-card-chev" />
                  </AppLink>
                ))}
              </nav>

              {/* 公式库校验汇总 —— 组件自己判 admin,非管理员什么都不渲染、也不扫 */}
              <AlgValidationAlert />

              {/* 全站页面通知总览(哪些页挂着维护中 / WIP 条)—— 同样自己判 admin */}
              <PageNoticesAdmin />

              <FollowedComps isZh={uiLang === 'zh'} lang={uiLang} />
            </>
          )}
        </>
      )}
    </div>
  );
}
