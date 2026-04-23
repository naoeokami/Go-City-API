const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_v6KL8xcCEUAo@ep-tiny-king-acfh0bks-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require',
  connectionTimeoutMillis: 10000
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to DB. Running tournament management migration...');
    
    // Create groups table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "groups" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "championshipId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "groups_championshipId_fkey" FOREIGN KEY ("championshipId") REFERENCES "championships"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    console.log('Created groups table');

    // Add groupId to registrations
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='registrations' AND COLUMN_NAME='groupId') THEN
          ALTER TABLE "registrations" ADD COLUMN "groupId" TEXT;
          ALTER TABLE "registrations" ADD CONSTRAINT "registrations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    console.log('Updated registrations table');

    // Add fields to matches
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='matches' AND COLUMN_NAME='groupId') THEN
          ALTER TABLE "matches" ADD COLUMN "groupId" TEXT;
          ALTER TABLE "matches" ADD CONSTRAINT "matches_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='matches' AND COLUMN_NAME='round') THEN
          ALTER TABLE "matches" ADD COLUMN "round" INTEGER DEFAULT 1;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='matches' AND COLUMN_NAME='bracketOrder') THEN
          ALTER TABLE "matches" ADD COLUMN "bracketOrder" INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='matches' AND COLUMN_NAME='nextMatchId') THEN
          ALTER TABLE "matches" ADD COLUMN "nextMatchId" TEXT;
        END IF;
      END $$;
    `);
    console.log('Updated matches table');

    console.log('Tournament migration successful!');
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
}

runMigration();
