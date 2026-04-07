import { MetadataRoute } from 'next';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  let siteUrl = 'http://localhost:3000';
  try {
    const headerList = headers();
    const host = headerList?.get?.('x-forwarded-host') ?? headerList?.get?.('host') ?? '';
    if (host) {
      siteUrl = `https://${host}`;
    }
  } catch {
    // fallback
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
