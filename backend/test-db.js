const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_v6KL8xcCEUAo@ep-tiny-king-acfh0bks.sa-east-1.aws.neon.tech/neondb?sslmode=require"
    }
  }
});
prisma.$connect()
  .then(() => {
    console.log('Connected to NON-POOLER successfully!');
    process.exit(0);
  })
  .catch((e) => {
    console.error('NON-POOLER Connection failed:', e);
    process.exit(1);
  });
