import type { Context, Hono } from 'hono';
import type { TeachingActor } from '../../utils/teaching_platform_assertion.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export interface TeachingRouteContext {
  routes: Hono;
  repository: TeachingSaasRepository;
  withActor(c: Context, handler: (actor: TeachingActor, requestId: string) => Promise<Response>): Promise<Response>;
}
