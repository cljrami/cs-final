import { Client } from 'basic-ftp';
const c = new Client();
await c.access({host:'consexvip.cl', user:'consexvip', password:'RpJwcYqN6mdkfz3bQYpE', secure:false});
await c.uploadFrom('public/header.php', '/domains/consexvip.cl/public_html/header.php');
await c.uploadFrom('public/publicidad.php', '/domains/consexvip.cl/public_html/publicidad.php');
await c.uploadFrom('public/.htaccess', '/domains/consexvip.cl/public_html/.htaccess');
console.log('OK');
await c.close();
