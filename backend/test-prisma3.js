const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_v6KL8xcCEUAo@ep-tiny-king-acfh0bks.sa-east-1.aws.neon.tech/neondb?sslmode=require&pool_timeout=0'
    }
  }
});
prisma.$connect()
  .then(() => {
    console.log('Connected via Prisma successfully! (Non-pooler, pool_timeout=0)');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Prisma connection failed:', e);
    process.exit(1);
  });
