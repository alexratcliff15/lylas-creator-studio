import jwt from 'jsonwebtoken';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';

/**
 * Get authenticated user from either NextAuth session or custom JWT token.
 * Returns { userId, email, role } or null if not authenticated.
 */
export async function getAuthUser(request) {
  // Try NextAuth session first
  try {
    const session = await getServerSession(authOptions);
    if (session?.user) {
      return {
        userId: session.user.id,
        email: session.user.email,
        role: session.user.role,
      };
    }
  } catch (e) {
    // NextAuth session not available, try JWT
  }

  // Try custom JWT from Authorization header
  const authHeader = request?.headers?.get?.('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET);
      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    } catch (e) {
      // Invalid token
    }
  }

  // Try token from cookie (custom JWT stored in cookie)
  const cookieHeader = request?.headers?.get?.('cookie');
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [key, ...val] = c.trim().split('=');
        return [key, val.join('=')];
      })
    );
    const tokenCookie = cookies['auth-token'];
    if (tokenCookie) {
      try {
        const decoded = jwt.verify(tokenCookie, process.env.NEXTAUTH_SECRET);
        return {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
        };
      } catch (e) {
        // Invalid cookie token
      }
    }
  }

  return null;
}

/**
 * Check if user has admin role (BRAND_ADMIN or SUPER_ADMIN)
 */
export function isAdmin(user) {
  return user && (user.role === 'BRAND_ADMIN' || user.role === 'SUPER_ADMIN');
}
