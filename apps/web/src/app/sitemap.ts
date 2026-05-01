import type { MetadataRoute } from 'next';

const SITE = 'https://flow.kodspot.co.in';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE}/signup`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
  ];
}
