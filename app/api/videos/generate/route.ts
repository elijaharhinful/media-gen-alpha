export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUserUseTool, recordCreditUsage } from "@/lib/credits";
import { getFileUrl } from "@/lib/s3";
import { withRequestLog } from "@/lib/with-request-log";

const OPENROUTER_BASE = "https://openrouter.ai";

async function resolveUrl(path: string): Promise<string> {
  if (path.startsWith("http")) return path;
  return (await getFileUrl(path, true)) ?? path;
}

export async function _POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      prompt,
      inputMode,
      startFrameUrl,
      endFrameUrl,
      referenceImages,
      referenceVideos,
      referenceAudios,
      characterImages,
      resolution,
      aspectRatio,
      duration,
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

      // KEYFRAME MODE
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

      // REFERENCE MODE
      if (inputMode === "reference") {
        const combinedImages = [...(referenceImages ?? []), ...(characterImages ?? [])];
        const imgUrls: string[] = await Promise.all(
          combinedImages.map(resolveUrl),
        );
        const vidUrls: string[] = await Promise.all(
          (referenceVideos ?? []).map(resolveUrl),
        );
        const audUrls: string[] = await Promise.all(
          (referenceAudios ?? []).map(resolveUrl),
        );

        if (imgUrls.length > 0) {
          requestBody.input_references = imgUrls.map((url) => ({
            type: "image_url",
            image_url: { url },
          }));
        }

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

      // SUBMIT
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
        
        let extractedErrorMessage = "Video generation request failed.";
        try {
          const parsedErr = JSON.parse(errText);
          if (parsedErr?.error?.message) {
            extractedErrorMessage = parsedErr.error.message;
          }
        } catch {
          extractedErrorMessage = errText;
        }

        await prisma.generatedVideo.update({
          where: { id: record.id },
          data: { status: "failed", errorMessage: extractedErrorMessage },
        });
        await recordCreditUsage(session.user.id, "VIDEO_GENERATOR", {
          videoId: record.id,
          prompt: prompt.substring(0, 100),
        });
        return NextResponse.json({
          id: record.id,
          status: "failed",
          prompt,
          errorMessage: extractedErrorMessage,
          message: "Video generation request failed.",
        });
      }

      const submissionData = await response.json();
      const jobId: string = submissionData?.id ?? "";

      if (jobId) {
        await prisma.generatedVideo.update({
          where: { id: record.id },
          data: { jobId, status: "processing" },
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
      } else {
        await prisma.generatedVideo.update({
          where: { id: record.id },
          data: { status: "failed", errorMessage: "Failed to get job ID from generation service." },
        });
        
        return NextResponse.json({
          id: record.id,
          status: "failed",
          prompt,
          errorMessage: "Failed to get job ID from generation service.",
          message: "Failed to get job ID from generation service.",
        });
      }
    } catch (apiError: any) {
      console.error("Video API call failed:", apiError);
      const errMessage = apiError?.message || "Video generation failed.";
      await prisma.generatedVideo.update({
        where: { id: record.id },
        data: { status: "failed", errorMessage: errMessage },
      });
      await recordCreditUsage(session.user.id, "VIDEO_GENERATOR", {
        videoId: record.id,
        prompt: prompt.substring(0, 100),
      });
      return NextResponse.json({
        id: record.id,
        status: "failed",
        prompt,
        errorMessage: errMessage,
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

export const POST = withRequestLog(_POST);

