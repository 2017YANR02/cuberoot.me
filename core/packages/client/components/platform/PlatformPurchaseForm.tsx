'use client';

import { sessionFetch } from '@/lib/session-fetch';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import AppLink from '@/components/AppLink';
import { ClearButton } from '@/components/ClearButton';
import { useT } from '@/hooks/useT';
import { useAuthUser } from '@/lib/auth-store';
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import type { PlatformActionId, PlatformActionResult, PlatformEntity } from '@/lib/platform-types';
import { commerceMoney, commerceRecord, commerceText, ticketAvailability } from './PlatformCommerceContent';

type Quote = {currency:string;member:boolean;subtotalAmountMinor:number;discountAmountMinor:number;totalAmountMinor:number};
type RunAction = (action:PlatformActionId,id?:string,payload?:Record<string,unknown>)=>Promise<PlatformActionResult|undefined>;

/** A quote is advisory; creation applies the same server pricing again under its inventory locks. */
export function PlatformPurchaseForm({entity,kind,addresses=[],busy,runAction}:{entity?:PlatformEntity;kind:'product_variant'|'event_ticket'|'course';addresses?:PlatformEntity[];busy:string|null;runAction:RunAction}) {
  const t=useT(); const user=useAuthUser();
  const data=entity?.data??{};
  const [now,setNow]=useState(0);
  useEffect(()=>{setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),30000);return()=>window.clearInterval(timer);},[]);
  const options=useMemo(()=>kind==='course'?[{id:entity?.id,titleZh:entity?.title,titleEn:entity?.title,amountMinor:data.baseAmountMinor,currency:data.currency,status:'active',availableQuantity:1}]:((kind==='product_variant'?data.variants:data.tickets) as unknown[]??[]).map(commerceRecord),[kind,data.variants,data.tickets,data.baseAmountMinor,data.currency,entity?.id,entity?.title]);
  const [selected,setSelected]=useState(''); const [quantity,setQuantity]=useState('1'); const [coupon,setCoupon]=useState(''); const [address,setAddress]=useState('');
  const [quote,setQuote]=useState<Quote|null>(null);const [quoting,setQuoting]=useState(false);const [error,setError]=useState('');
  const request=useRef<AbortController|null>(null);
  useEffect(()=>{setSelected(String(options[0]?.id??''));setQuote(null);},[options]);
  useEffect(()=>{if(!addresses.some(item=>item.id===address))setAddress(addresses.find(item=>item.data?.isDefault)?.id??addresses[0]?.id??'');},[addresses,address]);
  useEffect(()=>{request.current?.abort();setQuote(null);setError('');setQuoting(false);return()=>request.current?.abort();},[selected,quantity,coupon,address,entity?.id]);
  const option=options.find(item=>String(item.id)===selected);
  const physical=kind==='product_variant'&&data.productType==='physical';
  const stock=kind==='event_ticket'?Number(option?.available):Number(option?.availableQuantity);
  const unavailable=!option || (kind==='event_ticket'?ticketAvailability(option,now)!=='available':option.status!=='active'||stock<1);
  const validQuantity=Number.isInteger(Number(quantity))&&Number(quantity)>=1&&Number(quantity)<=Math.min(99,stock||99);
  const canQuote=!unavailable&&validQuantity&&(!physical||!!address)&&!!user;
  async function preview() {
    if(!canQuote)return;
    request.current?.abort();const controller=new AbortController();request.current=controller;setQuoting(true);setError('');setQuote(null);
    const key=kind==='product_variant'?'productVariantId':kind==='event_ticket'?'eventTicketTypeId':'courseId';
    try {
      const response=await sessionFetch(apiUrl('/v1/platform/orders/quote'),{method:'POST',headers:{...authHeaders(false),'Content-Type':'application/json'},body:JSON.stringify({items:[{[key]:selected,quantity:Number(quantity)}],...(coupon.trim()?{couponCode:coupon.trim()}:{})}),signal:controller.signal});
      const next=await handleApi<Quote>(response);
      if(!controller.signal.aborted)setQuote(next);
    } catch(reason) {if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:t('报价未完成，请重试。','Could not calculate the price. Try again.'));}
    finally{if(!controller.signal.aborted)setQuoting(false);}
  }
  async function purchase(event:FormEvent) {event.preventDefault();if(!quote||!canQuote)return;await runAction('create-order',undefined,{sellableType:kind,sellableId:selected,quantity:Number(quantity),...(coupon.trim()?{couponCode:coupon.trim()}:{}),...(physical?{shippingAddressId:address}:{})});}
  return <form className="platform-domain-form" onSubmit={purchase}><h2>{t('确认购买','Review purchase')}</h2>
    <div className="platform-form-grid"><label><span>{t('选择规格或票种','Choose an option')}</span><select className="platform-field-control" value={selected} onChange={event=>setSelected(event.target.value)}>{options.map(item=><option key={String(item.id)} value={String(item.id)}>{commerceText(item,'title',t)} · {commerceMoney(item.amountMinor,item.currency)}</option>)}</select></label>
      <label><span>{t('数量','Quantity')}</span><input className="platform-field-control" type="number" min={1} max={kind==='course'?1:Math.min(99,stock||99)} step={1} value={quantity} onChange={event=>setQuantity(event.target.value)} required /></label>
      <label><span>{t('优惠码（可选）','Coupon code (optional)')}</span><div className="platform-write-actions"><input className="platform-field-control" value={coupon} maxLength={64} onChange={event=>setCoupon(event.target.value)} />{coupon?<ClearButton onClick={()=>setCoupon('')} />:null}</div></label>
      {physical?<label><span>{t('收货地址','Shipping address')}</span><select className="platform-field-control" value={address} onChange={event=>setAddress(event.target.value)} required>{addresses.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>:null}
    </div>
    {unavailable?<p role="status">{t('此规格或票种当前不可购买，请选择其他选项。','This option is currently unavailable. Choose another option.')}</p>:null}
    {physical&&!address?<p>{t('请先保存收货地址。','Save a shipping address first.')}</p>:null}
    {!user?<AppLink className="platform-button" href="/platform/login">{t('登录后确认价格','Sign in to confirm your price')}</AppLink>:<button type="button" className="platform-button" disabled={!canQuote||quoting||!!busy} onClick={()=>{void preview();}}>{quoting?t('计算中…','Calculating…'):t('应用优惠并确认金额','Apply coupon and confirm total')}</button>}
    {error?<p role="alert">{error}</p>:null}
    {quote?<div className="platform-quote" aria-live="polite"><span>{t('商品金额','Subtotal')}: {commerceMoney(quote.subtotalAmountMinor,quote.currency)}</span><span>{t('优惠','Discount')}: {commerceMoney(quote.discountAmountMinor,quote.currency)}</span><strong>{t('应付','Total')}: {commerceMoney(quote.totalAmountMinor,quote.currency)}</strong>{quote.member?<span>{t('已按当前会员权益计价。','Your current membership pricing has been applied.')}</span>:null}<span>{t('下单时再次核对价格与库存。','Price and availability are checked again when you place the order.')}</span></div>:null}
    <button type="submit" className="platform-button platform-button-primary" disabled={!quote||!canQuote||!!busy}>{busy?t('处理中…','Working…'):t('创建订单','Place order')}</button>
  </form>;
}
