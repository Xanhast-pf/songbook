import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = path.join(root, 'content');
const siteDir = path.join(root, 'site');
const distDir = path.join(root, 'dist');

const slug = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9/._-]+/g, '-')
  .replace(/^-+|-+$/g, '');

const extractTitle = (markdown, fallback) => {
  const match = markdown.match(/^#{1,3}\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
};

const extractArtist = (markdown) => {
  const match = markdown.match(/^\*\*(.+?)\*\*$/m);
  return match?.[1]?.trim() || null;
};

const stripNumericPrefix = (filename) => filename.replace(/^\d+[._-]?/, '').replace(/\.md$/i, '');
const prettyFolder = (name) => name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

async function collectMarkdownFiles(dir, relative = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const rel = path.posix.join(relative, entry.name);
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectMarkdownFiles(full, rel));
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(rel);
  }
  return files;
}

async function groupMeta(directoryRelative) {
  const file = path.join(contentDir, directoryRelative, '_group.json');
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return {};
  }
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(siteDir, distDir, { recursive: true });
await cp(contentDir, path.join(distDir, 'content'), { recursive: true });
await writeFile(path.join(distDir, '.nojekyll'), '');

const markdownFiles = (await collectMarkdownFiles(contentDir)).filter((file) => !path.basename(file).startsWith('_'));
const grouped = new Map();

for (const relativePath of markdownFiles.sort()) {
  const directory = path.posix.dirname(relativePath) === '.' ? 'songs' : path.posix.dirname(relativePath);
  const markdown = await readFile(path.join(contentDir, relativePath), 'utf8');
  const fallback = stripNumericPrefix(path.basename(relativePath)).replace(/[-_]+/g, ' ').toUpperCase();
  const title = extractTitle(markdown, fallback);
  const artist = extractArtist(markdown);
  const id = slug(relativePath.replace(/\.md$/i, ''));
  const song = {
    id,
    title,
    artist,
    path: `./content/${relativePath.split(path.sep).map(encodeURIComponent).join('/')}`,
  };
  if (!grouped.has(directory)) grouped.set(directory, []);
  grouped.get(directory).push(song);
}

const groups = [];
for (const [directory, songs] of grouped) {
  const meta = await groupMeta(directory);
  groups.push({
    id: slug(directory),
    title: meta.title || prettyFolder(path.basename(directory)),
    order: Number.isFinite(meta.order) ? meta.order : 999,
    songs,
  });
}

groups.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
const manifest = { generatedAt: new Date().toISOString(), groups: groups.map(({ order, ...group }) => group) };
await writeFile(path.join(distDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const precache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  ...manifest.groups.flatMap((group) => group.songs.map((song) => song.path)),
];
const cacheName = `gig-songbook-${Date.now()}`;
const serviceWorker = `const CACHE = ${JSON.stringify(cacheName)};\nconst FILES = ${JSON.stringify(precache, null, 2)};\nself.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting())); });\nself.addEventListener('activate', (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())); });\nself.addEventListener('fetch', (event) => { if (event.request.method !== 'GET') return; event.respondWith(fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))); });\n`;
await writeFile(path.join(distDir, 'sw.js'), serviceWorker, 'utf8');

console.log(`Built ${manifest.groups.reduce((sum, group) => sum + group.songs.length, 0)} songs in ${manifest.groups.length} groups → dist/`);
