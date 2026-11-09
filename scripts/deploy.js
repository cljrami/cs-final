import { Client } from 'basic-ftp';
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative, dirname } from 'path';
import { createHash } from 'crypto';
import './fix-css-fonts.mjs';

// La clave FTP JAMÁS va en código: entorno o archivo local .ftp-pass (gitignored).
function readLocalFtpPass() {
  try {
    const p = join(process.cwd(), '.ftp-pass');
    if (existsSync(p)) {
      return readFileSync(p, 'utf-8').trim();
    }
  } catch {}
  return '';
}

const FTP_PASSWORD = process.env.FTP_PASSWORD || readLocalFtpPass();
if (!FTP_PASSWORD) {
  console.error('Falta FTP_PASSWORD: define la variable de entorno o crea el archivo local .ftp-pass (gitignored) con la clave.');
  process.exit(1);
}

const CONFIG = {
  host: process.env.FTP_HOST || 'consexvip.cl',
  user: process.env.FTP_USER || 'consexvip',
  password: FTP_PASSWORD,
  // OJO: el docroot real que sirve el sitio es /domains/consexvip.cl/public_html.
  // /domains/www.consexvip.cl/public_html existe pero NO lo usan los vhosts.
  remoteRoot: process.env.FTP_REMOTE_ROOT || '/domains/consexvip.cl/public_html',
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

    // Poda automática: borrar en remoto los chunks _astro que ya no existen
    // en el build local (el deploy solo subía y acumulaba basura).
    try {
      const localAstro = new Set(readdirSync(join(CONFIG.localRoot, '_astro')));
      const remoteAstroDir = [CONFIG.remoteRoot, '_astro'].join('/').replace(/\\/g, '/');
      const remoteAstro = await client.list(remoteAstroDir);
      let pruned = 0;
      for (const f of remoteAstro) {
        if (f.isDirectory || localAstro.has(f.name)) continue;
        try {
          await client.remove(remoteAstroDir + '/' + f.name);
          pruned++;
        } catch (e) {
          console.error(`  no se pudo podar ${f.name}: ${e.message || e}`);
        }
      }
      console.log(`Poda _astro: ${pruned} huérfano(s) eliminado(s).`);
    } catch (e) {
      console.error(`Poda _astro omitida: ${e.message || e}`);
    }

    // IndexNow: avisar a Google/Bing de los cambios para reindexar en minutos.
    // La clave vive en .indexnow-key (gitignored). Si no existe, se omite sin fallar.
    await pingIndexNow();
  } finally {
    try { client.close(); } catch {}
  }
}

/**
 * Envía el ping de IndexNow con las URLs clave del sitio (home, ciudades, negocios,
 * artículos). Lee las URLs del sitemap desplegado para no mantener una lista manual.
 */
async function pingIndexNow() {
  try {
    const keyFile = join(process.cwd(), '.indexnow-key');
    if (!existsSync(keyFile)) {
      console.log('IndexNow: sin clave local (.indexnow-key), se omite el ping.');
      return;
    }
    const key = readFileSync(keyFile, 'utf-8').trim();
    if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
      console.log('IndexNow: clave local inválida, se omite el ping.');
      return;
    }

    const siteUrl = 'https://www.consexvip.cl';
    const urls = new Set([siteUrl + '/']);
    try {
      const res = await fetch(siteUrl + '/sitemap.xml', { headers: { 'User-Agent': 'Consexvip-Deploy' } });
      const xml = await res.text();
      const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim());
      for (const u of locs) {
        // Solo las páginas públicas principales (no login/registro/panel)
        if (/\/(login|ingresar|unirse|registro|micuenta|admin|recuperar)/i.test(u)) continue;
        urls.add(u);
      }
    } catch (e) {
      console.log('IndexNow: no se pudo leer el sitemap, se avisa solo la home.');
    }

    const payload = {
      host: 'www.consexvip.cl',
      key,
      keyLocation: siteUrl + '/' + key + '.txt',
      urlList: [...urls].slice(0, 10000),
    };
    const body = JSON.stringify(payload);

    let ok = 0;
    for (const endpoint of ['https://api.indexnow.org/indexnow', 'https://www.bing.com/indexnow']) {
      try {
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body,
        });
        if (r.status === 200 || r.status === 202) ok++;
        else console.log(`IndexNow: ${endpoint} respondió ${r.status}`);
      } catch (e) {
        console.log(`IndexNow: fallo en ${endpoint}: ${e.message || e}`);
      }
    }
    console.log(`IndexNow: ${payload.urlList.length} URL(s) notificadas a ${ok}/2 buscador(es).`);

    // Ping Google sitemap
    try {
      const gRes = await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(siteUrl + '/sitemap.xml')}`, { method: 'GET' }).catch(() => null);
      if (gRes && (gRes.status === 200 || gRes.status === 202)) {
        console.log('Google sitemap ping: OK');
      } else {
        console.log('Google sitemap ping: no respondió 200');
      }
    } catch {}
  } catch (e) {
    console.log(`IndexNow omitido: ${e.message || e}`);
  }
}

deploy().catch((e) => {
  console.error('Error de deploy:', e.message);
  process.exit(1);
});
