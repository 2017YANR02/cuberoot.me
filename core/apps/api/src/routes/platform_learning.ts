import { platformRouter } from '../platform/http.js';
import { registerIntegrationRoutes } from '../platform/learning/integration-routes.js';
import { registerQuizRoutes } from '../platform/learning/quiz-routes.js';
import { registerPrivacyRoutes } from '../platform/learning/privacy-routes.js';
import { registerEnrollmentRoutes } from '../platform/learning/enrollment-routes.js';
import { registerProgressRoutes } from '../platform/learning/progress-routes.js';
import { registerNoteRoutes } from '../platform/learning/note-routes.js';
import { registerFavoriteRoutes } from '../platform/learning/favorite-routes.js';
import { registerAchievementRoutes } from '../platform/learning/achievement-routes.js';
import { registerInviteRoutes } from '../platform/learning/invite-routes.js';
import { registerMediaRoutes } from '../platform/learning/media-routes.js';
import { registerReviewRoutes } from '../platform/learning/review-routes.js';
import { registerCertificateRoutes } from '../platform/learning/certificate-routes.js';
import { registerInstructorRoutes } from '../platform/learning/instructor-routes.js';


export const platformLearningRoutes = platformRouter();

registerIntegrationRoutes(platformLearningRoutes);
registerQuizRoutes(platformLearningRoutes);
registerPrivacyRoutes(platformLearningRoutes);
registerEnrollmentRoutes(platformLearningRoutes);
registerProgressRoutes(platformLearningRoutes);
registerNoteRoutes(platformLearningRoutes);
registerFavoriteRoutes(platformLearningRoutes);
registerAchievementRoutes(platformLearningRoutes);
registerInviteRoutes(platformLearningRoutes);
registerMediaRoutes(platformLearningRoutes);
registerReviewRoutes(platformLearningRoutes);
registerCertificateRoutes(platformLearningRoutes);
registerInstructorRoutes(platformLearningRoutes);
