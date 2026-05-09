export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFileUrl } from "@/lib/s3";
import { cacheGet, cacheSet, cacheDel, TTL } from "@/lib/cache";
import { withRequestLog } from "@/lib/with-request-log";

async function _GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cacheKey = `characters:${session.user.id}`;
    const cached = await cacheGet<object>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const characters = await prisma.character.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    const charactersWithUrls = await Promise.all(
      characters.map(async (char) => ({
        ...char,
        images: await Promise.all(
          char.images.map(async (img) => {
            if (img.startsWith("http")) return img;
            return (await getFileUrl(img, true)) ?? img;
          }),
        ),
      })),
    );

    const payload = { characters: charactersWithUrls };
    await cacheSet(cacheKey, payload, TTL.CHARACTERS);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Fetch characters error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function _POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, images, status } = body ?? {};

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (
      status !== "processing" &&
      (!images || !Array.isArray(images) || images.length < 2)
    ) {
      return NextResponse.json(
        { error: "At least 2 images are required to create a character" },
        { status: 400 },
      );
    }

    const character = await prisma.character.create({
      data: {
        name,
        description,
        images: images || [],
        status: status || "completed",
        userId: session.user.id,
      },
    });

    // Invalidate character list cache for this user
    await cacheDel(`characters:${session.user.id}`);

    return NextResponse.json({ character });
  } catch (error) {
    console.error("Create character error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export const GET  = withRequestLog(_GET);
export const POST = withRequestLog(_POST);
