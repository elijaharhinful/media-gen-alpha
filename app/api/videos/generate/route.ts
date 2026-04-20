export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUserUseTool, recordCreditUsage } from "@/lib/credits";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client, getBucketConfig } from "@/lib/aws-config";
import { getFileUrl } from "@/lib/s3";

const OPENROUTER_BASE = "https://openrouter.ai";

async function pollVideoStatus(
  jobId: string,
  apiKey: string,
  maxAttempts = 20,
  intervalMs = 30000,
): Promise<{ videoUrl: string; status: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs));

    const res = await fetch(`${OPENROUTER_BASE}/api/v1/videos/${jobId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://movie-gen-alpha.app",
        "X-Title": "Movie Gen Alpha – Video Generator",
      },
    });

    if (!res.ok) continue;

    const data = await res.json();
    const status: string = data?.status ?? "pending";

    if (status === "completed") {
      return { videoUrl: data?.unsigned_urls?.[0] ?? "", status: "completed" };
    }

    if (status === "failed" || status === "error") {
      console.error("Video generation failed:", data?.error);
      return { videoUrl: "", status: "failed" };
    }
    // "pending" | "in_progress" → keep polling
  }

  return { videoUrl: "", status: "processing" };
}

async function resolveUrl(path: string): Promise<string> {
  if (path.startsWith("http")) return path;
  return (await getFileUrl(path, true)) ?? path;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      prompt,
      inputMode, // "keyframe" | "reference"
      // keyframe mode — resolved public URLs sent from client
      startFrameUrl,
      endFrameUrl,
      // reference mode — arrays of resolved public URLs
      referenceImages, // string[]  max 9
      referenceVideos, // string[]  max 3  (requires model that supports video refs)
      referenceAudios, // string[]  max 3  (requires ≥1 image or video ref)
      // settings
      resolution,
      aspectRatio,
      duration, // integer seconds
    } = body ?? {};

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

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

    const durationSeconds =
      typeof duration === "string"
        ? parseInt(duration.replace("s", ""), 10) || 5
        : typeof duration === "number"
          ? duration
          : 5;

    const record = await prisma.generatedVideo.create({
      data: {
        prompt,
        referenceImages: referenceImages || [],
        resolution: resolution || "720p",
        aspectRatio: aspectRatio || "16:9",
        duration: `${durationSeconds}s`,
        status: "pending",
        userId: session.user.id,
      },
    });

    try {
      const requestBody: Record<string, unknown> = {
        model,
        prompt,
        resolution: resolution || "720p",
        aspect_ratio: aspectRatio || "16:9",
        duration: durationSeconds,
      };

      // ── KEYFRAME MODE ────────────────────────────────────────────────────
      if (inputMode === "keyframe" && startFrameUrl) {
        const frameImages: Array<{
          type: string;
          image_url: { url: string };
          frame_type: string;
        }> = [
          {
            type: "image_url",
            image_url: { url: await resolveUrl(startFrameUrl) },
            frame_type: "first_frame",
          },
        ];
        if (endFrameUrl) {
          frameImages.push({
            type: "image_url",
            image_url: { url: await resolveUrl(endFrameUrl) },
            frame_type: "last_frame",
          });
        }
        requestBody.frame_images = frameImages;
      }

      // ── REFERENCE MODE ───────────────────────────────────────────────────
      if (inputMode === "reference") {
        const imgUrls: string[] = await Promise.all(
          (referenceImages ?? []).map(resolveUrl),
        );
        const vidUrls: string[] = await Promise.all(
          (referenceVideos ?? []).map(resolveUrl),
        );
        const audUrls: string[] = await Promise.all(
          (referenceAudios ?? []).map(resolveUrl),
        );

        // Image refs → OpenRouter normalized input_references field
        if (imgUrls.length > 0) {
          requestBody.input_references = imgUrls.map((url) => ({
            type: "image_url",
            image_url: { url },
          }));
        }

        // Video + audio refs → provider passthrough.
        // OpenRouter's normalized schema only covers image refs. Video/audio
        // must go via provider options passthrough using the Seedance upstream
        // format (separate video_urls / audio_urls arrays).
        // Note: audio requires at least one image or video ref alongside it.
        if (vidUrls.length > 0 || audUrls.length > 0) {
          requestBody.provider = {
            options: {
              bytedance: {
                parameters: {
                  ...(vidUrls.length > 0 && { video_urls: vidUrls }),
                  ...(audUrls.length > 0 && { audio_urls: audUrls }),
                },
              },
            },
          };
        }
      }

      // ── SUBMIT ───────────────────────────────────────────────────────────
      const response = await fetch(`${OPENROUTER_BASE}/api/v1/videos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://movie-gen-alpha.app",
          "X-Title": "Movie Gen Alpha - Video Generator",
        },
        body: JSON.stringify(requestBody),
      });

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

      // 202 Accepted → { id, polling_url, status }
      const submissionData = await response.json();
      const jobId: string = submissionData?.id ?? "";

      if (!jobId) {
        await prisma.generatedVideo.update({
          where: { id: record.id },
          data: { status: "processing" },
        });
        await recordCreditUsage(session.user.id, "VIDEO_GENERATOR", {
          videoId: record.id,
          prompt: prompt.substring(0, 100),
        });
        return NextResponse.json({
          id: record.id,
          status: "processing",
          prompt,
          message: "Video is being processed. Check back shortly.",
        });
      }

      // ── POLL ─────────────────────────────────────────────────────────────
      const { videoUrl, status } = await pollVideoStatus(jobId, apiKey);

      if (status === "processing") {
        await prisma.generatedVideo.update({
          where: { id: record.id },
          data: { status: "processing" },
        });
        await recordCreditUsage(session.user.id, "VIDEO_GENERATOR", {
          videoId: record.id,
          prompt: prompt.substring(0, 100),
        });
        return NextResponse.json({
          id: record.id,
          status: "processing",
          prompt,
          message: "Video is still being processed. Check back shortly.",
        });
      }

      // ── UPLOAD TO S3 ─────────────────────────────────────────────────────
      let permanentUrl = videoUrl;
      if (status === "completed" && videoUrl) {
        try {
          const { bucketName } = getBucketConfig();
          const s3 = createS3Client();

          const videoRes = await fetch(videoUrl, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
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

          permanentUrl = (await getFileUrl(videoFileName, true)) ?? videoUrl;
        } catch (s3Err) {
          console.error("S3 upload failed, using OpenRouter URL:", s3Err);
        }
      }

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
        videoUrl: permanentUrl,
        status,
        prompt,
        message:
          status !== "completed" ? "Video generation failed." : undefined,
      });
    } catch (apiError: unknown) {
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
  } catch (error: unknown) {
    console.error("Video generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
