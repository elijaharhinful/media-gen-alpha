import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [activeVideos, activeImages] = await Promise.all([
      prisma.generatedVideo.count({
        where: {
          userId: session.user.id,
          status: { in: ["pending", "processing"] },
        },
      }),
      prisma.generatedImage.count({
        where: {
          userId: session.user.id,
          status: { in: ["pending", "processing"] },
        },
      }),
    ]);

    return NextResponse.json({
      activeCount: activeVideos + activeImages,
    });
  } catch (error) {
    console.error("Error fetching active tasks count:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
