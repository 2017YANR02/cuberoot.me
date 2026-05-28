import type { MetadataRoute } from 'next';

// Served at /robots.txt. Allow everything, point crawlers at the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://cuberoot.me/sitemap.xml',
  };
}
