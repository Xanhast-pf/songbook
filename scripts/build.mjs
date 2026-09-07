import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = path.join(root, 'content');
const siteDir = path.join(root, 'site');
const distDir = path.join(root, 'dist');

const LANGUAGE_FOLDERS = [
  { id: 'original', folder: 'original', label: 'ORIGINAL' },
  { id: 'francais', folder: 'francais', label: 'FR' },
];

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
const songKey = (filename) => slug(stripNumericPrefix(path.basename(filename)));

async function collectMarkdownFiles(dir, relative = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const rel = path.posix.join(relative, entry.name);
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectMarkdownFiles(full, rel));
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md') && !entry.name.startsWith('_')) files.push(rel);
  }

  return files;
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(siteDir, distDir, { recursive: true });
await cp(contentDir, path.join(distDir, 'content'), { recursive: true });
await writeFile(path.join(distDir, '.nojekyll'), '');

const songsByKey = new Map();

for (const language of LANGUAGE_FOLDERS) {
  const languageDir = path.join(contentDir, language.folder);
  let files = [];

  try {
    files = await collectMarkdownFiles(languageDir);
  } catch {
    continue;
  }

  for (const relativeWithinLanguage of files.sort()) {
    const relativePath = path.posix.join(language.folder, relativeWithinLanguage);
    const markdown = await readFile(path.join(languageDir, relativeWithinLanguage), 'utf8');
    const fallback = stripNumericPrefix(path.basename(relativeWithinLanguage)).replace(/[-_]+/g, ' ').toUpperCase();
    const key = songKey(relativeWithinLanguage);
    const current = songsByKey.get(key) || {
      id: key,
      order: Number.parseInt(path.basename(relativeWithinLanguage).match(/^(\d+)/)?.[1] || '999', 10),
      title: null,
      artist: null,
      versions: {},
    };

    const title = extractTitle(markdown, fallback);
    const artist = extractArtist(markdown);

    if (language.id === 'original' || !current.title) current.title = title;
    if ((language.id === 'original' && artist) || !current.artist) current.artist = artist;

    current.versions[language.id] = {
      path: `./content/${relativePath.split('/').map(encodeURIComponent).join('/')}`,
    };

    songsByKey.set(key, current);
  }
}

const songs = [...songsByKey.values()]
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
  .map(({ order, ...song }) => song);

const manifest = {
  generatedAt: new Date().toISOString(),
  languages: LANGUAGE_FOLDERS.map(({ id, label }) => ({ id, label })),
  songs,
};

await writeFile(path.join(distDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const precache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './chords.js',
  './manifest.json',
  ...songs.flatMap((song) => Object.values(song.versions).map((version) => version.path)),
];

const cacheName = `gig-songbook-${Date.now()}`;
const serviceWorker = `const CACHE = ${JSON.stringify(cacheName)};
const FILES = ${JSON.stringify(precache, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('gig-songbook-') && key !== CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request, { ignoreSearch: true });
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      }),
  );
});
`;
await writeFile(path.join(distDir, 'sw.js'), serviceWorker, 'utf8');

console.log(`Built ${songs.length} songs with ${LANGUAGE_FOLDERS.length} language slots → dist/`);
