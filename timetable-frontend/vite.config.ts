import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/', // Gunakan '/' karena memakai domain pribadi (CNAME)
});
