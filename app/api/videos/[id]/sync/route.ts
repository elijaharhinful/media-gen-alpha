import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client, getBucketConfig } from "@/lib/aws-config";
import { getFileUrl } from "@/lib/s3";

const OPENROUTER_BASE = "https://openrouter.ai";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const record = await prisma.generatedVideo.findUnique({
      where: { id: params.id },
    });

    if (!record) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (record.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Already done — nothing to recover
    if (record.status === "completed" && record.videoUrl) {
      return NextResponse.json({
        id: record.id,
        status: "completed",
        videoUrl: record.videoUrl,
        message: "Already completed.",
      });
    }

    const body = await _req.json().catch(() => ({}));
    const jobId: string = record.jobId ?? body.jobId ?? "";

    if (!jobId) {
      return NextResponse.json(
        {
          error:
            "No jobId on record. Pass { jobId: '...' } in the request body to recover manually.",
        },
        { status: 422 },
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 500 },
      );
    }

    // Poll OpenRouter once for current status 
    const res = await fetch(`${OPENROUTER_BASE}/api/v1/videos/${jobId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://movie-gen-alpha.app",
        "X-Title": "Movie Gen Alpha – Video Generator",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("OpenRouter poll error:", text);
      return NextResponse.json(
        { error: "Failed to poll OpenRouter", detail: text },
        { status: 502 },
      );
    }

    const data = await res.json();
    const orStatus: string = data?.status ?? "pending";
    const rawVideoUrl: string = data?.unsigned_urls?.[0] ?? "";

    if (orStatus === "failed" || orStatus === "error") {
      await prisma.generatedVideo.update({
        where: { id: record.id },
        data: { status: "failed" },
      });
      return NextResponse.json({ id: record.id, status: "failed" });
    }

    if (orStatus !== "completed" || !rawVideoUrl) {
      // Still processing upstream — nothing to do yet
      return NextResponse.json({
        id: record.id,
        status: "processing",
        message: "Video is still processing on OpenRouter. Try again shortly.",
      });
    }

    // Completed — upload to S3
    let permanentUrl = rawVideoUrl;

    try {
      const { bucketName } = getBucketConfig();
      const s3 = createS3Client();

      const videoRes = await fetch(rawVideoUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!videoRes.ok) throw new Error(`Fetch failed: ${videoRes.status}`);

      const videoBuffer = await videoRes.arrayBuffer();
      const videoFileName = `generated/videos/${Date.now()}.mp4`;

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
      console.error("S3 upload failed, keeping OpenRouter URL:", s3Err);
    }

    await prisma.generatedVideo.update({
      where: { id: record.id },
      data: {
        status: "completed",
        videoUrl: permanentUrl,
        jobId: jobId,
      },
    });

    return NextResponse.json({
      id: record.id,
      status: "completed",
      videoUrl: permanentUrl,
    });
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
