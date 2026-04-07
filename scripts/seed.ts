import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";

console.log("DIRECT_URL:", process.env.DIRECT_URL);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL,
    },
  },
});

async function seedUsers() {
  console.log("Seeding users...");

  // Test admin account (required for testing)
  const testHash = await bcrypt.hash("johndoe123", 12);
  await prisma.user.upsert({
    where: { email: "john@doe.com" },
    update: { password: testHash, role: "ADMIN" },
    create: {
      email: "john@doe.com",
      password: testHash,
      name: "John Doe",
      role: "ADMIN",
    },
  });

  // Main admin account
  const adminHash = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@doxasensations.com" },
    update: { password: adminHash, role: "ADMIN" },
    create: {
      email: "admin@doxasensations.com",
      password: adminHash,
      name: "Admin",
      role: "ADMIN",
    },
  });

  console.log("Users seeded.");
}

async function main() {
  await seedUsers();
  console.log("Seeding example videos from collection...");

  const jsonPath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "seedance_prompts_collection.json",
  );
  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data = JSON.parse(raw);

  const links = data?.links ?? [];

  for (const link of links) {
    const id = link?.id;
    if (!id) continue;

    const techniques: string[] = [];
    const keyInsights: string[] = [];
    let style: string | null = null;
    let hasTimestamps = false;
    let hasDialogue = false;
    let hasCameraDir = false;
    let hasSfx = false;

    // Extract from prompt_structure if available
    const ps = link?.prompt_structure;
    if (ps) {
      if (ps.style) style = ps.style;
      if (ps.has_timestamps) hasTimestamps = true;
      if (ps.has_dialogue) hasDialogue = true;
      if (ps.has_camera_directions) hasCameraDir = true;
      if (ps.has_sfx_directions) hasSfx = true;
      if (ps.sections) {
        for (const s of ps.sections) {
          techniques.push(s);
        }
      }
    }

    // Extract key_insights from the link or from the findings
    if (link?.key_insights && Array.isArray(link.key_insights)) {
      for (const ki of link.key_insights) {
        keyInsights.push(ki);
      }
    }
    if (link?.key_findings && Array.isArray(link.key_findings)) {
      for (const kf of link.key_findings) {
        keyInsights.push(kf);
      }
    }
    if (link?.key_insight) {
      keyInsights.push(link.key_insight);
    }

    // Video type as a technique
    if (link?.video_type) {
      techniques.push(link.video_type);
    }

    await prisma.exampleVideo.upsert({
      where: { linkId: id },
      update: {
        url: link?.url ?? "",
        platform: link?.platform ?? "Unknown",
        status: link?.status ?? "UNKNOWN",
        creator: link?.creator ?? null,
        caption: link?.caption ?? link?.caption_english ?? link?.title ?? null,
        promptText: link?.prompt_text ?? null,
        promptLocation: link?.prompt_location ?? null,
        videoType: link?.video_type ?? null,
        referenceImage: link?.reference_image ?? null,
        techniques,
        keyInsights,
        style,
        hasTimestamps,
        hasDialogue,
        hasCameraDir,
        hasSfx,
        likes: link?.engagement?.likes ?? null,
        comments: link?.engagement?.comments ?? null,
      },
      create: {
        linkId: id,
        url: link?.url ?? "",
        platform: link?.platform ?? "Unknown",
        status: link?.status ?? "UNKNOWN",
        creator: link?.creator ?? null,
        caption: link?.caption ?? link?.caption_english ?? link?.title ?? null,
        promptText: link?.prompt_text ?? null,
        promptLocation: link?.prompt_location ?? null,
        videoType: link?.video_type ?? null,
        referenceImage: link?.reference_image ?? null,
        techniques,
        keyInsights,
        style,
        hasTimestamps,
        hasDialogue,
        hasCameraDir,
        hasSfx,
        likes: link?.engagement?.likes ?? null,
        comments: link?.engagement?.comments ?? null,
      },
    });
    console.log(`Upserted video link #${id}`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
