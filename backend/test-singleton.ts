import { prisma } from './src/lib/prisma';
async function test() {
  try {
    const user = await prisma.user.findFirst();
    console.log('Query successful! User:', user);
    process.exit(0);
  } catch (e) {
    console.error('Query failed:', e);
    process.exit(1);
  }
}
test();
