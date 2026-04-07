export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUserUseTool, recordCreditUsage } from "@/lib/credits";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client, getBucketConfig } from "@/lib/aws-config";
import { getFileUrl } from "@/lib/s3";

// OpenRouter video generation uses an async/polling pattern:
// 1. POST to /api/alpha/videos/generations → get a generation ID
// 2. Poll GET /api/alpha/videos/generations/:id until status === 'completed'
const OPENROUTER_BASE = "https://openrouter.ai";

async function pollVideoStatus(
  generationId: string,
  apiKey: string,
  maxAttempts = 30,
  intervalMs = 5000,
): Promise<{ videoUrl: string; status: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs));

    const res = await fetch(
      `${OPENROUTER_BASE}/api/alpha/videos/generations/${generationId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://movie-gen-alpha.app",
          "X-Title": "Movie Gen Alpha – Video Generator",
        },
      },
    );

    if (!res.ok) continue;

    const data = await res.json();
    const status: string = data?.status ?? "pending";

    if (status === "completed") {
      const videoUrl: string =
        data?.video?.url ?? data?.url ?? data?.output?.url ?? "";
      return { videoUrl, status: "completed" };
    }

    if (status === "failed" || status === "error") {
      return { videoUrl: "", status: "failed" };
    }
  }

  // Timed out — mark as still processing
  return { videoUrl: "", status: "processing" };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, referenceImages, resolution, aspectRatio, duration } =
      body ?? {};

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    // Check credits
    const creditCheck = await canUserUseTool(
      session.user.id,
      "VIDEO_GENERATOR",
    );
    if (!creditCheck.allowed) {
      return NextResponse.json({ error: creditCheck.reason }, { status: 403 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 500 },
      );
    }

    const model =
      process.env.OPENROUTER_VIDEO_MODEL ?? "bytedance/seedance-2.0";

    // Save the video generation job to the database
    const record = await prisma.generatedVideo.create({
      data: {
        prompt,
        referenceImages: referenceImages || [],
        resolution: resolution || "720p",
        aspectRatio: aspectRatio || "16:9",
        duration: duration || "5s",
        status: "pending",
        userId: session.user.id,
      },
    });

    try {
      // Step 1 — Submit video generation request to OpenRouter
      const requestBody: any = {
        model,
        prompt,
        resolution: resolution || "720p",
        aspect_ratio: aspectRatio || "16:9",
        duration: duration || "5s",
      };

      if (referenceImages?.length > 0) {
        requestBody.reference_images = referenceImages;
      }

      const response = await fetch(
        `${OPENROUTER_BASE}/api/alpha/videos/generations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://movie-gen-alpha.app",
            "X-Title": "Movie Gen Alpha - Video Generator",
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error("OpenRouter video submission error:", errText);
        await prisma.generatedVideo.update({
          where: { id: record.id },
          data: { status: "failed" },
        });
        await recordCreditUsage(session.user.id, "VIDEO_GENERATOR", {
          videoId: record.id,
          prompt: prompt.substring(0, 100),
        });
        return NextResponse.json({
          id: record.id,
          status: "failed",
          prompt,
          message: "Video generation request failed.",
        });
      }

      const submissionData = await response.json();
      const generationId: string = submissionData?.id ?? "";

      if (!generationId) {
        // No generation ID — possibly a synchronous response with a direct URL
        const directUrl: string =
          submissionData?.video?.url ??
          submissionData?.url ??
          submissionData?.output?.url ??
          "";

        await prisma.generatedVideo.update({
          where: { id: record.id },
          data: {
            videoUrl: directUrl || null,
            status: directUrl ? "completed" : "processing",
          },
        });
        await recordCreditUsage(session.user.id, "VIDEO_GENERATOR", {
          videoId: record.id,
          prompt: prompt.substring(0, 100),
        });
        return NextResponse.json({
          id: record.id,
          videoUrl: directUrl,
          status: directUrl ? "completed" : "processing",
          prompt,
          message: directUrl
            ? undefined
            : "Video is being processed. Check back shortly.",
        });
      }

      // Step 2 — Poll for completion
      const { videoUrl, status } = await pollVideoStatus(generationId, apiKey);

      const { bucketName } = getBucketConfig();
      const s3 = createS3Client();

      const res = await fetch(videoUrl);
      const videoBuffer = await res.arrayBuffer();
      const videoFileName = `generated/videos/${Date.now()}.mp4`;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: videoFileName,
          Body: Buffer.from(videoBuffer),
          ContentType: "video/mp4",
        }),
      );

      const permanentUrl = await getFileUrl(videoFileName, true);

      await prisma.generatedVideo.update({
        where: { id: record.id },
        data: { videoUrl: permanentUrl || null, status },
      });

      await recordCreditUsage(session.user.id, "VIDEO_GENERATOR", {
        videoId: record.id,
        prompt: prompt.substring(0, 100),
      });

      return NextResponse.json({
        id: record.id,
        videoUrl,
        status,
        prompt,
        message:
          status === "processing"
            ? "Video is still being processed. Check back shortly."
            : undefined,
      });
    } catch (apiError: any) {
      console.error("Video API call failed:", apiError);
      await prisma.generatedVideo.update({
        where: { id: record.id },
        data: { status: "failed" },
      });
      await recordCreditUsage(session.user.id, "VIDEO_GENERATOR", {
        videoId: record.id,
        prompt: prompt.substring(0, 100),
      });
      return NextResponse.json({
        id: record.id,
        status: "failed",
        prompt,
        message: "Video generation failed.",
      });
    }
  } catch (error: any) {
    console.error("Video generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
