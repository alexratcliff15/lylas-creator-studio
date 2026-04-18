import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const users = await prisma.user.findMany({
  orderBy: { createdAt: 'desc' },
  take: 10,
  include: { creatorProfile: true, brandProfile: true },
});
console.log(JSON.stringify(users.map(u => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  hasPassword: !!u.passwordHash,
  creator: u.creatorProfile ? { handle: u.creatorProfile.handle, tier: u.creatorProfile.tier } : null,
  brand: u.brandProfile ? { company: u.brandProfile.companyName } : null,
  createdAt: u.createdAt,
})), null, 2));
await prisma.$disconnect();
