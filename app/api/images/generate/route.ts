export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUserUseTool, recordCreditUsage } from "@/lib/credits";
import { withRequestLog } from "@/lib/with-request-log";

async function _POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, style, aspectRatio, referenceImages, model } = body ?? {};

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    // Check credits with dynamic model-based precheck cost
    const selectedModelAlias = model === "model2" ? "model2" : "model1";
    const preCheckCost = selectedModelAlias === "model2"
      ? parseInt(process.env.FALLBACK_COST_MODEL_2 || "8", 10)
      : parseInt(process.env.FALLBACK_COST_MODEL_1 || "2", 10);

    const creditCheck = await canUserUseTool(
      session.user.id,
      "IMAGE_GENERATOR",
      { customCost: preCheckCost }
    );
    if (!creditCheck.allowed) {
      return NextResponse.json({ error: creditCheck.reason }, { status: 403 });
    }

    // Pre-create the image generation record with status "processing"
    const record = await prisma.generatedImage.create({
      data: {
        prompt,
        imageUrl: null,
        referenceImages: referenceImages || [],
        style: style || null,
        aspectRatio: aspectRatio || "1:1",
        model: selectedModelAlias,
        status: "processing",
        userId: session.user.id,
      },
    });

    // Record the reserved precheck holding credits
    await recordCreditUsage(
      session.user.id,
      "IMAGE_GENERATOR",
      {
        imageId: record.id,
        prompt: prompt.substring(0, 100),
        model: selectedModelAlias,
        status: "holding"
      },
      preCheckCost
    );

    return NextResponse.json({
      id: record.id,
      prompt,
      style,
      aspectRatio,
      status: "processing",
    });
  } catch (error: any) {
    console.error("Image submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export const POST = withRequestLog(_POST);
