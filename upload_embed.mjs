const fs = require('fs');
let c = fs.readFileSync('app-web/public/publicidad.php', 'utf8');
let h = fs.readFileSync('app-web/public/header.php', 'utf8');
c = c.replace("<?php include __DIR__ . '/header.php'; ?>", h);
fs.writeFileSync('app-web/public/publicidad.php', c);
console.log('embedded OK');
