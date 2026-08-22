/** Shared request contracts for the main-site Platform domain. */
export const PLATFORM_CURRENCIES = ['CNY', 'USD'] as const;
export const PLATFORM_COURSE_STATUSES = ['draft', 'published', 'unlisted', 'archived'] as const;
export const PLATFORM_EVENT_STATUSES = ['draft', 'published', 'cancelled', 'completed', 'archived'] as const;
export const PLATFORM_PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;
export const PLATFORM_NEWS_STATUSES = ['draft', 'published', 'archived'] as const;
export const PLATFORM_PATH_STATUSES = ['draft', 'published', 'archived'] as const;

export type PlatformCurrency = typeof PLATFORM_CURRENCIES[number];
export type PlatformCourseStatus = typeof PLATFORM_COURSE_STATUSES[number];
export type PlatformEventStatus = typeof PLATFORM_EVENT_STATUSES[number];
export type PlatformProductStatus = typeof PLATFORM_PRODUCT_STATUSES[number];
export type PlatformNewsStatus = typeof PLATFORM_NEWS_STATUSES[number];
export type PlatformPathStatus = typeof PLATFORM_PATH_STATUSES[number];

export interface PlatformCourseWrite {
  slug: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  descriptionZh: string;
  descriptionEn: string;
  status: PlatformCourseStatus;
  enrollmentMode: 'free' | 'purchase' | 'invite' | 'admin_grant';
  baseAmountMinor: number;
  memberAmountMinor?: number | null;
  currency: PlatformCurrency;
}

export interface PlatformEventTicketWrite {
  code: string;
  titleZh: string;
  titleEn: string;
  amountMinor: number;
  currency: PlatformCurrency;
  capacity: number;
  salesStartAt?: string | null;
  salesEndAt?: string | null;
  status: 'active' | 'sold_out' | 'archived';
}

export interface PlatformEventWrite {
  slug: string;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  status: PlatformEventStatus;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venue: Record<string, unknown>;
  tickets: PlatformEventTicketWrite[];
}

export interface PlatformProductVariantWrite {
  sku: string;
  titleZh: string;
  titleEn: string;
  amountMinor: number;
  memberAmountMinor?: number | null;
  currency: PlatformCurrency;
  inventoryOnHand: number;
  weightGrams?: number | null;
  metadata?: Record<string, unknown>;
  status: 'active' | 'sold_out' | 'archived';
}

export interface PlatformProductWrite {
  slug: string;
  productType: 'physical' | 'digital';
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  status: PlatformProductStatus;
  variants: PlatformProductVariantWrite[];
}

export interface PlatformNewsWrite {
  slug: string;
  titleZh: string;
  titleEn: string;
  bodyZh: Record<string, unknown>;
  bodyEn: Record<string, unknown>;
  status: PlatformNewsStatus;
}

export interface PlatformPathItemWrite {
  courseId?: string | null;
  lessonId?: string | null;
}

export interface PlatformPathWrite {
  slug: string;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  status: PlatformPathStatus;
  items: PlatformPathItemWrite[];
}

export interface PlatformInstructorApplicationWrite {
  name: string;
  phone: string;
  city: string;
  wcaId?: string;
  specialties: string[];
  bio: string;
}

export interface PlatformOrderLineWrite {
  sellableType: 'course' | 'product_variant' | 'event_ticket' | 'platform_membership';
  sellableId: string;
  quantity: number;
}

export interface PlatformOrderWrite {
  lines: PlatformOrderLineWrite[];
  couponCode?: string;
  shippingAddressId?: string;
}
