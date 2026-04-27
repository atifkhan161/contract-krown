import { readFileSync, writeFileSync, renameSync } from 'fs';
import { createHash } from 'crypto';
import { join, extname } from 'path';

const distDir = './dist/client';

const filesToHash = ['app.js', 'styles.css'];

function computeHash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

function processFiles() {
  const mappings = {};
  
  for (const file of filesToHash) {
    const filePath = join(distDir, file);
    try {
      const content = readFileSync(filePath);
      const hash = computeHash(content);
      const ext = extname(file);
      const base = file.replace(ext, '');
      const newName = `${base}.${hash}${ext}`;
      
      renameSync(filePath, join(distDir, newName));
      mappings[file] = newName;
      console.log(`[hash] ${file} -> ${newName}`);
    } catch (err) {
      console.error(`[hash] Error processing ${file}:`, err.message);
    }
  }
  
  updateHtml(distDir, mappings);
  console.log('[hash] Done');
}

function updateHtml(distDir, mappings) {
  const htmlPath = join(distDir, 'index.html');
  let html = readFileSync(htmlPath, 'utf-8');
  
  html = html.replace('/styles.css', `/${mappings['styles.css']}`);
  html = html.replace('/app.js', `/${mappings['app.js']}`);
  
  writeFileSync(htmlPath, html);
  console.log('[hash] Updated index.html');
}

processFiles();