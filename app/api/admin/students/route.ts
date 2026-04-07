export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GET - List all students
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      creditLimit: true,
      isBlocked: true,
      createdAt: true,
      _count: {
        select: { creditUsages: true },
      },
    },
  });

  // Get credit usage totals for each student
  const studentsWithCredits = await Promise.all(
    students.map(async (s) => {
      const totalCredits = await prisma.creditUsage.aggregate({
        where: { userId: s.id },
        _sum: { cost: true },
      });
      return {
        ...s,
        creditsUsed: totalCredits._sum.cost ?? 0,
        generationCount: s._count.creditUsages,
      };
    })
  );

  return NextResponse.json({ students: studentsWithCredits });
}

// POST - Create a new student
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const { email, password, name, creditLimit } = body ?? {};

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const student = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: name || email.split('@')[0],
      role: 'STUDENT',
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
export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const { id, creditLimit, isBlocked, name } = body ?? {};

  if (!id) {
    return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
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
export async function DELETE(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
