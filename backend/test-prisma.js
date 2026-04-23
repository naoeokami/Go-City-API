const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_v6KL8xcCEUAo@ep-tiny-king-acfh0bks-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15'
    }
  }
});
prisma.$connect()
  .then(() => {
    console.log('Connected via Prisma successfully!');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Prisma connection failed:', e);
    process.exit(1);
  });
