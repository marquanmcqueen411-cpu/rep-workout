// Copies the static app into dist/ (deploy dist/ to Cloudflare Pages or GitHub Pages).
import { cpSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true }); mkdirSync('dist');
for (const p of ['index.html', 'styles.css', 'manifest.json', 'sw.js', 'src', 'icons']) cpSync(p, `dist/${p}`, { recursive: true });
writeFileSync('dist/.nojekyll', '');
console.log('Built dist/');
