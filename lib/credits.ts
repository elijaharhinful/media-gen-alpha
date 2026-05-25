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
export async function getOpenRouterRemainingBalanceUsd(): Promise<number> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return 0;

  try {
    // Check key limits and remaining budget
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (res.ok) {
      const json = await res.json();
      
      // If a key-specific remaining limit is set, use it!
      const limitRemaining = json?.data?.limit_remaining;
      if (typeof limitRemaining === 'number' && limitRemaining > 0) {
        return limitRemaining;
      }
    }
  } catch (err) {
    console.error("OpenRouter /key check failed:", err);
  }

  try {
    // Fallback to checking total account credits (total_credits - total_usage = remaining balance)
    const creditsRes = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (creditsRes.ok) {
      const json = await creditsRes.json();
      const totalCredits = json?.data?.total_credits;
      const totalUsage = json?.data?.total_usage;
      if (typeof totalCredits === 'number' && typeof totalUsage === 'number') {
        return Math.max(0, totalCredits - totalUsage);
      }
    }
  } catch (err) {
    console.error("OpenRouter /credits check failed:", err);
  }

  return 0;
}

export async function getDynamicTotalPoolCredits(): Promise<number> {
  const cacheKey = 'openrouter:credits:pool';
  
  // Try retrieving cached pool limit
  const cachedPool = await cacheGet<number>(cacheKey);
  if (cachedPool !== null) return cachedPool;

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("No API key");

    // Fetch account-wide lifetime total deposited credits
    const creditsRes = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (creditsRes.ok) {
      const json = await creditsRes.json();
      const totalCredits = json?.data?.total_credits; // Lifetime loaded funds (stable pool)
      if (typeof totalCredits === 'number' && totalCredits > 0) {
        const pool = Math.floor(totalCredits * 100);
        await cacheSet(cacheKey, pool, 60); // cache for 1 minute (60s)
        return pool;
      }
    }
  } catch (err) {
    console.error("Failed to query lifetime deposits, trying fallback remaining limit:", err);
  }

  // Backup fallback: try remaining balance or env
  const balance = await getOpenRouterRemainingBalanceUsd();
  let pool = parseInt(process.env.TOTAL_CREDIT_POOL || '1000', 10);
  if (balance > 0) {
    pool = Math.floor(balance * 100);
  }
  await cacheSet(cacheKey, pool, 60);
  return pool;
}

export async function canUserUseTool(
  userId: string,
  tool: ToolType,
  options?: { customCost?: number }
): Promise<{ allowed: boolean; reason?: string }> {
  const cost = options?.customCost !== undefined ? options.customCost : CREDIT_COSTS[tool];
  // Include cost in cache key to avoid collisions between different usage tiers
  const cacheKey = `credits:${userId}:${tool}:${cost}`;

  // Check cache first
  const cached = await cacheGet<{ allowed: boolean; reason?: string }>(cacheKey);
  if (cached !== null) return cached;

  // Fetch user + credits in parallel
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

  // Admins or Exempt users have no limits
  if (user.role === 'ADMIN' || user.limitExempt) {
    const result = { allowed: true };
    await cacheSet(cacheKey, result, TTL.CREDIT_CHECK);
    return result;
  }

  // Check student credit limit
  if (user.creditLimit !== null && user.creditLimit !== undefined) {
    const totalPool = await getDynamicTotalPoolCredits();
    const maxCredits = Math.floor((user.creditLimit / 100) * totalPool);

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
  metadata?: Record<string, any>,
  customCost?: number
) {
  const finalCost = customCost !== undefined ? customCost : CREDIT_COSTS[tool];
  const [record] = await Promise.all([
    prisma.creditUsage.create({
      data: {
        userId,
        tool,
        cost: finalCost,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    }),
    // Invalidate credit cache so next check reflects the new usage
    cacheDel(`credits:${userId}:${tool}:${finalCost}`),
  ]);
  return record;
}
