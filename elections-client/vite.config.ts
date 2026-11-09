import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { electionPreviewAssets } from './scripts/social-preview.mjs';
import electionsConfig from './src/data/elections-config.json';

const previewAssets = electionPreviewAssets();
const latestPreview = previewAssets.filter(asset => asset.mode === 'results').reduce((latest, asset) => Number(asset.election) > Number(latest.election) ? asset : latest);

export default defineConfig({
  base: '/',
  plugins: [react(), {
    name: 'social-preview-origin',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // Absolute image URLs must use the environment being deployed.
        const siteUrl = process.env.VITE_SITE_URL || 'https://elections.eladheller.com';
        const parsed = new URL(siteUrl);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
          throw new Error('VITE_SITE_URL must be an HTTPS origin');
        }
        return html.replaceAll('%VITE_SITE_URL%', parsed.origin)
          .replaceAll('%PREVIEW_ELECTION%', latestPreview.election)
          .replaceAll('%PREVIEW_IMAGE%', latestPreview.fileName);
      },
    },
    generateBundle() {
      for (const asset of previewAssets) {
        this.emitFile({ type: 'asset', fileName: asset.fileName, source: asset.png });
      }
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const asset = previewAssets.find(asset => request.url === '/' + asset.fileName);
        if (!asset) return next();
        response.setHeader('Content-Type', 'image/png');
        response.end(asset.png);
      });
    },
  }, {
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
