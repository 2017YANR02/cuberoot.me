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
import { AccountPanel, LoginForm } from '@/components/AuthPanel';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';
import { useAuthStore, safeNext } from '@/lib/auth-store';
import { tr, useLang } from '@/i18n/tr';
import './account.css';

export default function AccountPage() {
  const t = useT();
  const router = useRouter();
  const uiLang: 'zh' | 'en' = useLang() === 'en' ? 'en' : 'zh';

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // 齿轮切「登录方式」视图。切换靠齿轮那个真 <a>(中键可新开),页面只跟着 URL 走;
  // push 进历史,浏览器后退能退回主视图。setter 只用来在登出时清掉参数。
  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum<'main' | 'signin'>(['main', 'signin']).withDefault('main').withOptions({ history: 'push' }),
  );

  // 'wait' = 还没判定(SSR / 正在跳走)—— auth-store 从 localStorage 同步初始化,服务端恒为
  // null,所以判定只能在挂载后做,渲染前固定空壳避免 hydration 错配。
  const [mode, setMode] = useState<'wait' | 'login' | 'me'>('wait');
  const next = useRef<string | null>(null);

  useDocumentTitle(mode === 'login' ? '登录' : '我的', mode === 'login' ? 'Sign in' : 'My account');

  /** 拿到会话后该去哪:有回跳就回去,否则留在本页。 */
  const settle = useCallback(() => {
    if (next.current) { router.replace(next.current); return; }
    setMode('me');
  }, [router]);

  // 只在挂载时判一次。**不能**改成盯着 user 变化自动跳:忘记密码流在验证码通过时就已经登录,
  // 但人还得留在表单里设新密码 —— 一盯 user 就会把那一步抽走。何时算完成由表单的 onDone 说了算。
  useEffect(() => {
    next.current = safeNext(new URLSearchParams(window.location.search).get('next'));
    setMode(useAuthStore.getState().user ? 'me' : 'login');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mode === 'wait') return <div className="account-page" />;

  // 我的公开页入口 —— 只有绑了 WCA 的账号才有;学习进度是本地公式标记,人人都有。
  const wcaId = user?.wcaId;
  const cards = [
    ...(wcaId ? [
      {
        key: 'recon',
        href: `/recon/person/${wcaId}`,
        Icon: Rewind,
        title: tr({ zh: '我的复盘', en: 'My Reconstructions' }),
        desc: tr({ zh: '逐步还原我的解法', en: 'Step-by-step reconstructions of my solves' }),
      },
      {
        key: 'wca',
        href: `/wca/persons/${wcaId}`,
        Icon: IdCard,
        title: tr({ zh: '我的 WCA 档案', en: 'My WCA Profile' }),
        desc: tr({ zh: '个人纪录 / 比赛历史 / 奖牌', en: 'Records, competition history, medals' }),
      },
    ] : []),
    {
      key: 'progress',
      href: '/alg/progress',
      Icon: GraduationCap,
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
        ) : (
          <HomeLink className="account-back">
            <ChevronLeft size={16} />
            <span>{t('首页', 'Home')}</span>
          </HomeLink>
        )}
        {mode === 'me' && view !== 'signin' && (
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
            </section>
          ) : (
            <>
              <nav className="account-cards">
                {cards.map(({ key, href, Icon, title, desc }) => (
                  <AppLink key={key} href={href} className="account-card">
                    <Icon size={22} className="account-card-icon" />
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

              <FollowedComps isZh={uiLang === 'zh'} lang={uiLang} />
            </>
          )}
        </>
      )}
    </div>
  );
}
