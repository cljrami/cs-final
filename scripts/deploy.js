import { Client } from 'basic-ftp';
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative, dirname } from 'path';
import { createHash } from 'crypto';
import './fix-css-fonts.mjs';

const CONFIG = {
  host: process.env.FTP_HOST || 'kimi.zona8.cl',
  user: process.env.FTP_USER || 'kimi',
  password: process.env.FTP_PASSWORD || 'CUERAzzCX2FZ9xRDfFUR',
  remoteRoot: process.env.FTP_REMOTE_ROOT || '/domains/kimi.zona8.cl/public_html',
  localRoot: 'public_html',
};

const CACHE_FILE = join(process.cwd(), '.deploy-cache.json');
const MAX_RETRIES = 4;
const PHP_SOURCE_DIR = 'public';

function md5(filePath) {
  return createHash('md5').update(readFileSync(filePath)).digest('hex');
}

function walkDir(dir) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(full));
    } else {
      const stats = statSync(full);
      files.push({ path: full, size: stats.size });
    }
  }
  return files;
}

function loadCache() {
  try {
    if (existsSync(CACHE_FILE)) {
      return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveCache(cache) {
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function connect() {
  const client = new Client(30000); // timeout 30s
  client.ftp.verbose = false;
  await client.access({
    host: CONFIG.host,
    user: CONFIG.user,
    password: CONFIG.password,
    secure: false,
  });
  return client;
}

async function deploy() {
  let client = await connect().then((c) => {
    console.log('Conectado.\n');
    return c;
  });

  const localFiles = walkDir(CONFIG.localRoot);

  // Incluir archivos PHP desde public/ (no se compilan con Astro, se despliegan directamente)
  // Incluir archivos PHP desde public/api/ (no se compilan con Astro, se despliegan directamente)
  const apiDir = join(PHP_SOURCE_DIR, 'api');
  if (existsSync(apiDir)) {
    walkDir(apiDir).filter(f => /\.(php)$/i.test(f.path)).forEach(f => {
      const relApi = relative(apiDir, f.path).replace(/\\/g, '/');
      const webRel = join('api', relApi).replace(/\\/g, '/');
      localFiles.push({ ...f, webRel });
    });
  }
  const cache = loadCache();
  const ensuredDirs = new Set();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  // Reconecta si el socket se cae.
  async function reconnect() {
    try { client.close(); } catch {}
    ensuredDirs.clear();
    for (let i = 1; i <= MAX_RETRIES; i++) {
      try {
        console.log(`  Reconectando (intento ${i})...`);
        client = await connect();
        return;
      } catch (e) {
        await sleep(1500 * i);
      }
    }
    throw new Error('No se pudo reconectar al FTP');
  }

  async function uploadWithRetry(file, relPath, remoteFile, remoteDir) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (!ensuredDirs.has(remoteDir)) {
          await client.ensureDir(remoteDir);
          ensuredDirs.add(remoteDir);
        }
        await client.uploadFrom(file.path, remoteFile);
        return true;
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        const isConn = /ECONNRESET|closed|timeout|EPIPE|ETIMEDOUT/i.test(msg);
        if (attempt === MAX_RETRIES) {
          console.error(`✗ ${relPath} — ${msg}`);
          return false;
        }
        if (isConn) {
          await reconnect();
        } else {
          await sleep(800 * attempt);
        }
      }
    }
    return false;
  }

  try {
    // Script para solucionar el problema de migración de sticky_posiciones
    const fixScriptDir = join(PHP_SOURCE_DIR, 'admin');
    const fixScriptPath = join(fixScriptDir, 'fix_sticky_positions_v2.php');
    if (existsSync(fixScriptPath)) {
      const fixContent = readFileSync(fixScriptPath, 'utf-8');
      const encodedFix = Buffer.from(fixContent).toString('base64');
      localFiles.push({
        path: fixScriptPath,
        size: statSync(fixScriptPath).size,
        webRel: 'api/admin/fix_sticky_positions_v2.php',
      });
    }


    // Subir archivos (saltando los que no cambiaron según cache)
    for (const file of localFiles) {
      const relPath = file.webRel || relative(CONFIG.localRoot, file.path).replace(/\\/g, '/');
      const remoteFile = join(CONFIG.remoteRoot, relPath).replace(/\\/g, '/');
      const remoteDir = dirname(remoteFile).replace(/\\/g, '/');
      const hash = md5(file.path);
      const cacheKey = relPath;

      if (cache[cacheKey] === hash) {
        skipped++;
        continue;
      }

      const ok = await uploadWithRetry(file, relPath, remoteFile, remoteDir);
      if (ok) {
        cache[cacheKey] = hash;
        uploaded++;
      } else {
        failed++;
      }
    }

    saveCache(cache);
    console.log(`\nListo. Subidos: ${uploaded} | Sin cambios: ${skipped} | Fallidos: ${failed}`);
    if (failed > 0) {
      console.log('Vuelve a ejecutar el deploy: los archivos ya subidos se saltaran por cache.');
      process.exitCode = 1;
    }
  } finally {
    try { client.close(); } catch {}
  }
}

deploy().catch((e) => {
  console.error('Error de deploy:', e.message);
  process.exit(1);
});
