import { platformRouter } from '../platform/http.js';
import { registerOrderRoutes } from '../platform/commerce/order-routes.js';
import { registerAddressRoutes } from '../platform/commerce/address-routes.js';
import { registerMembershipRoutes } from '../platform/commerce/membership-routes.js';
import { registerPaymentRoutes } from '../platform/commerce/payment-routes.js';
import { registerCouponRoutes } from '../platform/commerce/coupon-routes.js';
import { registerFulfillmentRoutes } from '../platform/commerce/fulfillment-routes.js';
import { registerRefundRoutes } from '../platform/commerce/refund-routes.js';
import { registerPayoutRoutes } from '../platform/commerce/payout-routes.js';
import { registerReconciliationRoutes } from '../platform/commerce/reconciliation-routes.js';

export { completePlatformFullRefund } from '../platform/commerce/refund-service.js';

export const platformCommerceRoutes = platformRouter();

registerOrderRoutes(platformCommerceRoutes);
registerAddressRoutes(platformCommerceRoutes);
registerMembershipRoutes(platformCommerceRoutes);
registerPaymentRoutes(platformCommerceRoutes);
registerCouponRoutes(platformCommerceRoutes);
registerFulfillmentRoutes(platformCommerceRoutes);
registerRefundRoutes(platformCommerceRoutes);
registerPayoutRoutes(platformCommerceRoutes);
registerReconciliationRoutes(platformCommerceRoutes);
