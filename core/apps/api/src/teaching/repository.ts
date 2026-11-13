import type { TeachingSaasRepository } from './repository-contract.js';
import { organizationsRepository } from './repository/organizations.js';
import { operationsRepository } from './repository/operations.js';
import { campusesRepository } from './repository/campuses.js';
import { groupsRepository } from './repository/groups.js';
import { creditsRepository } from './repository/credits.js';
import { sessionsRepository } from './repository/sessions.js';
import { studentBindingsRepository } from './repository/student-bindings.js';
import { guardianBindingsRepository } from './repository/guardian-bindings.js';
import { conversationsRepository } from './repository/conversations.js';
import { learnersRepository } from './repository/learners.js';
import { trainingEvidenceRepository } from './repository/training-evidence.js';
import { trainingTemplatesRepository } from './repository/training-templates.js';
import { trainingAssignmentsRepository } from './repository/training-assignments.js';
import { trainingReviewsRepository } from './repository/training-reviews.js';
import { leavesRepository } from './repository/leaves.js';
import { makeupsRepository } from './repository/makeups.js';
import { feedbackRepository } from './repository/feedback.js';

export const teachingSaasRepository: TeachingSaasRepository = {
  ...organizationsRepository,
  ...operationsRepository,
  ...campusesRepository,
  ...groupsRepository,
  ...creditsRepository,
  ...sessionsRepository,
  ...studentBindingsRepository,
  ...guardianBindingsRepository,
  ...conversationsRepository,
  ...learnersRepository,
  ...trainingEvidenceRepository,
  ...trainingTemplatesRepository,
  ...trainingAssignmentsRepository,
  ...trainingReviewsRepository,
  ...leavesRepository,
  ...makeupsRepository,
  ...feedbackRepository,
};
