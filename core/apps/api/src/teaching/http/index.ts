import { Hono, type Context } from 'hono';
import { authenticateTeachingActor, type TeachingActor } from '../../utils/teaching_platform_assertion.js';
import { teachingSaasRepository } from '../repository.js';
import { requestIdOf } from './request.js';
import { errorResponse } from './errors.js';
import { type TeachingSaasRepository } from '../repository-contract.js';
import { registerOrganizationsRoutes } from './organizations.js';
import { registerOperationsRoutes } from './operations.js';
import { registerStudentBindingsRoutes } from './student-bindings.js';
import { registerGuardianBindingsRoutes } from './guardian-bindings.js';
import { registerLearnersRoutes } from './learners.js';
import { registerConversationsRoutes } from './conversations.js';
import { registerTrainingEvidenceRoutes } from './training-evidence.js';
import { registerTrainingTemplatesRoutes } from './training-templates.js';
import { registerTrainingAssignmentsRoutes } from './training-assignments.js';
import { registerTrainingReviewsRoutes } from './training-reviews.js';
import { registerCampusesRoutes } from './campuses.js';
import { registerGroupsRoutes } from './groups.js';
import { registerCreditsRoutes } from './credits.js';
import { registerFeedbackRoutes } from './feedback.js';
import { registerSessionsRoutes } from './sessions.js';
import { registerLeavesRoutes } from './leaves.js';
import { registerMakeupsRoutes } from './makeups.js';

export function createTeachingSaasRoutes(deps: {
  authenticate?: (c: Context) => Promise<TeachingActor>;
  repository?: TeachingSaasRepository;
} = {}): Hono {
  const routes = new Hono();

  const authenticate = deps.authenticate ?? authenticateTeachingActor;

  const repository = deps.repository ?? teachingSaasRepository;

  async function withActor(
    c: Context,
    handler: (actor: TeachingActor, requestId: string) => Promise<Response>,
  ): Promise<Response> {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      return await handler(actor, requestId);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  }

  const context = { routes, repository, withActor };
  registerOrganizationsRoutes(context);
  registerOperationsRoutes(context);
  registerStudentBindingsRoutes(context);
  registerGuardianBindingsRoutes(context);
  registerLearnersRoutes(context);
  registerConversationsRoutes(context);
  registerTrainingEvidenceRoutes(context);
  registerTrainingTemplatesRoutes(context);
  registerTrainingAssignmentsRoutes(context);
  registerTrainingReviewsRoutes(context);
  registerCampusesRoutes(context);
  registerGroupsRoutes(context);
  registerCreditsRoutes(context);
  registerFeedbackRoutes(context);
  registerSessionsRoutes(context);
  registerLeavesRoutes(context);
  registerMakeupsRoutes(context);
  return routes;
}
