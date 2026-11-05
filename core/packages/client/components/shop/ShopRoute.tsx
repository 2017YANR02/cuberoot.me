'use client';

import { ChevronDown } from '@app-foundation/icons/lucide';
import dynamic from 'next/dynamic';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import type { PlatformRouteDefinition } from '@/lib/platform-types';
import { SHOP_ROOT } from '@/lib/shop';
import { ShopCatalog } from './ShopCatalog';
const ShopProduct = dynamic(() => import('./ShopProduct').then(module => module.ShopProduct));
const ShopCart = dynamic(() => import('./ShopCart').then(module => module.ShopCart));

export function ShopRoute({ definition, id }: { definition: PlatformRouteDefinition; id?: string }) {
  if (definition.id === 'shop') return <ShopCatalog />;
  if (definition.id === 'product-detail' && id) return <ShopProduct id={id} definition={definition} />;
  if (definition.id === 'shop-cart' || definition.id === 'shop-checkout') return <ShopCart checkout={definition.id === 'shop-checkout'} />;
  return <ShopHelp />;
}

function ShopHelp() {
  const t = useT();
  const entries = [
    [t('如何购买？', 'How do I place an order?'), t('选择商品规格和数量，加入购物车。结算时登录 CubeRoot 账号，实物商品需选择收货地址。确认金额后创建订单，在订单页完成支付。', 'Choose a variant and quantity and add it to your bag. Sign in to your CubeRoot account at checkout and select a shipping address for physical goods. Review the total, place your order, then pay on the order page.')],
    [t('“价格待定”是什么意思？', 'What does “Price to be announced” mean?'), t('商品尚未开放销售。价格和可售规格公布后才能加入购物车，不会按 0 元下单。', 'The product is not on sale yet. It can be added to your bag once its price and available variants are published.')],
    [t('有哪些支付方式？', 'How can I pay?'), t('订单页会显示当前可用的支付方式。请以订单状态确认是否支付成功；关闭支付窗口不会自动取消订单。', 'Available payment methods appear on the order page. Check the order status to confirm payment; closing the payment window does not cancel the order.')],
    [t('配送与物流在哪里查看？', 'Where can I find delivery updates?'), t('购买前请确认商品页的配送说明和收货地址。发货后，可在“订单与物流”查看商家录入的承运商及运单信息。具体配送范围和时效请联系客服确认。', 'Review the product’s delivery details and your shipping address before purchasing. After dispatch, carrier and tracking details appear in Orders & delivery. Contact us to confirm delivery coverage and timing.')],
    [t('如何申请售后？', 'How do I get after-sales support?'), t('在订单详情中查看可用的售后操作，或通过“联系我们”提供订单号和问题说明。退换货条件及寄回安排由客服根据实际订单确认。', 'Check the available support actions in your order details, or contact us with your order number and a description of the issue. Support will confirm return eligibility and return-shipping arrangements for your order.')],
  ];
  return <section className="shop-help"><AppLink href={SHOP_ROOT} className="shop-back">{t('返回商店', 'Back to shop')}</AppLink><h1>{t('购物帮助', 'Shopping help')}</h1>
    {entries.map(([title, body]) => <details key={title} className="shop-disclosure"><summary>{title}<ChevronDown size={18} aria-hidden /></summary><p>{body}</p></details>)}
    <AppLink className="shop-button shop-button-primary" href="/contact" prefetch={false}>{t('联系客服', 'Contact us')}</AppLink>
  </section>;
}
