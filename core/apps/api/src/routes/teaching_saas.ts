export { TeachingApiException } from '../teaching/errors.js';
export type { TeachingSaasRepository } from '../teaching/repository-contract.js';
export { teachingSaasRepository } from '../teaching/repository.js';
export { createTeachingSaasRoutes } from '../teaching/http/index.js';

import { createTeachingSaasRoutes } from '../teaching/http/index.js';

export const teachingSaasRoutes = createTeachingSaasRoutes();
