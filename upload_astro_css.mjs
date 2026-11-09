import { Client } from 'basic-ftp';
const c = new Client();
await c.access({host:'consexvip.cl', user:'consexvip', password:'RpJwcYqN6mdkfz3bQYpE', secure:false});
await c.uploadFrom('public/html/_astro/escort-profile.css', '/domains/consexvip.cl/public_html/_astro/escort-profile.css');
console.log('astro css deployed');
await c.close();
