'use client';

/**
 * 支付弹窗。选渠道(支付宝 / 微信 / 银行卡)→ 下单。
 * 返回收银台 url 且无二维码(支付宝 电脑/手机网站支付、微信 H5)→ 点一次即整页直跳收银台,
 * 付完经 return_url 回 /membership?paid= 由页面自动确认;
 * 返回二维码(微信 Native / 虎皮椒 PC)→ 弹窗内扫码 + 轮询查单,成功 onPaid()。
 */
import { useEffect, useRef, useState } from 'react';
import { Smartphone, Check, CreditCard } from '@app-foundation/icons/lucide';
import { ClearButton } from '@/components/ClearButton';
import { SiAlipay, SiWechat } from 'react-icons/si';
import { Spinner } from '@/components/Spinner/Spinner';
import { tr } from '@/i18n/tr';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import {
  createOrder,
  getOrderStatus,
  type MembershipPlan,
  type OrderInfo,
  type PayChannels,
  type PaymentChannel,
} from '@/lib/membership-api';
import { fmtPrice } from '@/lib/membership-format';
import { installedMembershipStore } from '@/lib/store-membership-bridge';
import { requestWebMembership, useWebMembershipAvailable } from '@/lib/web-membership-bridge';
import { useAuthStore } from '@/lib/auth-store';
import { isInWeChat } from '@/lib/wechat-share';
import { copyPageLink } from '@/lib/page-share';
import AppLink from '@/components/AppLink';

interface Props {
  plan: MembershipPlan;
  channels?: PayChannels;
  isZh: boolean;
  onClose: () => void;
  onPaid: () => void;
}

