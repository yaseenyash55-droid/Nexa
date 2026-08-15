import fs from 'fs';
import path from 'path';

console.log('Running Nexa Runtime Mock Guard Check...');

const serverSrc = path.join(process.cwd(), 'server', 'src');

function scanDirectory(dir: string) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (file.endsWith('.ts') && !file.includes('.test.') && !file.includes('.spec.')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('process.env.DATA_SOURCE === "mock"') && !fullPath.endsWith('factory.ts')) {
        console.error(`Forbidden mock condition found in runtime file: ${fullPath}`);
        process.exit(1);
      }
    }
  }
}

scanDirectory(serverSrc);
console.log('✓ Runtime mock guard passed successfully.');
