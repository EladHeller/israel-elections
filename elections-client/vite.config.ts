import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electionsConfig from './src/data/elections-config.json';

export default defineConfig({
  base: '/',
  plugins: [react(), {
    name: 'election-runtime-config',
    configureServer(server) {
      server.middlewares.use('/election-config.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify(electionsConfig));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'election-config.json', source: JSON.stringify(electionsConfig) });
    },
  }],
  build: {
    outDir: 'dist',
  },
});
