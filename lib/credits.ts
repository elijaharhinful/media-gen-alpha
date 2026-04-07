import { prisma } from '@/lib/prisma';
import { ToolType } from '@prisma/client';

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
export async function canUserUseTool(
  userId: string,
  tool: ToolType
): Promise<{ allowed: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { allowed: false, reason: 'User not found' };
  if (user.isBlocked) return { allowed: false, reason: 'Account is blocked by admin' };

  // Admins have no limits
  if (user.role === 'ADMIN') return { allowed: true };

  // Check student credit limit
  if (user.creditLimit !== null && user.creditLimit !== undefined) {
    const totalPool = getTotalPoolCredits();
    const maxCredits = Math.floor((user.creditLimit / 100) * totalPool);
    const used = await getUserCreditsUsed(userId);
    const cost = CREDIT_COSTS[tool];

    if (used + cost > maxCredits) {
      return {
        allowed: false,
        reason: `Credit limit reached (${used}/${maxCredits} used). Contact your admin.`,
      };
    }
  }

  return { allowed: true };
}

// Record credit usage
export async function recordCreditUsage(
  userId: string,
  tool: ToolType,
  metadata?: Record<string, any>
) {
  return prisma.creditUsage.create({
    data: {
      userId,
      tool,
      cost: CREDIT_COSTS[tool],
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}
