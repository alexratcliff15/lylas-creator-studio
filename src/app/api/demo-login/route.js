import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

/**
 * POST /api/demo-login
 * Creates or finds a demo user and returns a real JWT.
 * Allows the demo buttons to work with full API access.
 */
export async function POST(request) {
    try {
          const { role } = await request.json();

          if (!role || !['creator', 'brand'].includes(role)) {
                  return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
                }

          const isCreator = role === 'creator';
          const demoEmail = isCreator ? 'demo-creator@lylashouse.ca' : 'demo-brand@lylashouse.ca';
          const demoName = isCreator ? 'Alex Creator' : 'Brand Manager';
          const dbRole = isCreator ? 'CREATOR' : 'BRAND_ADMIN';

          // Find or create the demo user
          let user = await prisma.user.findUnique({ where: { email: demoEmail } });

          if (!user) {
                  // Create demo user + profile in a transaction
                  const result = await prisma.$transaction(async (tx) => {
                            const newUser = await tx.user.create({
                                        data: {
                                                      email: demoEmail,
                                                      name: demoName,
                                                      role: dbRole,
                                                    },
                                      });

                            if (isCreator) {
                                        await tx.creatorProfile.create({
                                                      data: {
                                                                      userId: newUser.id,
                                                                      handle: '@demo_creator',
                                                                      bio: 'Demo creator account for Lylas House Creator Studio',
                                                                      tier: 'GOLD',
                                                                      specialties: ['Unboxing', 'Reviews', 'Lifestyle'],
                                                                      isApproved: true,
                                                                    },
                                                    });
                                      } else {
                                        await tx.brandProfile.create({
                                                      data: {
                                                                      userId: newUser.id,
                                                                      companyName: 'Lylas House',
                                                                    },
                                                    });
                                      }

                            return newUser;
                          });

                  user = result;
                }

          // Get tier for creator
          let tier = null;
          if (user.role === 'CREATOR') {
                  const cp = await prisma.creatorProfile.findUnique({ where: { userId: user.id } });
                  if (cp) tier = cp.tier?.toLowerCase();
                }

          // Issue a real JWT
          const token = jwt.sign(
                  { userId: user.id, email: user.email, role: user.role },
                  process.env.NEXTAUTH_SECRET,
                  { expiresIn: '30d' }
                );

          const response = NextResponse.json({
                  token,
                  user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            role: user.role.toLowerCase(),
                            tier,
                            image: user.image,
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
          console.error('DEMO LOGIN ERROR:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
  }
