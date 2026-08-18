import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAIN_SITE_TOOLS } from "../lib/main-site";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("Platform training-tool reuse boundary", () => {
  it("uses only canonical main-site training routes", () => {
    expect(MAIN_SITE_TOOLS).toEqual({
      timer: "https://cuberoot.me/zh/timer",
      predict: "https://cuberoot.me/zh/predict",
      algorithms: "https://cuberoot.me/zh/alg",
      simulator: "https://cuberoot.me/zh/sim",
    });

    const notice = source("components/MainSiteToolNotice.tsx");
    expect(notice).toContain("<a");
    expect(notice).toContain("href={href}");
  });

  it("keeps the legacy timer entry free of history reads, exports, and writes", () => {
    const component = source("components/CubeTimer.tsx");
    const page = source("app/timer/page.tsx");
    const actions = source("app/actions/timer.ts");
    const database = source("lib/db/timer.ts");

    expect(component).toContain("MAIN_SITE_TOOLS.timer");
    expect(component).not.toContain("localStorage");
    expect(page).not.toContain("listRecent");
    expect(page).not.toContain("listLegacyTimerHistory");
    expect(page).not.toMatch(/导出|迁移旧计时/);
    expect(actions).toContain("legacy_timer_read_only");
    expect(actions).not.toMatch(/\b(?:insertSolve|updatePenalty|deleteSolve)\s*\(/);
    expect(database).not.toMatch(
      /export async function (?:insertSolve|updatePenalty|deleteSolve|listLegacyTimerHistory)\b/,
    );
  });

  it("does not expose legacy timer history through leaderboards or badges", () => {
    const leaderboard = [
      source("app/leaderboard/page.tsx"),
      source("components/LeaderboardTabs.tsx"),
      source("lib/db/leaderboard.ts"),
      source("lib/search-params.ts"),
      source("app/progress/page.tsx"),
    ].join("\n");
    expect(leaderboard).not.toMatch(
      /timerSolves|timer_solves|speedBoard|formatSolveMs|速拧榜|最快单次/,
    );

    const achievements = [
      source("app/me/badges/page.tsx"),
      source("components/BadgeWall.tsx"),
      source("lib/db/achievements.ts"),
    ].join("\n");
    expect(achievements).not.toMatch(
      /timerSolves|first_solve|solves_100|sub_10s|category: "timer"/,
    );
    expect(source("lib/db/achievements.ts")).toContain(
      "filter((key) => BY_KEY.has(key))",
    );
  });

  it("retires Platform algorithm reads and writes in favor of the main site", () => {
    for (const relativePath of [
      "app/algorithms/page.tsx",
      "app/algorithms/[id]/page.tsx",
      "app/admin/(authed)/algorithms/page.tsx",
      "app/admin/(authed)/algorithms/new/page.tsx",
      "app/admin/(authed)/algorithms/[id]/page.tsx",
    ]) {
      const file = source(relativePath);
      expect(file, relativePath).toContain("MAIN_SITE_TOOLS.algorithms");
      expect(file, relativePath).not.toContain("@/lib/db/algorithms");
      expect(file, relativePath).not.toContain("AlgorithmForm");
      expect(file, relativePath).not.toContain("已迁移到主站");
    }

    const actions = source("app/admin/(authed)/algorithms/actions.ts");
    expect(actions).toContain("main_site_algorithms_only");
    expect(actions).not.toContain("@/lib/db/algorithms");
    expect(source("app/admin/_components/AdminNav.tsx")).not.toContain(
      'href: "/admin/algorithms"',
    );
  });

  it("reuses the canonical tool map from Platform navigation surfaces", () => {
    for (const relativePath of [
      "components/SiteHeader.tsx",
      "components/SiteFooter.tsx",
      "app/me/page.tsx",
      "app/progress/page.tsx",
    ]) {
      expect(source(relativePath), relativePath).toContain("MAIN_SITE_TOOLS");
    }

    const progress = source("app/progress/page.tsx");
    expect(progress).not.toContain('href: "/timer"');
    expect(progress).not.toContain('href: "/algorithms"');
    expect(progress).not.toContain('href: "/admin/algorithms"');
  });

  it("preserves old tables and migrations without exposing a migration workflow", () => {
    const schema = source("db/schema.ts");
    const timerMigration = source("db/migrations/0026_slimy_nomad.sql");
    const algorithmMigration = source("db/migrations/0028_wandering_annihilus.sql");

    expect(schema).toContain("timerSolves");
    expect(schema).toContain("studyCheckins");
    expect(schema).toContain("algorithms");
    expect(timerMigration).toContain("timer_solves");
    expect(timerMigration).toContain("study_checkins");
    expect(algorithmMigration).toContain("algorithms");
  });
});
