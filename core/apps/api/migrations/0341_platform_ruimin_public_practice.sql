-- Publish the two former trial lessons alongside the other core lessons.
UPDATE platform_lessons AS lesson
SET access_scope = 'public'
FROM platform_courses AS course
WHERE course.id = lesson.course_id
  AND course.slug = 'yan-ruimin-3x3-beginner'
  AND course.id = '4ad6b1c8-9eb2-4801-bfd2-dfecd5d4aacc'::uuid
  AND lesson.id IN ('1abcf23c-6bf4-4cc5-adbe-e15d380cc05b'::uuid, 'f17294e1-dcf5-4c93-853b-0f2e42ca88b8'::uuid)
  AND lesson.slug IN ('trial-01', 'trial-02')
  AND lesson.status = 'published'
  AND lesson.access_scope = 'entitled';
