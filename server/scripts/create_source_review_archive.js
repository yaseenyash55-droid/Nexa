const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '../..');

// Secret scan regexes constructed dynamically to avoid self-matching
const secretRegexes = [
  new RegExp('AIzaSy' + '[A-Za-z0-9_-]{35}'),
  new RegExp('sk_live_' + '[0-9a-zA-Z]{24}'),
  new RegExp('-----BEGIN ' + 'PRIVATE KEY-----')
];

function scanDirectory(dir, flaggedFiles = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(rootDir, fullPath);

    // Exclude unwanted directories & environment files
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === 'build' ||
      entry.name === '.gradle' ||
      entry.name === 'uploads' ||
      entry.name === '.git' ||
      entry.name === 'coverage' ||
      entry.name === 'scratch'
    ) {
      continue;
    }

    if (entry.name.startsWith('.env') && entry.name !== '.env.example') {
      // Ignore private .env files from scan (they are excluded from the zip archive)
      continue;
    }

    if (entry.isDirectory()) {
      scanDirectory(fullPath, flaggedFiles);
    } else if (entry.isFile()) {
      // Ignore binary files, lockfiles, images, zip
      if (
        relativePath.endsWith('.png') ||
        relativePath.endsWith('.jpg') ||
        relativePath.endsWith('.zip') ||
        relativePath.endsWith('.jar') ||
        relativePath.endsWith('.keystore') ||
        entry.name === 'package-lock.json' ||
        entry.name === 'create_source_review_archive.js'
      ) {
        continue;
      }

      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const regex of secretRegexes) {
          if (regex.test(content)) {
            flaggedFiles.push(`${relativePath} (Matched secret pattern)`);
            break;
          }
        }
      } catch (err) {
        // Skip unreadable binary
      }
    }
  }

  return flaggedFiles;
}

console.log('=== Step 1: Performing Secret Scan ===');
const flagged = scanDirectory(rootDir);

if (flagged.length > 0) {
  console.error('❌ SECRET SCAN FAILED! The following tracked source files contain potential secrets:');
  flagged.forEach((f) => console.error(` - ${f}`));
  process.exit(1);
} else {
  console.log('✓ Secret scan passed cleanly. 0 secret patterns detected in tracked source files.');
}

console.log('\n=== Step 2: Creating Source Review Zip Archive ===');

const zipName = 'nexa-source-review.zip';
const zipPath = path.join(rootDir, zipName);

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// Target inclusion directories for source review
const targets = [
  'client/src',
  'server/src',
  'android',
  'database',
  'e2e',
  'server/tests',
  'server/scripts',
  'docs',
  'package.json',
  'server/package.json',
  'client/package.json',
  'playwright.config.ts',
  'README.md',
  '.env.example'
];

const targetItems = targets.filter(t => fs.existsSync(path.join(rootDir, t))).map(t => `'${t}'`).join(',');

const psCommand = `$targets = @(${targetItems}); Compress-Archive -Path $targets -DestinationPath '${zipName}' -Force`;

try {
  execSync(`powershell -Command "${psCommand.replace(/\n/g, ' ')}"`, { cwd: rootDir, stdio: 'inherit' });
  console.log(`✓ Zip archive successfully created at: ${zipPath}`);
} catch (err) {
  console.error('Failed to create zip archive via PowerShell:', err.message);
  process.exit(1);
}

console.log('\n=== Step 3: Generating SHA-256 Checksum ===');
const fileBuffer = fs.readFileSync(zipPath);
const hashSum = crypto.createHash('sha256');
hashSum.update(fileBuffer);
const hexHash = hashSum.digest('hex');

const sha256FilePath = path.join(rootDir, `${zipName}.sha256`);
fs.writeFileSync(sha256FilePath, `${hexHash}  ${zipName}\n`);

console.log(`✓ SHA-256 Checksum generated: ${hexHash}`);
console.log(`✓ SHA-256 file written to: ${sha256FilePath}`);
