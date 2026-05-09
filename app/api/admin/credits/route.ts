export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-auth';
import { prisma } from '@/lib/prisma';
import { getTotalPoolCredits } from '@/lib/credits';
import { cacheGet, cacheSet, TTL } from '@/lib/cache';
import { withRequestLog } from '@/lib/with-request-log';

async function _GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30', 10);

  const cacheKey = `admin:credits:${days}`;
  const cached = await cacheGet<object>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const since = new Date();
  since.setDate(since.getDate() - days);

  // All 6 aggregation queries run in parallel
  const [totalUsage, recentUsage, usageByTool, usageByUser, totalUsers, totalStudents] =
    await Promise.all([
      prisma.creditUsage.aggregate({ _sum: { cost: true } }),
      prisma.creditUsage.aggregate({
        where: { createdAt: { gte: since } },
        _sum: { cost: true },
        _count: true,
      }),
      prisma.creditUsage.groupBy({
        by: ['tool'],
        _sum: { cost: true },
        _count: true,
      }),
      prisma.creditUsage.groupBy({
        by: ['userId'],
        _sum: { cost: true },
        _count: true,
        orderBy: { _sum: { cost: 'desc' } },
        take: 10,
      }),
      prisma.user.count(),
      prisma.user.count({ where: { role: 'STUDENT' } }),
    ]);

  // Fixed: user detail lookup now runs immediately after we have the IDs.
  // Still a separate query but no longer sequentially after the parallel block —
  // logically it depends on usageByUser so it can't be fully parallelised.
  const topUserIds = usageByUser.map((u) => u.userId);
  const topUsers = await prisma.user.findMany({
    where: { id: { in: topUserIds } },
    select: { id: true, name: true, email: true, role: true },
  });

  const topUsersMap = new Map(topUsers.map((u) => [u.id, u]));

  const payload = {
    totalPool:   getTotalPoolCredits(),
    totalUsed:   totalUsage._sum.cost ?? 0,
    recentUsed:  recentUsage._sum.cost ?? 0,
    recentCount: recentUsage._count ?? 0,
    usageByTool: usageByTool.map((t) => ({
      tool:         t.tool,
      totalCredits: t._sum.cost ?? 0,
      count:        t._count,
    })),
    topUsers: usageByUser.map((u) => ({
      ...topUsersMap.get(u.userId),
      creditsUsed:     u._sum.cost ?? 0,
      generationCount: u._count,
    })),
    totalUsers,
    totalStudents,
    days,
  };

  await cacheSet(cacheKey, payload, TTL.ADMIN_CREDITS);
  return NextResponse.json(payload);
}

export const GET = withRequestLog(_GET);
