// Tessera · the React app's build.
//   npm run dev     the app with hot reload; /api goes to a serve.py (the test copy on 5199 unless TESSERA_SERVER says otherwise)
//   npm run build   type-checks, then writes web/dist, which serve.py serves at http://localhost:5178
// The whiteboard behind Ideas is a plain page in public/ (board.html, board/), copied as it is.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const SERVER = process.env.TESSERA_SERVER || 'http://localhost:5199';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: SERVER, changeOrigin: true } },
  },
  build: {
    target: 'es2022',
    rollupOptions: { input: { app: resolve(__dirname, 'index.html'), widget: resolve(__dirname, 'widget.html') } },
  },
});
