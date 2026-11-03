import type { AnalyticsReportAudience, ProductAnalyticsReport } from '@cuberoot/shared/product-analytics';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { sessionFetch } from './session-fetch';

export async function fetchProductAnalytics(days: number, audience: AnalyticsReportAudience, signal?: AbortSignal): Promise<ProductAnalyticsReport> {
  return handleApi<ProductAnalyticsReport>(await sessionFetch(apiUrl(`/v1/platform/admin/product-analytics?days=${days}&audience=${audience}`), {
    headers: authHeaders(false), cache: 'no-store', signal,
  }));
}
