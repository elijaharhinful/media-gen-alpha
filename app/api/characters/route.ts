import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { getFileUrl } from "@/lib/s3";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
          })
        ),
      }))
    );

    return NextResponse.json({ characters: charactersWithUrls });
  } catch (error) {
    console.error("Fetch characters error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    if (status !== "processing" && (!images || !Array.isArray(images) || images.length < 5)) {
      return NextResponse.json(
        { error: "At least 5 images are required to create a character" },
        { status: 400 }
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

    return NextResponse.json({ character });
  } catch (error) {
    console.error("Create character error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
