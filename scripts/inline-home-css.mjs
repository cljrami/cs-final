import fs from 'node:fs';

const dir = 'public_html';
const htmlPath = `${dir}/index.html`;
let html = fs.readFileSync(htmlPath, 'utf8');

const cssFiles = [];
for (const m of html.matchAll(/<link rel="stylesheet" href="(\/_astro\/(?:global|fa-fontfaces)\.[A-Za-z0-9_-]+\.css)">/g)) {
  cssFiles.push(m[1]);
}

let css = '';
for (const f of cssFiles) {
  css += fs.readFileSync(`${dir}/${f}`, 'utf8') + '\n';
}

let out = html;
for (const f of cssFiles) {
  out = out.replace(`<link rel="stylesheet" href="${f}">`, '');
}

const style = `<style>${css}</style>`;
const preload = '<link rel="preload" href="/fonts/inter-latin-variable.woff2" as="font" type="font/woff2" crossorigin>';
if (out.includes(preload)) {
  out = out.replace(preload, preload + style);
} else {
  out = out.replace('</head>', style + '</head>');
}

fs.writeFileSync(htmlPath, out);
console.log(`Inline CSS in index.html: ${cssFiles.join(', ')} (${css.length} bytes)`);
