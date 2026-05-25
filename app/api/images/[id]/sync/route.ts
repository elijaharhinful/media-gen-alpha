export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordCreditUsage } from "@/lib/credits";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client, getBucketConfig } from "@/lib/aws-config";
import { getFileUrl } from "@/lib/s3";
import { withRequestLog } from "@/lib/with-request-log";

async function _POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const record = await prisma.generatedImage.findUnique({
      where: { id: params.id },
    });

    if (!record) {
      return NextResponse.json({ error: "Image record not found" }, { status: 404 });
    }

    if (record.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Already completed or failed - return immediately
    if (record.status === "completed" || record.status === "failed") {
      return NextResponse.json(record);
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 500 },
      );
    }

    // Resolve pre-check cost
    const selectedModelAlias = record.model === "model2" ? "model2" : "model1";
    const preCheckCost = selectedModelAlias === "model2"
      ? parseInt(process.env.FALLBACK_COST_MODEL_2 || "8", 10)
      : parseInt(process.env.FALLBACK_COST_MODEL_1 || "2", 10);

    const modelToUse = selectedModelAlias === "model2"
      ? (process.env.OPENROUTER_IMAGE_MODEL_2 ?? "openai/gpt-5.4-image-2")
      : (process.env.OPENROUTER_IMAGE_MODEL_1 ?? "google/gemini-2.5-flash-image");

    try {
      // Build the enhanced prompt
      let enhancedPrompt = record.prompt;
      if (record.style) enhancedPrompt = `${record.style} style: ${enhancedPrompt}`;

      // Map aspect ratio to API format
      const validRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
      const apiAspectRatio = validRatios.includes(record.aspectRatio ?? "")
        ? record.aspectRatio
        : "1:1";

      // Resolve reference image URLs
      const refImageUrls =
        record.referenceImages?.length > 0
          ? await Promise.all(
              record.referenceImages.map((path: string) => getFileUrl(path, true)),
            )
          : [];

      // Construct multimodal message
      const messageContent: any[] = [{ type: "text", text: enhancedPrompt }];
      if (refImageUrls.length > 0) {
        refImageUrls.forEach((url: string | null) => {
          if (url) {
            messageContent.push({
              type: "image_url",
              image_url: { url },
            });
          }
        });
      }

      // Call OpenRouter image generation synchronously
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://movie-gen-alpha.app",
            "X-OpenRouter-Title": "Movie Gen Alpha - Image Generator",
          },
          body: JSON.stringify({
            model: modelToUse,
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
        throw new Error(`OpenRouter returned: ${response.status} - ${errText}`);
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

      if (!imageUrl) {
        throw new Error("No image URL returned by OpenRouter API.");
      }

      // Upload image to permanent storage (R2/S3)
      if (imageUrl.startsWith("data:image")) {
        const { bucketName } = getBucketConfig();
        const s3 = createS3Client();

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
        imageUrl = await getFileUrl(fileName, true) ?? imageUrl;
      } else if (imageUrl.startsWith("http") && !imageUrl.includes("pub-93cf982b3ceb4b9db4b143bdeda55a51.r2.dev")) {
        // Copy external URLs to R2 to prevent expiry
        try {
          const { bucketName } = getBucketConfig();
          const s3 = createS3Client();
          const imageFetch = await fetch(imageUrl);
          if (imageFetch.ok) {
            const buffer = await imageFetch.arrayBuffer();
            const fileName = `generated/images/${Date.now()}.png`;
            await s3.send(
              new PutObjectCommand({
                Bucket: bucketName,
                Key: fileName,
                Body: Buffer.from(buffer),
                ContentType: "image/png",
              }),
            );
            imageUrl = await getFileUrl(fileName, true) ?? imageUrl;
          }
        } catch (copyErr) {
          console.error("R2 copy failed, keeping upstream URL:", copyErr);
        }
      }

      // Update Database
      const updated = await prisma.generatedImage.update({
        where: { id: record.id },
        data: {
          status: "completed",
          imageUrl,
        },
      });

      // dynamic cost calculation and adjustment billing
      const openRouterCost = data?.usage?.cost;
      let finalCreditCost = preCheckCost;

      if (typeof openRouterCost === 'number' && openRouterCost > 0) {
        const markup = parseFloat(process.env.PLATFORM_MARKUP_MULTIPLIER || "2.0");
        finalCreditCost = Math.max(1, Math.ceil(openRouterCost * 100 * markup));
      }

      const diff = finalCreditCost - preCheckCost;
      if (diff !== 0) {
        // Charge/Refund the difference
        await recordCreditUsage(session.user.id, "IMAGE_GENERATOR", {
          imageId: record.id,
          prompt: record.prompt.substring(0, 100),
          model: selectedModelAlias,
          status: "completed_adjustment"
        }, diff);
      }

      return NextResponse.json(updated);
    } catch (genErr: any) {
      console.error("OpenRouter generation/upload failed:", genErr);

      // Update Database to failed
      const updated = await prisma.generatedImage.update({
        where: { id: record.id },
        data: {
          status: "failed",
        },
      });

      // Fully refund the precheck cost
      await recordCreditUsage(session.user.id, "IMAGE_GENERATOR", {
        imageId: record.id,
        prompt: record.prompt.substring(0, 100),
        model: selectedModelAlias,
        status: "failed_refund"
      }, -preCheckCost);

      return NextResponse.json(updated);
    }
  } catch (error: any) {
    console.error("Image sync route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export const POST = withRequestLog(_POST as any);
