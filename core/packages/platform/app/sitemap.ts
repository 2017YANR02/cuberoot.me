import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { list as listCourses } from "@/lib/db/courses";
import { list as listProducts } from "@/lib/db/products";
import { list as listEvents } from "@/lib/db/events";
import { list as listNews } from "@/lib/db/news";
import { listPosts } from "@/lib/db/posts";

export const dynamic = "force-dynamic";

const STATIC_PATHS: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/courses", priority: 0.9 },
  { path: "/shop", priority: 0.9 },
  { path: "/events", priority: 0.9 },
  { path: "/news", priority: 0.8 },
  { path: "/community", priority: 0.8 },
  { path: "/instructors", priority: 0.7 },
  { path: "/about", priority: 0.5 },
  { path: "/community/circle/newbie", priority: 0.6 },
  { path: "/community/circle/speed", priority: 0.6 },
  { path: "/community/circle/blind", priority: 0.6 },
  { path: "/community/circle/campus", priority: 0.6 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const fallback = new Date();

  const [courses, products, events, news, posts] = await Promise.all([
    listCourses(),
    listProducts(),
    listEvents(),
    listNews(),
    listPosts({ limit: 200 }),
  ]);

  const staticUrls: MetadataRoute.Sitemap = STATIC_PATHS.map((s) => ({
    url: `${base}${s.path}`,
    lastModified: fallback,
    priority: s.priority,
  }));

  const courseUrls: MetadataRoute.Sitemap = courses.map((c) => ({
    url: `${base}/courses/${c.id}`,
    lastModified: fallback,
    priority: 0.7,
  }));
  const productUrls: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${base}/shop/${p.id}`,
    lastModified: fallback,
    priority: 0.6,
  }));
  const eventUrls: MetadataRoute.Sitemap = events.map((e) => ({
    url: `${base}/events/${e.id}`,
    lastModified: fallback,
    priority: 0.6,
  }));
  const newsUrls: MetadataRoute.Sitemap = news.map((n) => ({
    url: `${base}/news/${n.id}`,
    lastModified: parseNewsDate(n.date) ?? fallback,
    priority: 0.5,
  }));
  const postUrls: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${base}/community/posts/${p.id}`,
    lastModified: new Date(p.createdAt * 1000),
    priority: 0.4,
  }));

  return [
    ...staticUrls,
    ...courseUrls,
    ...productUrls,
    ...eventUrls,
    ...newsUrls,
    ...postUrls,
  ];
}

function parseNewsDate(d: string): Date | null {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
