---
name: sync-course-english
description: Sync administrator-edited Chinese course content on CubeRoot /courses into natural English through the teaching admin API. Use when the user says 同步英文, 更新英文, 同步课程英文, or provides a /zh/courses link and asks AI to update the English version.
---

# Sync Course English

## Workflow

1. Work from `D:\cube\cuberoot.me\core`.
2. Fetch `https://api.cuberoot.me/v1/teaching/trial` with caching disabled and select records whose `needsEnglishSync` is `true`.
3. If the endpoint does not expose `needsEnglishSync`, report that migration 0134 and the teaching API must be deployed before syncing. If no records are pending, report that English is already current.
4. Translate each pending record's `titleZh`, `outcomeZh`, `shotsZh`, and `scriptZh` into natural spoken English.
5. Preserve every array's order and item count exactly. Keep production directions as directions, preserve proper names, and do not add or remove claims.
6. Use consistent cubing terms: 层先法 is beginner method, 公式 is algorithm, 指法 is finger tricks, 预判 is lookahead, 打乱 is scramble, and 观察 is inspection. Preserve CubeRoot, WCA, CFOP, OLL, PLL, and F2L.
7. Read `X-Admin-Key` from the repository-root `.password.md` without printing it. Send each translation with `PUT https://api.cuberoot.me/v1/teaching/trial/:lessonId/english`, including the fetched `contentRevision` as `sourceRevision`.
8. If a write returns `409`, refetch that lesson, translate the latest Chinese content, and retry once. Do not overwrite a newer Chinese edit with an older translation.
9. Fetch the records again. Require every processed record to have `needsEnglishSync` equal to `false`, then report the processed lesson IDs and count.

This is a database-only content sync. Do not edit source files or create a commit unless the schema or API itself needs repair. Never write the administrator key to source, logs, output, or this skill.
