// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Mantenlo estático para que funcione en hosting compartido[cite: 2]
  output: 'static', 
  integrations: [react()],
  outDir: 'public_html',
  vite: {
    plugins: [tailwindcss()],
  }
});