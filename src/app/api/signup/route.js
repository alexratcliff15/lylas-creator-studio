import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export async function POST(request) {
  try {
    const { email, password, name, handle } = await request.json();

    // Validate required fields
    if (!email || !password || !name || !handle) {
      return NextResponse.json(
        { error: 'Email, password, name, and handle are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Validate handle format
    const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
    if (!/^@[a-zA-Z0-9_]{3,20}$/.test(cleanHandle)) {
      return NextResponse.json(
        { error: 'Handle must be 3-20 characters (letters, numbers, underscores)' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Check if handle already exists
    const existingHandle = await prisma.creatorProfile.findUnique({ where: { handle: cleanHandle } });
    if (existingHandle) {
      return NextResponse.json(
        { error: 'This handle is already taken' },
        { status: 409 }
      );
    }

    // Hash password and create user + profile in a transaction
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: 'CREATOR',
        },
      });

      const creatorProfile = await tx.creatorProfile.create({
        data: {
          userId: user.id,
          handle: cleanHandle,
          bio: '',
          tier: 'BRONZE',
          specialties: [],
          isApproved: true,
        },
      });

      return { user, creatorProfile };
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: result.user.id, email: result.user.email, role: result.user.role },
      process.env.NEXTAUTH_SECRET,
      { expiresIn: '30d' }
    );

    const response = NextResponse.json({
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: 'creator',
        tier: 'bronze',
        image: null,
      },
      creatorProfile: {
        id: result.creatorProfile.id,
        handle: result.creatorProfile.handle,
      },
    });

    // Set httpOnly cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('SIGNUP ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
