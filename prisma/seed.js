const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Get or create the brand admin user
  const adminHash = await bcrypt.hash('@Teddy14001', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'alex@lylashouse.ca' },
    update: { passwordHash: adminHash, role: 'BRAND_ADMIN' },
    create: {
      email: 'alex@lylashouse.ca',
      name: 'Alex Ratcliff',
      passwordHash: adminHash,
      role: 'BRAND_ADMIN',
    },
  });
  console.log('Admin user:', adminUser.email);

  // Create brand profile
  const brandProfile = await prisma.brandProfile.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      companyName: "Lyla's House",
      metaAdAccountId: process.env.META_AD_ACCOUNT_ID || null,
      metaAccessToken: process.env.META_ACCESS_TOKEN || null,
    },
  });
  console.log('Brand profile:', brandProfile.companyName);

  // Create creator users and profiles
  const creators = [
    { name: 'Sarah Chen', email: 'sarah@creators.local', handle: '@sarahcreates', tier: 'GOLD', specialties: ['Unboxing', 'Reviews'], rating: 4.8 },
    { name: 'Marcus Johnson', email: 'marcus@creators.local', handle: '@marcustech', tier: 'SILVER', specialties: ['Tech', 'Demo'], rating: 4.5 },
    { name: 'Jessica Lee', email: 'jessica@creators.local', handle: '@jessicawellness', tier: 'GOLD', specialties: ['Lifestyle', 'Wellness'], rating: 4.2 },
    { name: 'Alex Rivera', email: 'alex.r@creators.local', handle: '@alexstyle', tier: 'BRONZE', specialties: ['Fashion', 'Style'], rating: 3.9 },
    { name: 'Emma Wilson', email: 'emma@creators.local', handle: '@emmacooks', tier: 'SILVER', specialties: ['Food', 'Cooking'], rating: 4.3 },
    { name: 'Ryan Park', email: 'ryan@creators.local', handle: '@ryanfitness', tier: 'PLATINUM', specialties: ['Fitness', 'Health'], rating: 4.9 },
  ];

  const creatorProfiles = [];
  for (const c of creators) {
    const hash = await bcrypt.hash('Creator123', 10);
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: { email: c.email, name: c.name, passwordHash: hash, role: 'CREATOR' },
    });

    const profile = await prisma.creatorProfile.upsert({
      where: { userId: user.id },
      update: { tier: c.tier, specialties: c.specialties, rating: c.rating },
      create: {
        userId: user.id,
        handle: c.handle,
        bio: `Content creator specializing in ${c.specialties.join(' & ')}`,
        tier: c.tier,
        specialties: c.specialties,
        rating: c.rating,
        isApproved: true,
        totalEarnings: Math.floor(Math.random() * 3000) + 500,
        totalConversions: Math.floor(Math.random() * 200) + 50,
        totalViews: Math.floor(Math.random() * 100000) + 10000,
        avgRoas: parseFloat((Math.random() * 3 + 2).toFixed(2)),
      },
    });
    creatorProfiles.push(profile);
    console.log('Creator:', c.name, '-', c.handle);
  }

  // Create campaigns
  const campaigns = [
    { name: 'Spring Wine Collection Launch', status: 'ACTIVE', budget: 5000, spent: 2340 },
    { name: 'Summer Cafe Vibes', status: 'ACTIVE', budget: 3000, spent: 1250 },
    { name: 'Fall Menu Reveal', status: 'DRAFT', budget: 4000, spent: 0 },
    { name: 'Holiday Gift Guide', status: 'PAUSED', budget: 6000, spent: 3800 },
    { name: 'New Year Brunch Promo', status: 'COMPLETED', budget: 2500, spent: 2480 },
  ];

  const campaignRecords = [];
  for (const camp of campaigns) {
    const campaign = await prisma.campaign.create({
      data: {
        brandProfileId: brandProfile.id,
        name: camp.name,
        description: `Campaign for ${camp.name}`,
        status: camp.status,
        budget: camp.budget,
        spent: camp.spent,
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 5, 30),
      },
    });
    campaignRecords.push(campaign);
    console.log('Campaign:', camp.name);
  }

  // Create videos for each creator across campaigns
  const videoTitles = [
    'Product Unboxing', 'Before & After', 'Lifestyle Integration', 'Quick Review',
    'Day in My Life', 'Get Ready With Me', 'Taste Test', 'Morning Routine',
    'Evening Wind Down', 'Behind the Scenes', 'How I Style It', 'My Honest Take',
  ];

  const videoStatuses = ['ACTIVE', 'APPROVED', 'UPLOADED', 'IN_REVIEW'];
  let videoIdx = 0;

  for (const creator of creatorProfiles) {
    const numVideos = Math.floor(Math.random() * 4) + 2; // 2-5 videos each
    for (let i = 0; i < numVideos; i++) {
      const campaign = campaignRecords[Math.floor(Math.random() * 2)]; // assign to active campaigns
      const views = Math.floor(Math.random() * 50000) + 5000;
      const impressions = views + Math.floor(Math.random() * 20000);
      const clicks = Math.floor(impressions * (Math.random() * 0.05 + 0.01));
      const conversions = Math.floor(clicks * (Math.random() * 0.15 + 0.02));
      const spend = parseFloat((Math.random() * 500 + 50).toFixed(2));
      const revenue = parseFloat((spend * (Math.random() * 4 + 1.5)).toFixed(2));
      const roas = parseFloat((revenue / spend).toFixed(2));

      await prisma.video.create({
        data: {
          creatorProfileId: creator.id,
          campaignId: campaign.id,
          title: videoTitles[videoIdx % videoTitles.length],
          description: `UGC content by ${creator.handle}`,
          fileUrl: `https://storage.lylas.house/videos/video-${videoIdx + 1}.mp4`,
          thumbnailUrl: null,
          contentType: ['reel', 'story', 'feed'][Math.floor(Math.random() * 3)],
          status: videoStatuses[Math.floor(Math.random() * videoStatuses.length)],
          views,
          impressions,
          clicks,
          ctr: parseFloat((clicks / impressions * 100).toFixed(2)),
          conversions,
          spend,
          revenue,
          roas,
          cpm: parseFloat((spend / impressions * 1000).toFixed(2)),
          cpc: clicks > 0 ? parseFloat((spend / clicks).toFixed(2)) : 0,
        },
      });
      videoIdx++;
    }
  }
  console.log(`Created ${videoIdx} videos`);

  // Create commissions for creators
  for (const creator of creatorProfiles) {
    const numCommissions = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numCommissions; i++) {
      const isPaid = Math.random() > 0.5;
      await prisma.commission.create({
        data: {
          creatorProfileId: creator.id,
          amount: parseFloat((Math.random() * 200 + 20).toFixed(2)),
          conversions: Math.floor(Math.random() * 20) + 1,
          rate: [0.20, 0.25, 0.30][Math.floor(Math.random() * 3)],
          status: isPaid ? 'PAID' : 'PENDING',
          periodStart: new Date(2026, 2, 1),
          periodEnd: new Date(2026, 2, 31),
          paidAt: isPaid ? new Date(2026, 3, 5) : null,
        },
      });
    }
  }
  console.log('Created commissions');

  // Create sample products
  const products = [
    { name: "Lyla's Signature Blend Coffee", category: 'Coffee', value: 35 },
    { name: "Artisan Wine Tasting Kit", category: 'Wine', value: 85 },
    { name: "Cafe Merch Bundle", category: 'Merchandise', value: 50 },
    { name: "Seasonal Tea Collection", category: 'Tea', value: 42 },
  ];

  for (const prod of products) {
    await prisma.sampleProduct.create({
      data: {
        brandProfileId: brandProfile.id,
        name: prod.name,
        description: `Premium ${prod.name} for creator reviews`,
        category: prod.category,
        value: prod.value,
        brief: `Create authentic content featuring ${prod.name}. Show it in your daily routine.`,
        totalSlots: 10,
        filledSlots: Math.floor(Math.random() * 5),
        deadline: new Date(2026, 5, 30),
        isActive: true,
      },
    });
    console.log('Product:', prod.name);
  }

  // Create feed posts
  for (const creator of creatorProfiles.slice(0, 3)) {
    await prisma.feedPost.create({
      data: {
        creatorProfileId: creator.id,
        content: `Just wrapped up an amazing shoot for Lyla's House! The new collection is incredible. Can't wait for you all to see it! 🎬✨`,
        videoTitle: videoTitles[Math.floor(Math.random() * videoTitles.length)],
        roas: parseFloat((Math.random() * 3 + 2).toFixed(1)),
        views: Math.floor(Math.random() * 30000) + 5000,
        tags: ['ugc', 'lylashouse', 'creator'],
        likes: Math.floor(Math.random() * 50) + 5,
        comments: Math.floor(Math.random() * 15),
        saves: Math.floor(Math.random() * 20),
      },
    });
  }
  console.log('Created feed posts');

  // Create targets for creators
  for (const creator of creatorProfiles.slice(0, 4)) {
    const metrics = ['conversions', 'views', 'engagement', 'revenue'];
    for (const metric of metrics) {
      const target = metric === 'views' ? 50000 : metric === 'conversions' ? 100 : metric === 'revenue' ? 500 : 5;
      const current = parseFloat((target * (Math.random() * 0.8 + 0.3)).toFixed(0));
      await prisma.creatorTarget.create({
        data: {
          creatorProfileId: creator.id,
          metric,
          currentValue: current,
          targetValue: target,
          insight: `You're ${current >= target ? 'exceeding' : 'on track for'} your ${metric} target this month. ${current >= target ? 'Great job!' : 'Keep creating consistent content to hit your goal.'}`,
          month: new Date(2026, 3, 1), // April 2026
        },
      });
    }
  }
  console.log('Created targets');

  console.log('\nSeed complete! Your platform now has:');
  console.log('- 1 brand admin (alex@lylashouse.ca / @Teddy14001)');
  console.log('- 6 creators with profiles');
  console.log(`- ${campaigns.length} campaigns`);
  console.log(`- ${videoIdx} videos with metrics`);
  console.log('- Commissions, sample products, feed posts, and targets');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
