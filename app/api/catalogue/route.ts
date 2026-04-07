export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const search = url?.searchParams?.get('search') ?? '';
    const platform = url?.searchParams?.get('platform') ?? '';
    const hasPrompt = url?.searchParams?.get('hasPrompt') ?? '';
    const creator = url?.searchParams?.get('creator') ?? '';

    const where: any = {
      status: { not: 'UNAVAILABLE' },
    };

    if (search) {
      where.OR = [
        { caption: { contains: search, mode: 'insensitive' } },
        { promptText: { contains: search, mode: 'insensitive' } },
        { creator: { contains: search, mode: 'insensitive' } },
        { videoType: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (platform) {
      where.platform = platform;
    }

    if (hasPrompt === 'true') {
      where.promptText = { not: null };
    }

    if (creator) {
      where.creator = { contains: creator, mode: 'insensitive' };
    }

    const videos = await prisma.exampleVideo.findMany({
      where,
      orderBy: [{ likes: 'desc' }, { createdAt: 'desc' }],
    });

    // Get unique filter values
    const allVideos = await prisma.exampleVideo.findMany({
      where: { status: { not: 'UNAVAILABLE' } },
      select: { platform: true, creator: true, style: true },
    });

    const platforms = [...new Set((allVideos ?? [])?.map?.((v: any) => v?.platform)?.filter?.(Boolean) ?? [])];
    const creators = [...new Set((allVideos ?? [])?.map?.((v: any) => v?.creator)?.filter?.(Boolean) ?? [])];
    const styles = [...new Set((allVideos ?? [])?.map?.((v: any) => v?.style)?.filter?.(Boolean) ?? [])];

    return Response.json({
      videos: videos ?? [],
      filters: { platforms, creators, styles },
    });
  } catch (error: any) {
    console.error('Catalogue API error:', error);
    return Response.json({ videos: [], filters: { platforms: [], creators: [], styles: [] } }, { status: 500 });
  }
}
