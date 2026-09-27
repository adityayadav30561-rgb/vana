// Writes work/index.html and work/<id>/index.html from projects.js, then
// prints the page list as JSON. vite.config.js runs this in a process of its
// own each time, so edits to the content or the templates are always read fresh.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as data from './projects.js';
import { renderWorkPage, renderProjectPage } from './render-pages.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'work');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const pages = { work: path.join(out, 'index.html') };
fs.writeFileSync(pages.work, renderWorkPage(data));
for (const p of data.PROJECTS) {
  const file = path.join(out, p.id, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, renderProjectPage(data, p));
  pages[`work/${p.id}`] = file;
}

process.stdout.write(JSON.stringify({ pages, shots: data.PROJECTS.flatMap((p) => p.shots.map((s) => `${s.file}.webp`)) }));
