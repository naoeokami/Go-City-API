const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_v6KL8xcCEUAo@ep-tiny-king-acfh0bks.sa-east-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30'
    }
  }
});
prisma.$connect()
  .then(() => {
    console.log('Connected via Prisma successfully! (Non-pooler)');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Prisma connection failed (Non-pooler):', e);
    process.exit(1);
  });
