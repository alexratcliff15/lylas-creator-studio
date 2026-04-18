import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const response = NextResponse.json({ message: 'Logged out successfully' });

    // Clear the auth-token cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Immediately expire the cookie
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('LOGOUT ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
