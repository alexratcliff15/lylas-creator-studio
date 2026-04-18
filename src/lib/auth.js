import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET environment variable is required');
}

/**
 * NextAuth configuration with Prisma adapter, credentials provider, and Google OAuth
 */
export const authOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 1 day
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    /**
     * Credentials Provider (Email/Password)
     */
    CredentialsProvider({
      id: 'credentials',
      name: 'Email and Password',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        try {
          // Find user by email
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            
          });

          if (!user) {
            throw new Error('No user found with this email');
          }

          // Check if password is set (user registered via credentials)
          if (!user.passwordHashHash) {
            throw new Error('This account uses OAuth. Please sign in with Google.');
          }

          // Verify password
          const isPasswordValid = await bcryptjs.compare(credentials.password, user.passwordHashHash);

          if (!isPasswordValid) {
            throw new Error('Invalid password');
          }

          // Return user object
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            profileId: user.id,
          };
        } catch (error) {
          console.error('Credentials authorization failed:', error.message);
          throw new Error(error.message);
        }
      },
    }),

    /**
     * Google OAuth Provider
     */
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
  ].filter(Boolean),

  events: {
    /**
     * Called when user signs in successfully
     */
    async signIn({ user, account, profile, isNewUser }) {
      try {
        if (isNewUser) {
          // Create user profile for new users
          const userProfile = await prisma.profile.create({
            data: {
              userId: user.id,
              displayName: user.name || profile?.name || 'Creator',
              bio: '',
              profileType: 'creator', // Can be 'creator' or 'brand'
            },
          });

          // Update user with profile ID
          await prisma.user.update({
            where: { id: user.id },
            data: { profileId: userProfile.id },
          });
        }

        console.log(`User ${user.email} signed in`);
      } catch (error) {
        console.error('SignIn event error:', error.message);
      }
    },

    /**
     * Called on JWT callback
     */
    async jwt({ token, user, account }) {
      if (user) {
        token.role = user.role;
        token.profileId = user.profileId;
      }
      return token;
    },
  },

  callbacks: {
    /**
     * JWT callback - run when JWT is created or updated
     */
    async jwt({ token, user, account, profile, isNewUser }) {
      // Persist user data to token
      if (user) {
        token.id = user.id;
        token.role = user.role || 'creator';
        token.profileId = user.profileId;
      }

      // Include account info for OAuth
      if (account) {
        token.account = {
          provider: account.provider,
          type: account.type,
        };
      }

      return token;
    },

    /**
     * Session callback - run when session is checked
     */
    async session({ session, token, user }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role || 'creator';
        session.user.profileId = token.profileId;

        // Fetch latest user data from database
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              role: true,
              profileId: true,
              stripeCustomerId: true,
            },
          });

          if (dbUser) {
            session.user = {
              ...session.user,
              ...dbUser,
            };
          }
        } catch (error) {
          console.error('Session callback error:', error.message);
        }
      }

      return session;
    },

    /**
     * Redirect callback - control where users are redirected
     */
    async redirect({ url, baseUrl }) {
      // Redirect to home if sign-in was successful
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Redirect to base URL if coming from same origin
      if (new URL(url).origin === baseUrl) return url;
      // Default to home
      return baseUrl;
    },

    /**
     * Sign in callback - decide if user can sign in
     */
    async signIn({ user, account, profile, email, credentials }) {
      // Check if user is allowed to sign in
      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        // Allow sign in if user exists or it's a new user
        if (dbUser || !dbUser) {
          return true;
        }

        return false;
      } catch (error) {
        console.error('Sign in callback error:', error.message);
        return false;
      }
    },
  },
};

/**
 * Create NextAuth handler
 */
export const handler = NextAuth(authOptions);

/**
 * Helper function to hash password for new registrations
 */
export async function hashPassword(password) {
  const saltRounds = 10;
  return bcryptjs.hash(password, saltRounds);
}

/**
 * Helper function to verify password
 */
export async function verifyPassword(password, hash) {
  return bcryptjs.compare(password, hash);
}

/**
 * Helper to create a new user with credentials
 */
export async function createUser(email, password, name) {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name: name || email.split('@')[0],
        role: 'creator',
      },
    });

    // Create user profile
    const profile = await prisma.profile.create({
      data: {
        userId: user.id,
        displayName: name || email.split('@')[0],
        bio: '',
        profileType: 'creator',
      },
    });

    // Link profile to user
    await prisma.user.update({
      where: { id: user.id },
      data: { profileId: profile.id },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  } catch (error) {
    console.error('Failed to create user:', error.message);
    throw error;
  }
}

export default handler;
