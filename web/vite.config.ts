// Tessera · the React app's build.
//   npm run dev     the app with hot reload; /api goes to a serve.py (the test copy on 5199 unless TESSERA_SERVER says otherwise)
//   npm run build   type-checks, then writes web/dist, which serve.py serves at http://localhost:5178
// The whiteboard behind Ideas stays the classic page in mockup/board: dev serves it from there, the build copies it in.
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const MOCKUP = resolve(__dirname, '../mockup');
const SERVER = process.env.TESSERA_SERVER || 'http://localhost:5199';
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

// board.html and board/ come from the classic app, unchanged
function board(): Plugin {
  return {
    name: 'tessera-board',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0];
        if (path !== '/board.html' && !path.startsWith('/board/')) return next();
        const file = join(MOCKUP, path);
        if (!file.startsWith(MOCKUP) || !existsSync(file)) return next();
        res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
        res.end(readFileSync(file));
      });
    },
    closeBundle() {
      const out = resolve(__dirname, 'dist');
      cpSync(join(MOCKUP, 'board.html'), join(out, 'board.html'));
      cpSync(join(MOCKUP, 'board'), join(out, 'board'), { recursive: true });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), board()],
  server: {
    port: 5173,
    proxy: { '/api': { target: SERVER, changeOrigin: true } },
  },
  build: {
    target: 'es2022',
    rollupOptions: { input: { app: resolve(__dirname, 'index.html'), widget: resolve(__dirname, 'widget.html') } },
  },
});
