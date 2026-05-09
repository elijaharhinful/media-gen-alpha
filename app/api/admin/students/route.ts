export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { withRequestLog } from "@/lib/with-request-log";

// GET - List all students
async function _GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      creditLimit: true,
      isBlocked: true,
      createdAt: true,
    },
  });

  // Single groupBy replaces N individual aggregate() calls
  const creditTotals = await prisma.creditUsage.groupBy({
    by: ["userId"],
    where: { userId: { in: students.map((s) => s.id) } },
    _sum: { cost: true },
    _count: true,
  });

  const creditMap = new Map(
    creditTotals.map((c) => [
      c.userId,
      { creditsUsed: c._sum.cost ?? 0, generationCount: c._count },
    ]),
  );

  const studentsWithCredits = students.map((s) => ({
    ...s,
    creditsUsed: creditMap.get(s.id)?.creditsUsed ?? 0,
    generationCount: creditMap.get(s.id)?.generationCount ?? 0,
  }));

  return NextResponse.json({ students: studentsWithCredits });
}

// POST - Create a new student
async function _POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const { email, password, name, creditLimit } = body ?? {};

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Email already in use" },
      { status: 409 },
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const student = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: name || email.split("@")[0],
      role: "STUDENT",
      creditLimit: creditLimit !== undefined ? creditLimit : null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      creditLimit: true,
      isBlocked: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ student }, { status: 201 });
}

// PATCH - Update a student
async function _PATCH(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const { id, creditLimit, isBlocked, name } = body ?? {};

  if (!id) {
    return NextResponse.json(
      { error: "Student ID is required" },
      { status: 400 },
    );
  }

  const updateData: any = {};
  if (creditLimit !== undefined) updateData.creditLimit = creditLimit;
  if (isBlocked !== undefined) updateData.isBlocked = isBlocked;
  if (name !== undefined) updateData.name = name;

  const student = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      creditLimit: true,
      isBlocked: true,
    },
  });

  return NextResponse.json({ student });
}

// DELETE - Remove a student
async function _DELETE(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Student ID is required" },
      { status: 400 },
    );
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export const GET = withRequestLog(_GET as any);
export const POST = withRequestLog(_POST);
export const PATCH = withRequestLog(_PATCH);
export const DELETE = withRequestLog(_DELETE);
