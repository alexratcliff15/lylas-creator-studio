import { NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import { prisma } from '@/lib/prisma.js';

export async function POST(request) {
  try {
    const { email, password, name } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }
    const hashedPassword = await bcryptjs.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, name: name || email.split('@')[0], passwordHash: hashedPassword, role: 'BRAND_ADMIN' }
    });
    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    console.error('SIGNUP ERROR:', error); return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
