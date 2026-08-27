import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function processFile(filePath) {
  if (!filePath.endsWith('.ts')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // fix: sendError(res, 'UNAUTHORIZED', 'Not authenticated', details: [], 401);
  // to: sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
  const regex = /sendError\(res, '([^']+)', ('.*?'), details: \[\], (\d+)\);/g;
  content = content.replace(regex, "sendError(res, '$1', $2, $3);");

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${filePath}`);
  }
}

walkDir(path.join(process.cwd(), 'server', 'src'), processFile);
