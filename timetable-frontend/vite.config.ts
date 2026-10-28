import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/', // Gunakan '/' karena memakai domain pribadi (CNAME)
});

// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';

//export default defineConfig({
  // plugins: [react()],
  // Ganti '/AdministrasiSekolah/' dengan nama repositori GitHub Anda yang sebenarnya (pastikan diawali dan diakhiri dengan garis miring '/')
  // base: '/AdministrasiSekolah/', 
//});
//import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';

//export default defineConfig({
  //plugins: [react()],
  // base: '/', // Gunakan '/' karena memakai domain pribadi (CNAME)
//});
