import { defineConfig } from 'vite';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const CONTENT = path.resolve('src/content');
const PAGES = path.resolve('work'); // generated: /work/ and /work/<project>/
// Windows paths arrive with either slash and either drive-letter case
const norm = (p) => path.resolve(p).split(path.sep).join('/').toLowerCase();
const inside = (file, dir) => norm(file).startsWith(norm(dir) + '/');
const load = (file) => import(`${pathToFileURL(path.join(CONTENT, file)).href}?t=${Date.now()}`);

// Writes work/index.html and work/<id>/index.html from src/content/projects.js,
// in a fresh Node process so every edit to the content or templates is seen.
// Returns every page's path so the build can include them.
function writePages() {
  const out = execFileSync(process.execPath, [path.join(CONTENT, 'write-pages.js')], { encoding: 'utf8' });
  const { pages, shots } = JSON.parse(out);
  return { pages, shots: new Set(shots) };
}

// Project content lives in one data file. This plugin renders it into the home
// page's showcase and into the generated work pages, as real crawlable HTML.
function workContent() {
  let shots = new Set();
  return {
    name: 'work-content',
    config() {
      const built = writePages();
      shots = built.shots;
      return {
        build: {
          rollupOptions: {
            input: { main: path.resolve('index.html'), ...built.pages },
            output: {
              // screenshots keep a stable address, so share images and
              // structured data can point at them
              assetFileNames: (info) => {
                const name = path.basename(info.names?.[0] ?? info.name ?? '');
                return shots.has(name) ? 'assets/work/[name][extname]' : 'assets/[name]-[hash][extname]';
              },
            },
          },
        },
      };
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html) {
        if (!html.includes('<!-- @work-showcase -->')) return html;
        const { SITE, CATEGORIES, PROJECTS } = await load('projects.js');
        const { renderShowcase, renderSocial } = await load('render-work.js');
        return html
          .replace('<!-- @work-showcase -->', renderShowcase(CATEGORIES, PROJECTS))
          .replace('<!-- @social -->', renderSocial(SITE));
      },
    },
    // editing the project data or templates rewrites the pages and reloads the browser
    handleHotUpdate({ file, server }) {
      if (inside(file, CONTENT)) {
        try {
          shots = writePages().shots;
        } catch (e) {
          server.config.logger.error(`[work-content] couldn't write the work pages:\n${e.stderr || e.message}`);
        }
        server.ws.send({ type: 'full-reload' });
        return [];
      }
      if (inside(file, PAGES)) return []; // our own output
    },
  };
}

export default defineConfig({
  base: './',
  server: { port: 5173, host: true },
  plugins: [workContent()],
  // the lazily-loaded world chunk is mostly three.js (~130 kB gzipped)
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 600 },
});
