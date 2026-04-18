// Dev-only: switch the current user's role (CREATOR ↔ BRAND_ADMIN)
// Also supports "dev login" by email when no auth cookie is present.
// Disabled in production.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/getAuthUser';
import jwt from 'jsonwebtoken';

export async function POST(request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Disabled in production' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { role, email } = body;

  let user = await getAuthUser(request);

  // Dev login by email (when not authenticated)
  if (!user && email) {
    const dbUser = await prisma.user.findUnique({ where: { email } });
    if (!dbUser) {
      return NextResponse.json({ error: `User not found: ${email}` }, { status: 404 });
    }
    user = { userId: dbUser.id, email: dbUser.email, role: dbUser.role };
  }

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated. Pass email for dev login.' }, { status: 401 });
  }

  const newRole = role || (user.role === 'CREATOR' ? 'BRAND_ADMIN' : 'CREATOR');

  // Update in DB
  const updated = await prisma.user.update({
    where: { id: user.userId },
    data: { role: newRole },
  });

  // Issue a fresh JWT with the new role
  const token = jwt.sign(
    { userId: updated.id, email: updated.email, role: updated.role },
    process.env.NEXTAUTH_SECRET,
    { expiresIn: '30d' }
  );

  const response = NextResponse.json({
    message: `Role switched to ${newRole}`,
    token,
    user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role },
  });

  // Overwrite the auth cookie so subsequent requests use the new role
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });

  return response;
}
