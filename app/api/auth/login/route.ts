export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// Login is handled by NextAuth's built-in signin
export async function POST() {
  return NextResponse.json({ message: 'Use /api/auth/callback/credentials for login' });
}
