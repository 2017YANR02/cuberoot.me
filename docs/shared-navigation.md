# Shared workspace navigation

2026-10-20: internal `/workspace` adopts App Foundation `navigation-ui` 0.1.0, the same local artifact as Mira. Global navigation is unchanged. Routes, translated labels, admin-only member entry, workspace API and account state remain in `core/packages/client/app/[lang]/workspace/page.tsx`; theme and expanded width are in its `workspace.css`. Shared geometry, animations and inverse corner live in the versioned package.

Client typecheck and packaged rendering/host adapter/labels/geometry checks passed; CSS parsed. No browser or business acceptance. Uncommitted local integration, no publication or deployment. Replace the local artifact pin with an immutable release before deployment.

2026-10-20 follow-up: candidate 0.1.2 also powers `/contact` section navigation (details, joining instructions and existing group directories). Native anchors preserve direct section links; contact values, copy controls, QR popovers and membership visibility remain unchanged. Same artifact as Mira admin/notifications/internal workbenches. Typecheck and grouped/badge/embedded-content adapter checks passed; owner visual acceptance pending. No commit or deployment.
