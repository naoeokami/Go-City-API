const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_v6KL8xcCEUAo@ep-tiny-king-acfh0bks-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require',
  connectionTimeoutMillis: 5000
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to DB. Running manual migration...');
    
    // Add matchesPlayed
    await client.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "matchesPlayed" INTEGER NOT NULL DEFAULT 0;');
    console.log('Added matchesPlayed');
    
    // Add matchesWon
    await client.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "matchesWon" INTEGER NOT NULL DEFAULT 0;');
    console.log('Added matchesWon');
    
    // Add badges (Array of Strings)
    await client.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "badges" TEXT[] DEFAULT ARRAY[]::TEXT[];');
    console.log('Added badges');
    
    console.log('Migration successful!');
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
}

runMigration();
