

export type SellableType = 'course' | 'product_variant' | 'event_ticket' | 'platform_membership';

export type FulfillmentType = 'course_entitlement' | 'download' | 'shipment' | 'event_registration' | 'platform_membership';

export interface PricedItem {
  sellableType: SellableType;
  fulfillmentType: FulfillmentType;
  quantity: number;
  amountMinor: number;
  currency: string;
  courseId: string | null;
  productVariantId: string | null;
  eventTicketTypeId: string | null;
  membershipPlanId: string | null;
  snapshot: Record<string, unknown>;
  revenueShare: Array<{ instructorId: string; shareBps: number }>;
}

export interface OrderRow extends Record<string, unknown> {
  id: string;
  order_number: string;
  buyer_user_id: number | null;
  status: string;
  currency: string;
  total_amount_minor: number | string;
}

export type ShipmentEventType = 'ship' | 'deliver' | 'return';
