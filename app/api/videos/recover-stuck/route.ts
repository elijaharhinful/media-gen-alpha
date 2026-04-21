import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client, getBucketConfig } from "@/lib/aws-config";
import { getFileUrl } from "@/lib/s3";

const OPENROUTER_BASE = "https://openrouter.ai";

// Secure it so only cron or you can call it
function isAuthorized(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;

  const secret = req.headers.get("x-cron-secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No API key" }, { status: 500 });
  }

  // Fetch all stuck records that have a jobId
  // Cap at 20 per run to avoid timeout
  const stuckRecords = await prisma.generatedVideo.findMany({
    where: {
      status: { in: ["processing", "pending"] },
      jobId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  if (stuckRecords.length === 0) {
    return NextResponse.json({ message: "Nothing to recover", recovered: 0 });
  }

  const results = await Promise.allSettled(
    stuckRecords.map((record) => recoverVideo(record, apiKey)),
  );

  const summary = results.map((r, i) => ({
    id: stuckRecords[i].id,
    result:
      r.status === "fulfilled"
        ? r.value
        : {
            status: "error",
            error: String((r as PromiseRejectedResult).reason),
          },
  }));

  console.log("[recover-stuck] results:", JSON.stringify(summary));
  return NextResponse.json({ recovered: summary.length, summary });
}

async function recoverVideo(
  record: { id: string; jobId: string | null },
  apiKey: string,
) {
  const res = await fetch(`${OPENROUTER_BASE}/api/v1/videos/${record.jobId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://movie-gen-alpha.app",
      "X-Title": "Movie Gen Alpha - Video Generator",
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      await prisma.generatedVideo.update({
        where: { id: record.id },
        data: { status: "failed" },
      });
      return { status: "failed", reason: "job_expired" };
    }
    return { status: "poll_failed", httpStatus: res.status };
  }

  const data = await res.json();
  const orStatus: string = data?.status ?? "pending";
  const rawVideoUrl: string = data?.unsigned_urls?.[0] ?? "";

  if (orStatus === "failed" || orStatus === "error") {
    await prisma.generatedVideo.update({
      where: { id: record.id },
      data: { status: "failed" },
    });
    return { status: "failed" };
  }

  if (orStatus !== "completed" || !rawVideoUrl) {
    return { status: "still_processing" };
  }

  // Upload to S3
  let permanentUrl = rawVideoUrl;
  try {
    const { bucketName } = getBucketConfig();
    const s3 = createS3Client();

    const videoRes = await fetch(rawVideoUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!videoRes.ok) throw new Error(`Fetch failed: ${videoRes.status}`);

    const videoBuffer = await videoRes.arrayBuffer();
    const videoFileName = `generated/videos/${Date.now()}-${record.id}.mp4`;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: videoFileName,
        Body: Buffer.from(videoBuffer),
        ContentType: "video/mp4",
      }),
    );

    permanentUrl = (await getFileUrl(videoFileName, true)) ?? rawVideoUrl;
  } catch (s3Err) {
    console.error(`[recover-stuck] S3 upload failed for ${record.id}:`, s3Err);
    // Still mark completed with temporary URL
  }

  await prisma.generatedVideo.update({
    where: { id: record.id },
    data: { status: "completed", videoUrl: permanentUrl },
  });

  return { status: "completed", videoUrl: permanentUrl };
}
