export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cacheGet, cacheSet, TTL } from '@/lib/cache';
import { withRequestLog } from '@/lib/with-request-log';
import { createHash } from 'crypto';

async function _GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const search   = url?.searchParams?.get('search') ?? '';
    const platform = url?.searchParams?.get('platform') ?? '';
    const hasPrompt = url?.searchParams?.get('hasPrompt') ?? '';
    const creator  = url?.searchParams?.get('creator') ?? '';

    // Build a stable cache key from the query params
    const cacheKey = `catalogue:${createHash('md5')
      .update(`${search}|${platform}|${hasPrompt}|${creator}`)
      .digest('hex')}`;

    const cached = await cacheGet<object>(cacheKey);
    if (cached) return Response.json(cached);

    const where: any = {
      status: { not: 'UNAVAILABLE' },
    };

    if (search) {
      where.OR = [
        { caption:    { contains: search,   mode: 'insensitive' } },
        { promptText: { contains: search,   mode: 'insensitive' } },
        { creator:    { contains: search,   mode: 'insensitive' } },
        { videoType:  { contains: search,   mode: 'insensitive' } },
      ];
    }
    if (platform) where.platform = platform;
    if (hasPrompt === 'true') where.promptText = { not: null };
    if (creator) where.creator = { contains: creator, mode: 'insensitive' };

    // Fixed: was two separate queries (filtered + full-table-scan for filter options).
    // Now runs both in parallel and derives filter values from the lightweight query.
    const [videos, filterSource] = await Promise.all([
      prisma.exampleVideo.findMany({
        where,
        orderBy: [{ likes: 'desc' }, { createdAt: 'desc' }],
      }),
      // Lightweight select-only query for global unique filter values
      prisma.exampleVideo.findMany({
        where: { status: { not: 'UNAVAILABLE' } },
        select: { platform: true, creator: true, style: true },
      }),
    ]);

    const platforms = [...new Set(filterSource.map((v: any) => v?.platform).filter(Boolean))];
    const creators  = [...new Set(filterSource.map((v: any) => v?.creator).filter(Boolean))];
    const styles    = [...new Set(filterSource.map((v: any) => v?.style).filter(Boolean))];

    const payload = {
      videos: videos ?? [],
      filters: { platforms, creators, styles },
    };

    // Cache the result
    await cacheSet(cacheKey, payload, TTL.CATALOGUE);

    return Response.json(payload);
  } catch (error: any) {
    console.error('Catalogue API error:', error);
    return Response.json(
      { videos: [], filters: { platforms: [], creators: [], styles: [] } },
      { status: 500 }
    );
  }
}

export const GET = withRequestLog(_GET);
