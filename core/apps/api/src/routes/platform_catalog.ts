import { platformRouter } from '../platform/http.js';
import { registerLessonRoutes } from '../platform/catalog/lesson-routes.js';
import { registerPathRoutes } from '../platform/catalog/path-routes.js';
import { registerPublicRoutes } from '../platform/catalog/public-routes.js';
import { registerInstructorRoutes } from '../platform/catalog/instructor-routes.js';
import { registerCourseRoutes } from '../platform/catalog/course-routes.js';
import { registerLessonMediaRoutes } from '../platform/catalog/lesson-media-routes.js';
import { registerQuizRoutes } from '../platform/catalog/quiz-routes.js';

export { driveVideoNodeId } from '../platform/catalog/drive-media.js';

export const platformCatalogRoutes = platformRouter();

registerLessonRoutes(platformCatalogRoutes);
registerPathRoutes(platformCatalogRoutes);
registerPublicRoutes(platformCatalogRoutes);
registerInstructorRoutes(platformCatalogRoutes);
registerCourseRoutes(platformCatalogRoutes);
registerLessonMediaRoutes(platformCatalogRoutes);
registerQuizRoutes(platformCatalogRoutes);
