import { Hono } from "hono";
import {
  fetchCubingCompetitions,
  fetchCubingCompetitors,
} from "../utils/cubing_source.js";
export const drawRoutes = new Hono();
drawRoutes.get("/draw/competitions", async (c) => {
  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  if (q.length > 100) return c.json({ error: "Query too long" }, 400);
  try {
    const rows = await fetchCubingCompetitions();
    c.header("Cache-Control", "public, max-age=120");
    if (c.req.query("picker") === "1") {
      return c.json({
        competitions: rows
          .slice()
          .sort((a, b) => b.startDate.localeCompare(a.startDate))
          .map((r) => ({
            id: r.alias,
            name: r.name,
            name_zh: r.nameZh,
            country: r.locations[0]?.regionIso2 ?? "",
            start_date: r.startDate,
            end_date: r.endDate || r.startDate,
            events: r.events.map((e) => e.eventId),
          })),
      });
    }
    return c.json({
      competitions: rows
        .filter((r) =>
          `${r.name} ${r.nameZh} ${r.alias}`.toLowerCase().includes(q),
        )
        .sort((a, b) => b.startDate.localeCompare(a.startDate))
        .slice(0, 50)
        .map((r) => ({
          id: r.alias,
          name: r.nameZh || r.name,
          date: r.startDate,
        })),
    });
  } catch {
    return c.json({ error: "Registration source unavailable" }, 503);
  }
});
drawRoutes.get("/draw/competitions/:id/registrations", async (c) => {
  const id = c.req.param("id");
  if (!/^[A-Za-z0-9-]{1,120}$/.test(id))
    return c.json({ error: "Invalid competition" }, 400);
  try {
    const users = await fetchCubingCompetitors(id);
    c.header("Cache-Control", "public, max-age=60");
    return c.json({
      text: Object.values(users)
        .sort((a, b) => a.number - b.number)
        .map((u) => `#${u.number} ${u.name}`)
        .join("\n"),
      source: `https://cubing.com/competition/${id}/competitors`,
    });
  } catch {
    return c.json({ error: "Registration source unavailable" }, 503);
  }
});
