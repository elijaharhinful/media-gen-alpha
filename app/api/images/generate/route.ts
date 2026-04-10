export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUserUseTool, recordCreditUsage } from "@/lib/credits";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client, getBucketConfig } from "@/lib/aws-config";
import { getFileUrl } from "@/lib/s3";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, style, aspectRatio, referenceImages } = body ?? {};

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    // Check credits
    const creditCheck = await canUserUseTool(
      session.user.id,
      "IMAGE_GENERATOR",
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
      process.env.OPENROUTER_IMAGE_MODEL ?? "google/gemini-2.5-flash-image";

    // Build the enhanced prompt
    let enhancedPrompt = prompt;
    if (style) enhancedPrompt = `${style} style: ${enhancedPrompt}`;

    // Map aspect ratio to API format (default 1:1)
    const validRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
    const apiAspectRatio = validRatios.includes(aspectRatio)
      ? aspectRatio
      : "1:1";

    // Resolve reference image URLs
    const refImageUrls = referenceImages?.length > 0
      ? await Promise.all(referenceImages.map((path: string) => getFileUrl(path, true)))
      : [];

    // Construct multimodal message
    const messageContent: any[] = [{ type: "text", text: enhancedPrompt }];
    if (refImageUrls.length > 0) {
      refImageUrls.forEach((url: string) => {
        messageContent.push({
          type: "image_url",
          image_url: { url }
        });
      });
    }

    // Call OpenRouter image generation via chat/completions
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://movie-gen-alpha.app",
          "X-Title": "Movie Gen Alpha - Image Generator",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: messageContent }],
          modalities: ["image"],
          max_tokens: 1500,
          image_config: {
            aspect_ratio: apiAspectRatio,
            num_images: 1,
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter image gen error:", errText);
      return NextResponse.json(
        { error: "Image generation failed" },
        { status: 502 },
      );
    }

    const data = await response.json();

    let imageUrl = "";
    const message = data?.choices?.[0]?.message;

    if (Array.isArray(message?.images) && message.images.length > 0) {
      const imgData = message.images[0];
      if (imgData?.image_url?.url) {
        imageUrl = imgData.image_url.url;
      } else if (imgData?.url) {
        imageUrl = imgData.url;
      } else if (typeof imgData === "string") {
        imageUrl = imgData;
      }
    }

    if (!imageUrl && Array.isArray(message?.content)) {
      const imagePart = message.content.find(
        (p: any) => p.type === "image_url",
      );
      if (imagePart?.image_url?.url) {
        imageUrl = imagePart.image_url.url;
      }
    }

    if (!imageUrl && typeof message?.content === "string") {
      const match = message.content.match(/data:image\/[^;]+;base64,[^\s"]+/);
      if (match) imageUrl = match[0];
    }

    if (imageUrl && imageUrl.startsWith("data:image")) {
      const { bucketName } = getBucketConfig();
      const s3 = createS3Client();

      // Convert Base64 to Buffer
      const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const fileName = `generated/images/${Date.now()}.png`;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: fileName,
          Body: buffer,
          ContentType: "image/png",
        }),
      );

      // IMPORTANT: Replace the Base64 string with the new permanent R2 URL
      imageUrl = await getFileUrl(fileName, true);
    }

    const record = await prisma.generatedImage.create({
      data: {
        prompt,
        imageUrl: imageUrl || null,
        referenceImages: referenceImages || [],
        style: style || null,
        aspectRatio: aspectRatio || "1:1",
        status: imageUrl ? "completed" : "failed",
        userId: session.user.id,
      },
    });

    // Record credit usage
    if (imageUrl) {
      await recordCreditUsage(session.user.id, "IMAGE_GENERATOR", {
        imageId: record.id,
        prompt: prompt.substring(0, 100),
      });
    }

    return NextResponse.json({
      id: record.id,
      imageUrl,
      prompt,
      style,
      aspectRatio,
      status: imageUrl ? "completed" : "failed",
    });
  } catch (error: any) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
