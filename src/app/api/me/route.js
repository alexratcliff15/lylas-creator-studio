import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/getAuthUser';

// Prevent Next.js from caching this route
export const dynamic = 'force-dynamic';

// GET /api/me — Get current user's full profile
export async function GET(request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      include: {
        creatorProfile: true,
        brandProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const res = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      image: user.image,
      creatorProfile: user.creatorProfile,
      brandProfile: user.brandProfile,
    });
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res;
  } catch (error) {
    console.error('GET /api/me error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/me — Update current user's profile
export async function PUT(request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, image, bio, handle, specialties, avatar } = body;

    // Update user fields
    const userUpdate = {};
    if (name !== undefined) userUpdate.name = name;
    if (image !== undefined) userUpdate.image = image;

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: authUser.userId },
        data: userUpdate,
      });
    }

    // Update creator profile if user is a creator
    if (authUser.role === 'CREATOR') {
      const profileUpdate = {};
      if (bio !== undefined) profileUpdate.bio = bio;
      if (specialties !== undefined) profileUpdate.specialties = specialties;
      if (avatar !== undefined) profileUpdate.avatar = avatar;

      // Handle validation if user is trying to change handle
      if (handle !== undefined) {
        const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
        // Check uniqueness (excluding own profile)
        const existing = await prisma.creatorProfile.findFirst({
          where: {
            handle: cleanHandle,
            NOT: { userId: authUser.userId },
          },
        });
        if (existing) {
          return NextResponse.json({ error: 'This handle is already taken' }, { status: 409 });
        }
        profileUpdate.handle = cleanHandle;
      }

      if (Object.keys(profileUpdate).length > 0) {
        await prisma.creatorProfile.update({
          where: { userId: authUser.userId },
          data: profileUpdate,
        });
      }
    }

    // Fetch updated user
    const updatedUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      include: {
        creatorProfile: true,
        brandProfile: true,
      },
    });

    return NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      image: updatedUser.image,
      creatorProfile: updatedUser.creatorProfile,
      brandProfile: updatedUser.brandProfile,
    });
  } catch (error) {
    console.error('PUT /api/me error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
