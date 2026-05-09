export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { withRequestLog } from '@/lib/with-request-log';

async function _POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body ?? {};

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // First user becomes ADMIN, subsequent users are STUDENT
    const userCount = await prisma.user.count();
    const role = userCount === 0 ? 'ADMIN' : 'STUDENT';

    // Generate unique student ID for STUDENT role
    let studentId: string | null = null;
    if (role === 'STUDENT') {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let unique = false;
      while (!unique) {
        const code = Array.from({ length: 5 }, () =>
          chars[Math.floor(Math.random() * chars.length)]
        ).join('');
        studentId = `STU-${code}`;
        const exists = await prisma.user.findUnique({ where: { studentId } });
        if (!exists) unique = true;
      }
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
        role,
        studentId,
      },
    });

    return NextResponse.json(
      { id: user.id, email: user.email, name: user.name, role: user.role, studentId: user.studentId },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLog(_POST);