export default function PayModal({ plan, channels, isZh, onClose, onPaid }: Props) {
  const directApp = useWebMembershipAvailable();
  const smallScreen = useIsMobile();
  const isMobile = directApp || smallScreen;
  const uid = useAuthStore(s => s.user?.uid);
  const showAlipay = channels?.alipay !== false;
  const showWechat = isMobile
    ? (channels?.wechatH5 ?? channels?.wechat) !== false
    : (channels?.wechatNative ?? channels?.wechat) !== false;
  const showCardCn = !directApp && channels?.cardCn === true;
  const showCardGlobal = !directApp && channels?.cardGlobal === true;
  const [channel, setChannel] = useState<PaymentChannel | null>(null);
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [needsExternalBrowser, setNeedsExternalBrowser] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const pollRef = useRef<number | null>(null);
  const pollGeneration = useRef(0);
  const active = useRef(true);
  const orderUid = useRef<number | undefined>(undefined);
  const completed = useRef(false);

  useEffect(() => { setNeedsExternalBrowser(isMobile && isInWeChat()); }, [isMobile]);

  const backdropProps = useModalDismiss(onClose);
  // Stop the pending查单 poll when the modal unmounts (its own concern, not part of dismiss).
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; pollGeneration.current++; if (pollRef.current !== null) window.clearTimeout(pollRef.current); };
  }, []);
  useEffect(() => {
    pollGeneration.current++;
    if (pollRef.current !== null) window.clearTimeout(pollRef.current);
    setOrder(null);
  }, [uid]);

  async function openAppCheckout(info: OrderInfo) {
    if (!info.url || !orderUid.current || useAuthStore.getState().user?.uid !== orderUid.current) return;
    setCreating(true);
    setErr(null);
    try {
      await requestWebMembership(info.url, orderUid.current, isZh ? 'zh' : 'en');
      if (active.current && !completed.current && useAuthStore.getState().user?.uid === orderUid.current) pollStatus(info.outTradeNo);
    } catch {
      if (active.current) setErr(tr({ zh: '未能打开收银台，请重试或检查支付结果。', en: 'Could not open checkout. Retry or check the payment status.' }));
    } finally { if (active.current) setCreating(false); }
  }

  async function start(ch: PaymentChannel) {
    if (installedMembershipStore()) return;
    if (directApp && !uid) {
      setErr(tr({ zh: '请重新登录后再支付。', en: 'Please sign in again before paying.' }));
      return;
    }
    // H5 checkout is supported only outside WeChat. Check again at click time
    // so a tap before the effect runs cannot create an unusable payment order.
    if (ch === 'wechat' && isMobile && isInWeChat()) {
      setNeedsExternalBrowser(true);
      return;
    }
    setChannel(ch);
    setErr(null);
    setCreating(true);
    const startingUid = uid;
    orderUid.current = startingUid;
    completed.current = false;
    try {
      const info = directApp
        ? await createOrder(plan.slug, ch, 'wap', isZh ? 'zh' : 'en', 'android-direct')
        : await createOrder(plan.slug, ch, isMobile ? 'wap' : 'pc', isZh ? 'zh' : 'en');
      if (!active.current || useAuthStore.getState().user?.uid !== startingUid) return;
      if (directApp) {
        setOrder(info);
        pollStatus(info.outTradeNo);
        await openAppCheckout(info);
        return;
      }
      if (info.hostedCheckout) {
        const checkout = info.hostedCheckout;
        const { init } = await import('@airwallex/components-sdk');
        const { payments } = await init({
          env: checkout.env,
          enabledElements: ['payments'],
          locale: isZh ? 'zh' : 'en',
        });
        if (!payments) {
          throw new Error(tr({ zh: '银行卡收银台初始化失败', en: 'Card checkout failed to initialize' }));
        }
        const checkoutUrl = payments.redirectToCheckout({
          env: checkout.env,
          mode: 'payment',
          intent_id: checkout.intentId,
          client_secret: checkout.clientSecret,
          currency: checkout.currency,
          country_code: checkout.countryCode,
          methods: ['card'],
          allowedCardNetworks: checkout.allowedCardNetworks,
          successUrl: checkout.successUrl,
          locale: isZh ? 'zh' : 'en',
        });
        if (typeof checkoutUrl === 'string' && checkoutUrl) window.location.href = checkoutUrl;
        return;
      }
      // 有收银台 url 且无二维码(支付宝 电脑/手机网站支付、微信 H5)→ 点一次即整页直跳收银台,
      // 省掉「前往支付」中转;付完 return_url 回 /membership?paid= 由页面自动确认。
      if (info.url && !info.qrcode) {
        window.location.href = info.url;
        return;
      }
      // 否则(微信 Native / 虎皮椒 PC)弹窗内展示二维码扫码 + 轮询查单。
      setOrder(info);
      pollStatus(info.outTradeNo);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  async function copyMembershipLink() {
    // Open the same site in the external browser, without payment/query tokens.
    const url = new URL(isZh ? '/zh/membership' : '/membership', window.location.origin).href;
    const copied = await copyPageLink(url);
    setLinkCopied(copied);
    setErr(copied ? null : tr({ zh: '复制失败，请使用右上角菜单在浏览器中打开。', en: 'Could not copy the link. Use the top-right menu to open this page in your browser.' }));
  }

  function pollStatus(no: string, tries = 0, generation = ++pollGeneration.current) {
    if (pollRef.current !== null) window.clearTimeout(pollRef.current);
    const current = () => active.current && !completed.current && generation === pollGeneration.current
      && (!directApp || useAuthStore.getState().user?.uid === orderUid.current);
    if (!current()) return;
    getOrderStatus(no)
      .then((r) => {
        if (!current()) return;
        if (r.status === 'paid') { completed.current = true; onPaid(); return; }
        if (r.status === 'pending' && tries < 120) {
          pollRef.current = window.setTimeout(() => pollStatus(no, tries + 1, generation), 2500);
        } else {
          setErr(tr({ zh: '尚未确认支付成功，可检查支付结果或稍后重试。', en: 'Payment is not confirmed. Check its status or try again later.' }));
        }
      })
      .catch(() => {
        if (!current()) return;
        if (tries < 120) pollRef.current = window.setTimeout(() => pollStatus(no, tries + 1, generation), 4000);
        else setErr(tr({ zh: '暂时无法查询，请稍后检查支付结果。', en: 'Could not check the payment. Please try again later.' }));
      });
  }

  if (installedMembershipStore()) return (
    <div className="mem-pay-backdrop" {...backdropProps}>
      <section className="mem-pay">
        <AppLink href="/membership" onClick={onClose}>{tr({ zh: '前往 App 内会员订阅', en: 'Open in-app membership subscriptions' })}</AppLink>
        <button onClick={onClose}>{tr({ zh: '关闭', en: 'Close' })}</button>
      </section>
    </div>
  );
  return (
    <div className="mem-pay-backdrop" {...backdropProps}>
      <div className="mem-pay">
        <ClearButton variant="standalone" className="mem-pay-close" onClick={onClose}
          ariaLabel={tr({ zh: '关闭', en: 'Close' })} />
        <h2 className="mem-pay-title">{isZh ? plan.nameZh : plan.nameEn}</h2>
        <div className="mem-pay-price">{fmtPrice(plan.priceCents, plan.currency)}</div>

        {!order ? (
          <>
            <div className="mem-pay-channels">
              {showAlipay && (
                <button className="mem-pay-ch mem-pay-ch-alipay" disabled={creating} onClick={() => start('alipay')}>
                  {creating && channel === 'alipay'
                    ? <Spinner size={16} />
                    : <SiAlipay size={18} aria-hidden="true" />}
                  {tr({ zh: '支付宝', en: 'Alipay'
                  })}
                </button>
              )}
              {showWechat && (
                <button className="mem-pay-ch mem-pay-ch-wechat" disabled={creating} onClick={() => needsExternalBrowser ? copyMembershipLink() : start('wechat')}>
                  {creating && channel === 'wechat'
                    ? <Spinner size={16} />
                    : <SiWechat size={18} aria-hidden="true" />}
                  {needsExternalBrowser
                    ? linkCopied
                      ? tr({ zh: '链接已复制', en: 'Link copied' })
                      : tr({ zh: '复制链接，在浏览器中支付', en: 'Copy link to pay in your browser' })
                    : tr({ zh: '微信支付', en: 'WeChat Pay' })}
                </button>
              )}
              {showCardCn && (
                <button className="mem-pay-ch mem-pay-ch-card" disabled={creating} onClick={() => start('card_cn')}>
                  {creating && channel === 'card_cn'
                    ? <Spinner size={16} />
                    : <CreditCard size={18} aria-hidden="true" />}
                  {tr({ zh: '中国银行卡（银联）', en: 'China cards (UnionPay)' })}
                </button>
              )}
              {showCardGlobal && (
                <button className="mem-pay-ch mem-pay-ch-card" disabled={creating} onClick={() => start('card_global')}>
                  {creating && channel === 'card_global'
                    ? <Spinner size={16} />
                    : <CreditCard size={18} aria-hidden="true" />}
                  {tr({ zh: '国际银行卡', en: 'International cards' })}
                </button>
              )}
            </div>
            {showWechat && needsExternalBrowser && (
              <p className="mem-pay-tip" role="status">
                {tr({ zh: '请点击微信右上角「···」，选择「在浏览器打开」，再使用微信支付。也可以复制链接到 Safari 或其他浏览器打开；如提示登录，请登录同一个 CubeRoot 账号。', en: 'Tap the top-right WeChat menu and choose Open in Browser, then select WeChat Pay. You can also copy the link into Safari or another browser. If asked, sign in to the same CubeRoot account.' })}
              </p>
            )}
            {err && <div className="mem-pay-err">{err}</div>}
          </>
        ) : (
          <>
            {directApp ? (
              <>
                <button className="mem-pay-go" disabled={creating || !order.url} onClick={() => void openAppCheckout(order)}>
                  <Smartphone size={16} /> {tr({ zh: '打开收银台', en: 'Open checkout' })}
                </button>
                <button className="mem-pay-go-link" onClick={() => { setErr(null); pollStatus(order.outTradeNo); }}>
                  {tr({ zh: '检查支付结果', en: 'Check payment status' })}
                </button>
              </>
            ) : order.qrcode ? (
              <figure className="mem-pay-qr">
                <img src={order.qrcode} alt="payment QR" width={220} height={220} />
                <figcaption>
                  {channel === 'wechat'
                    ? tr({ zh: '请用微信扫码支付', en: 'Scan with WeChat to pay'
                    })
                    : tr({ zh: '请用支付宝扫码支付', en: 'Scan with Alipay to pay'
                    })}
                </figcaption>
              </figure>
            ) : order.url ? (
              <a className="mem-pay-go" href={order.url} target="_blank" rel="noopener noreferrer">
                <Smartphone size={16} /> {tr({ zh: '前往支付', en: 'Go to checkout' })}
              </a>
            ) : (
              <div className="mem-pay-err">{tr({ zh: '未获取到支付链接', en: 'No payment link returned'
            })}</div>
            )}
            {!directApp && order.url && order.qrcode && (
              <a className="mem-pay-go-link" href={order.url} target="_blank" rel="noopener noreferrer">
                <Smartphone size={13} /> {tr({ zh: '在手机上打开', en: 'Open on phone'
                })}
              </a>
            )}
            <div className="mem-pay-waiting">
              <Spinner size={14} /> {tr({ zh: '等待支付结果…', en: 'Waiting for payment…'
            })}
            </div>
            {err && <div className="mem-pay-err" role="status">{err}</div>}
            <p className="mem-pay-tip">
              <Check size={12} /> {tr({ zh: '支付完成后本页会自动开通,可稍候片刻', en: 'Membership activates automatically once paid — give it a moment'
            })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
