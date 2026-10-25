/** @module Hour-precision work intervals; absent intervals preserve legacy reports. */
import { z } from 'zod';

export const reportHoursInput = z.object({
  startHour: z.number().int().min(0).max(23).nullable().optional(),
  endHour: z.number().int().min(1).max(24).nullable().optional(),
}).refine(value => (value.startHour == null && value.endHour == null)
  || (value.startHour != null && value.endHour != null && value.startHour < value.endHour),
{ message: '请选择有效的起止小时 / Select a valid hour range' });
