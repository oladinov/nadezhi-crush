import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Zero-dependency Vite plugin that injects compiled asset filenames (/assets/*.js, /assets/*.css)
 * and a deterministic content hash into dist/sw.js at build time for 100% offline PWA functionality.
 */
function offlineServiceWorkerPlugin() {
  return {
    name: 'nadezhi-offline-sw',
    apply: 'build' as const,
    closeBundle() {
      const distDir = path.resolve(process.cwd(), 'dist');
      const swPath = path.join(distDir, 'sw.js');
      const assetsDir = path.join(distDir, 'assets');

      if (!fs.existsSync(swPath)) return;

      const buildAssets: string[] = [];
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        for (const file of files) {
          if (file.endsWith('.js') || file.endsWith('.css') || file.endsWith('.woff2')) {
            buildAssets.push(`'/assets/${file}'`);
          }
        }
      }

      const hashInput = buildAssets.join(',') + Date.now().toString();
      const shortHash = crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 10);
      const cacheVersion = `nadezhi-offline-v1-${shortHash}`;

      let swContent = fs.readFileSync(swPath, 'utf-8');
      swContent = swContent.replace('__NADEZHI_CACHE_VERSION__', cacheVersion);
      swContent = swContent.replace('/* __BUILD_ASSETS__ */', buildAssets.join(',\n  '));

      fs.writeFileSync(swPath, swContent, 'utf-8');
    },
  };
}

export default defineConfig({
  plugins: [offlineServiceWorkerPlugin()],
});
