const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_v6KL8xcCEUAo@ep-tiny-king-acfh0bks-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require',
  connectionTimeoutMillis: 5000
});

client.connect()
  .then(() => {
    console.log('Connected directly to pg!');
    return client.end();
  })
  .catch(e => {
    console.error('PG raw connection failed:');
    console.error(e.message);
    if (e.code) console.error('Error Code:', e.code);
    process.exit(1);
  });
