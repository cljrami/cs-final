const fs = require('fs');
const c = fs.readFileSync('public/header.php', 'utf8');
const o = fs.readFileSync('public/publicidad.php', 'utf8');
const newC = o.replace("<?php include __DIR__ . '/header.php'; ?>", c);
fs.writeFileSync('public/publicidad.php', newC);
console.log('restored embedded');
