import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    if (!user.passwordHash) {
      return NextResponse.json({ error: 'This account uses Google sign-in' }, { status: 401 });
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, process.env.NEXTAUTH_SECRET, { expiresIn: '30d' });

    // Include creator profile tier if applicable
    let tier = null;
    if (user.role === 'CREATOR') {
      const creatorProfile = await prisma.creatorProfile.findUnique({ where: { userId: user.id } });
      if (creatorProfile) tier = creatorProfile.tier?.toLowerCase();
    }

    const response = NextResponse.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role.toLowerCase(), tier, image: user.image } });

    // Set httpOnly cookie with the JWT token
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
