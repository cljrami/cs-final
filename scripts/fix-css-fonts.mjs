import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const dir = join(process.cwd(), 'public_html', '_astro');

if (!existsSync(dir)) {
  console.log('fix-css-fonts: no se encontró public_html/_astro');
  process.exit(0);
}

let changed = 0;
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.css')) continue;
  const p = join(dir, f);
  const css = readFileSync(p, 'utf-8');
  const fixed = css.replace(/font-display:\s*block/gi, 'font-display: swap');
  if (fixed !== css) {
    writeFileSync(p, fixed);
    changed++;
    console.log(`fix-css-fonts: ${f} → font-display: swap`);
  }
}
console.log(`fix-css-fonts: ${changed} archivo(s) actualizado(s)`);
