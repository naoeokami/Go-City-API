const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, 'src', 'controllers');
const files = fs.readdirSync(controllersDir);

for (const file of files) {
  if (!file.endsWith('.ts') || file === 'auth.controller.ts') continue;
  
  const filePath = path.join(controllersDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove PrismaClient import
  content = content.replace(/import\s*{\s*PrismaClient\s*}\s*from\s*['"]@prisma\/client['"]/g, '');
  
  // Replace instantiation with import
  content = content.replace(/const\s+prisma\s*=\s*new\s*PrismaClient\(\)/g, "import { prisma } from '../lib/prisma'");
  
  fs.writeFileSync(filePath, content);
  console.log('Updated ' + file);
}
