'use client';

/**
 * 支付弹窗。选渠道(支付宝 / 微信)→ 下单。
 * 返回收银台 url 且无二维码(支付宝 电脑/手机网站支付、微信 H5)→ 点一次即整页直跳收银台,
 * 付完经 return_url 回 /membership?paid= 由页面自动确认;
 * 返回二维码(微信 Native / 虎皮椒 PC)→ 弹窗内扫码 + 轮询查单,成功 onPaid()。
 */
import { useEffect, useRef, useState } from 'react';
import { X, Loader2, Smartphone, Check } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { createOrder, getOrderStatus, type MembershipPlan, type OrderInfo, type PayChannels } from '@/lib/membership-api';
import { fmtPrice } from '@/lib/membership-format';

type Channel = 'alipay' | 'wechat';

interface Props {
  plan: MembershipPlan;
  channels?: PayChannels;
  isZh: boolean;
  onClose: () => void;
  onPaid: () => void;
}

export default function PayModal({ plan, channels, isZh, onClose, onPaid }: Props) {
  const isMobile = useIsMobile();
  const showAlipay = channels?.alipay !== false;
  const showWechat = channels?.wechat !== false;
  const [channel, setChannel] = useState<Channel | null>(null);
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useModalDismiss(onClose);
  // Stop the pending查单 poll when the modal unmounts (its own concern, not part of dismiss).
  useEffect(() => () => { if (pollRef.current !== null) window.clearTimeout(pollRef.current); }, []);

  async function start(ch: Channel) {
    setChannel(ch);
    setErr(null);
    setCreating(true);
    try {
      const info = await createOrder(plan.slug, ch, isMobile ? 'wap' : 'pc');
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

  function pollStatus(no: string, tries = 0) {
    getOrderStatus(no)
      .then((r) => {
        if (r.status === 'paid') { onPaid(); return; }
        if (r.status === 'pending' && tries < 120) {
          pollRef.current = window.setTimeout(() => pollStatus(no, tries + 1), 2500);
        }
      })
      .catch(() => {
        if (tries < 120) pollRef.current = window.setTimeout(() => pollStatus(no, tries + 1), 4000);
      });
  }

  return (
    <div className="mem-pay-backdrop" onClick={onClose}>
      <div className="mem-pay" onClick={(e) => e.stopPropagation()}>
        <button className="mem-pay-close" onClick={onClose} aria-label={tr({ zh: '关闭', en: 'Close'
        })}><X size={18} /></button>
        <h2 className="mem-pay-title">{isZh ? plan.nameZh : plan.nameEn}</h2>
        <div className="mem-pay-price">{fmtPrice(plan.priceCents, plan.currency)}</div>

        {!order ? (
          <>
            <p className="mem-pay-hint">{tr({ zh: '选择支付方式', en: 'Choose a payment method'
            })}</p>
            <div className="mem-pay-channels">
              {showAlipay && (
                <button className="mem-pay-ch mem-pay-ch-alipay" disabled={creating} onClick={() => start('alipay')}>
                  {creating && channel === 'alipay' ? <Loader2 size={16} className="mem-spin" /> : null}
                  {tr({ zh: '支付宝', en: 'Alipay'
                  })}
                </button>
              )}
              {showWechat && (
                <button className="mem-pay-ch mem-pay-ch-wechat" disabled={creating} onClick={() => start('wechat')}>
                  {creating && channel === 'wechat' ? <Loader2 size={16} className="mem-spin" /> : null}
                  {tr({ zh: '微信支付', en: 'WeChat Pay' })}
                </button>
              )}
            </div>
            {err && <div className="mem-pay-err">{err}</div>}
          </>
        ) : (
          <>
            {order.qrcode ? (
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
            {order.url && order.qrcode && (
              <a className="mem-pay-go-link" href={order.url} target="_blank" rel="noopener noreferrer">
                <Smartphone size={13} /> {tr({ zh: '在手机上打开', en: 'Open on phone'
                })}
              </a>
            )}
            <div className="mem-pay-waiting">
              <Loader2 size={14} className="mem-spin" /> {tr({ zh: '等待支付结果…', en: 'Waiting for payment…'
            })}
            </div>
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
