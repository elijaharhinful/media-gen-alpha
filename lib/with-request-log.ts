import { type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteHandler<T = any> = (
  req: NextRequest,
  ctx: T,
) => Promise<Response>;

/**
 * Options to configure request logging behavior
 */
export interface RequestLogOptions {
  /** Skip logging entirely for these specific paths */
  ignorePaths?: string[];
  /** Only log if the response status is an error (>= 400) */
  logErrorsOnly?: boolean;
  /** Skip logging if it is a known cron job or background poll */
  skipCron?: boolean;
}

/**
 * Wraps a route handler with automatic request logging.
 * Captures: method, path, statusCode, durationMs, userId, ipAddress, userAgent, error.
 */
export function withRequestLog<T = any>(
  handler: RouteHandler<T>,
  options?: RequestLogOptions
): RouteHandler<T> {
  return async function wrappedHandler(
    req: NextRequest,
    ctx: T,
  ): Promise<Response> {
    const start = Date.now();
    const method = req.method;
    const path = new URL(req.url).pathname;

    // Extract client IP from common proxy headers
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const userAgent = req.headers.get("user-agent") ?? undefined;

    let statusCode = 200;
    let errorMsg: string | undefined;
    let userId: string | undefined;

    try {
      // Resolve session for userId. NextAuth JWT decode is fast (no DB call).
      try {
        const session = await getServerSession(authOptions);
        userId = (session?.user as any)?.id ?? undefined;
      } catch {
        // Never fail a request just because we couldn't read the session
      }

      const response = await handler(req, ctx);
      statusCode = response.status;
      return response;
    } catch (e: any) {
      statusCode = 500;
      errorMsg = e?.message ?? "Unknown error";
      throw e;
    } finally {
      const durationMs = Date.now() - start;

      // Determine if we should skip logging
      let shouldLog = true;

      if (options?.ignorePaths?.includes(path)) {
        shouldLog = false;
      }
      if (options?.skipCron && (req.headers.get("x-cron-secret") || userAgent?.includes("cron"))) {
        shouldLog = false;
      }
      if (options?.logErrorsOnly && statusCode < 400) {
        shouldLog = false;
      }

      if (!shouldLog) return;

      // Fire-and-forget — DB write must not block or affect the response
      prisma.requestLog
        .create({
          data: {
            method,
            path,
            statusCode,
            durationMs,
            userId: userId ?? null,
            ipAddress,
            userAgent: userAgent ?? null,
            error: errorMsg ?? null,
          },
        })
        .catch(() => {
          // Silent — logging must never crash the app
        });
    }
  };
}
