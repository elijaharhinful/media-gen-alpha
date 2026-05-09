import { prisma } from '@/lib/prisma';
import { ToolType } from '@prisma/client';
import { cacheGet, cacheSet, cacheDel, TTL } from '@/lib/cache';

// Credit costs per tool
export const CREDIT_COSTS: Record<ToolType, number> = {
  IMAGE_GENERATOR: 2,
  VIDEO_GENERATOR: 5,
  PROMPT_MULTIPLIER: 1,
};

// Total credits in the pool (configurable via env)
export function getTotalPoolCredits(): number {
  return parseInt(process.env.TOTAL_CREDIT_POOL || '1000', 10);
}

// Get total credits consumed by a user
export async function getUserCreditsUsed(userId: string): Promise<number> {
  const result = await prisma.creditUsage.aggregate({
    where: { userId },
    _sum: { cost: true },
  });
  return result._sum.cost ?? 0;
}

// Get total credits consumed by all users
export async function getTotalCreditsUsed(): Promise<number> {
  const result = await prisma.creditUsage.aggregate({
    _sum: { cost: true },
  });
  return result._sum.cost ?? 0;
}

// Check if user can use a tool (returns { allowed, reason })
// Results are cached for TTL.CREDIT_CHECK seconds to reduce DB load on
// rapid successive generation requests.
export async function canUserUseTool(
  userId: string,
  tool: ToolType
): Promise<{ allowed: boolean; reason?: string }> {
  const cacheKey = `credits:${userId}:${tool}`;

  // Check cache first
  const cached = await cacheGet<{ allowed: boolean; reason?: string }>(cacheKey);
  if (cached !== null) return cached;

  // Fetch user + credits in parallel (was 2 serial round-trips)
  const [user, used] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getUserCreditsUsed(userId),
  ]);

  if (!user) {
    const result = { allowed: false, reason: 'User not found' };
    await cacheSet(cacheKey, result, TTL.CREDIT_CHECK);
    return result;
  }

  if (user.isBlocked) {
    const result = { allowed: false, reason: 'Account is blocked by admin' };
    await cacheSet(cacheKey, result, TTL.CREDIT_CHECK);
    return result;
  }

  // Admins have no limits
  if (user.role === 'ADMIN') {
    const result = { allowed: true };
    await cacheSet(cacheKey, result, TTL.CREDIT_CHECK);
    return result;
  }

  // Check student credit limit
  if (user.creditLimit !== null && user.creditLimit !== undefined) {
    const totalPool = getTotalPoolCredits();
    const maxCredits = Math.floor((user.creditLimit / 100) * totalPool);
    const cost = CREDIT_COSTS[tool];

    if (used + cost > maxCredits) {
      const result = {
        allowed: false,
        reason: `Credit limit reached (${used}/${maxCredits} used). Contact your admin.`,
      };
      await cacheSet(cacheKey, result, TTL.CREDIT_CHECK);
      return result;
    }
  }

  const result = { allowed: true };
  await cacheSet(cacheKey, result, TTL.CREDIT_CHECK);
  return result;
}

// Record credit usage and invalidate the credit cache for this user+tool
export async function recordCreditUsage(
  userId: string,
  tool: ToolType,
  metadata?: Record<string, any>
) {
  const [record] = await Promise.all([
    prisma.creditUsage.create({
      data: {
        userId,
        tool,
        cost: CREDIT_COSTS[tool],
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    }),
    // Invalidate credit cache so next check reflects the new usage
    cacheDel(`credits:${userId}:${tool}`),
  ]);
  return record;
}
