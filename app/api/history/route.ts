export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withRequestLog } from '@/lib/with-request-log';

async function _GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const page   = parseInt(url?.searchParams?.get('page')  ?? '1',  10);
    const limit  = parseInt(url?.searchParams?.get('limit') ?? '20', 10);
    const search = url?.searchParams?.get('search') ?? '';

    const where = search
      ? {
          OR: [
            { originalInput:  { contains: search, mode: 'insensitive' as const } },
            { enhancedOutput: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [prompts, total] = await Promise.all([
      prisma.generatedPrompt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.generatedPrompt.count({ where }),
    ]);

    return Response.json({
      prompts: prompts ?? [],
      total:   total   ?? 0,
      page,
      totalPages: Math.ceil((total ?? 0) / limit),
    });
  } catch (error: any) {
    console.error('History API error:', error);
    return Response.json({ prompts: [], total: 0, page: 1, totalPages: 0 }, { status: 500 });
  }
}

export const GET = withRequestLog(_GET);
