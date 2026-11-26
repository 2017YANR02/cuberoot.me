'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import AppLink from '@/components/AppLink';
import { ClearButton } from '@/components/ClearButton';
import { useT } from '@/hooks/useT';
import { useAuthUser } from '@/lib/auth-store';
import { quotePlatformOrder, type PlatformQuote } from '@/lib/platform-checkout';
import type { PlatformActionId, PlatformActionResult, PlatformEntity } from '@/lib/platform-types';
import { commerceMoney, commerceRecord, commerceText, ticketAvailability } from './PlatformCommerceContent';

type Quote = PlatformQuote;
const NO_ADDRESSES: PlatformEntity[] = [];
type RunAction = (action:PlatformActionId,id?:string,payload?:Record<string,unknown>)=>Promise<PlatformActionResult|undefined>;

/** A quote is advisory; creation applies the same server pricing again under its inventory locks. */
export function PlatformPurchaseForm({entity,kind,addresses=NO_ADDRESSES,busy,runAction}:{entity?:PlatformEntity;kind:'product_variant'|'event_ticket'|'course';addresses?:PlatformEntity[];busy:string|null;runAction:RunAction}) {
  const t=useT(); const user=useAuthUser();
  const data=entity?.data??{};
  const [now,setNow]=useState(0);
  useEffect(()=>{setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),30000);return()=>window.clearInterval(timer);},[]);
  const options=useMemo(()=>kind==='course'?[{id:entity?.id,titleZh:entity?.title,titleEn:entity?.title,amountMinor:data.baseAmountMinor,currency:data.currency,status:'active',availableQuantity:1}]:((kind==='product_variant'?data.variants:data.tickets) as unknown[]??[]).map(commerceRecord),[kind,data.variants,data.tickets,data.baseAmountMinor,data.currency,entity?.id,entity?.title]);
  const [selectedOption,setSelected]=useState('');
  const coursePurchase = kind === 'course';
  const selected = coursePurchase ? entity?.id ?? '' : selectedOption; const [quantity,setQuantity]=useState('1'); const [coupon,setCoupon]=useState(''); const [address,setAddress]=useState('');
  const quoteKey = JSON.stringify([user?.uid ?? user?.wcaId, kind, selected, quantity, coupon.trim(), address]);
  const [quoted, setQuote] = useState<{ key: string; value: Quote } | null>(null);
  const quote = quoted?.key === quoteKey ? quoted.value : null;const [quoting,setQuoting]=useState(false);const [error,setError]=useState('');
  const request=useRef<AbortController|null>(null);
  const orderRequest = useRef<{ quoteKey: string; key: string; active: boolean } | null>(null);
  useEffect(()=>{if (!coursePurchase) setSelected(String(options[0]?.id??''));},[coursePurchase,options]);
  useEffect(()=>{if(!addresses.some(item=>item.id===address))setAddress(addresses.find(item=>item.data?.isDefault)?.id??addresses[0]?.id??'');},[addresses,address]);
  useEffect(()=>{request.current?.abort();setQuote(null);setError('');setQuoting(false);return()=>request.current?.abort();},[quoteKey]);
  const option=options.find(item=>String(item.id)===selected);
  const physical=kind==='product_variant'&&data.productType==='physical';
  const stock=kind==='event_ticket'?Number(option?.available):Number(option?.availableQuantity);
  const unavailable=!option || (kind==='event_ticket'?ticketAvailability(option,now)!=='available':option.status!=='active'||stock<1);
  const validQuantity=Number.isInteger(Number(quantity))&&Number(quantity)>=1&&Number(quantity)<=Math.min(99,stock||99);
  const canQuote=!unavailable&&validQuantity&&(!physical||!!address)&&!!user;
  const preview = useCallback(async () => {
    if(!canQuote)return;
    request.current?.abort();const controller=new AbortController();request.current=controller;setQuoting(true);setError('');setQuote(null);
    const key=kind==='product_variant'?'productVariantId':kind==='event_ticket'?'eventTicketTypeId':'courseId';
    try {
      const next=await quotePlatformOrder([{[key]:selected,quantity:Number(quantity)}],coupon,controller.signal);
      if(!controller.signal.aborted)setQuote({ key: quoteKey, value: next });
    } catch(reason) {if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:t('报价未完成，请重试。','Could not calculate the price. Try again.'));}
    finally{if(!controller.signal.aborted)setQuoting(false);}
  }, [canQuote, kind, selected, quantity, coupon, quoteKey, t]);
  useEffect(() => {
    if (!coursePurchase || !canQuote) return;
    const delay = coupon.trim() ? 400 : 0;
    const timer = setTimeout(() => void preview(), delay);
    return () => clearTimeout(timer);
  }, [coursePurchase, canQuote, coupon, preview]);
  async function purchase(event: FormEvent) {
    event.preventDefault();
    if (!quote || !canQuote || orderRequest.current?.active) return;
    if (orderRequest.current?.quoteKey !== quoteKey) {
      orderRequest.current = { quoteKey, key: crypto.randomUUID(), active: false };
    }
    const attempt = orderRequest.current;
    attempt.active = true;
    try {
      await runAction('create-order', undefined, {
        sellableType: kind, sellableId: selected, quantity: Number(quantity), requestKey: attempt.key,
        ...(coupon.trim() ? { couponCode: coupon.trim() } : {}),
        ...(physical ? { shippingAddressId: address } : {}),
      });
    } finally { attempt.active = false; }
  }
  return <form className="platform-domain-form" onSubmit={purchase}><h2>{t('确认购买','Review purchase')}</h2>
    <div className="platform-form-grid">{!coursePurchase && <><label><span>{t('选择规格或票种','Choose an option')}</span><select className="platform-field-control" value={selected} onChange={event=>setSelected(event.target.value)}>{options.map(item=><option key={String(item.id)} value={String(item.id)}>{commerceText(item,'title',t)} · {commerceMoney(item.amountMinor,item.currency)}</option>)}</select></label>
      <label><span>{t('数量','Quantity')}</span><input className="platform-field-control" type="number" min={1} max={Math.min(99,stock||99)} step={1} value={quantity} onChange={event=>setQuantity(event.target.value)} required /></label></>}
      <label><span>{t('优惠码（可选）','Coupon code (optional)')}</span><div className="platform-write-actions"><input autoComplete="off" className="platform-field-control" value={coupon} maxLength={64} onChange={event=>setCoupon(event.target.value)} />{coupon?<ClearButton onClick={()=>setCoupon('')} />:null}</div></label>
      {physical?<label><span>{t('收货地址','Shipping address')}</span><select className="platform-field-control" value={address} onChange={event=>setAddress(event.target.value)} required>{addresses.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>:null}
    </div>
    {unavailable?<p role="status">{t('此规格或票种当前不可购买，请选择其他选项。','This option is currently unavailable. Choose another option.')}</p>:null}
    {physical&&!address?<p>{t('请先保存收货地址。','Save a shipping address first.')}</p>:null}
    {!user ? <AppLink className="platform-button" href="/platform/login">{t('登录后确认价格','Sign in to confirm your price')}</AppLink>
      : coursePurchase ? (quoting ? <p role="status">{t('正在计算价格…', 'Calculating price…')}</p>
        : error ? <button type="button" className="platform-button" disabled={!canQuote || !!busy} onClick={() => void preview()}>{t('重新计算价格', 'Retry price calculation')}</button> : null)
        : <button type="button" className="platform-button" disabled={!canQuote || quoting || !!busy} onClick={() => void preview()}>{quoting ? t('计算中…','Calculating…') : t('应用优惠并确认金额','Apply coupon and confirm total')}</button>}
    {error?<p role="alert">{error}</p>:null}
    {quote?<div className="platform-quote" aria-live="polite"><span>{t('商品金额','Subtotal')}: {commerceMoney(quote.subtotalAmountMinor,quote.currency)}</span><span>{t('优惠','Discount')}: {commerceMoney(quote.discountAmountMinor,quote.currency)}</span><strong>{t('应付','Total')}: {commerceMoney(quote.totalAmountMinor,quote.currency)}</strong>{quote.member?<span>{t('已按当前会员权益计价。','Your current membership pricing has been applied.')}</span>:null}<span>{t('下单时再次核对价格与库存。','Price and availability are checked again when you place the order.')}</span></div>:null}
    <button type="submit" className="platform-button platform-button-primary" disabled={!quote||!canQuote||!!busy}>{busy?t('处理中…','Working…'):coursePurchase ? t('立即购买', 'Buy now') : t('创建订单','Place order')}</button>
  </form>;
}
