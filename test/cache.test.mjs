import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../site/app.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
const build = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');

test('songbook exposes a manual refresh control', () => {
  assert.match(index, /id="refreshButton"/);
  assert.match(app, /async function refreshSongbook\(\)/);
  assert.match(app, /getRegistration\('\.\/'\)/);
  assert.match(app, /registration\.unregister\(\)/);
  assert.match(app, /searchParams\.set\('_refresh'/);
});

test('service worker updates bypass the HTTP cache', () => {
  assert.match(app, /updateViaCache: 'none'/);
  assert.match(app, /await registration\.update\(\)/);
  assert.match(app, /controllerchange/);
  assert.match(build, /fetch\(event\.request, \{ cache: 'no-store' \}\)/);
});

test('manifest and song markdown request fresh network content', () => {
  assert.match(app, /fetch\('\.\/manifest\.json', \{ cache: 'no-store' \}\)/);
  assert.match(app, /fetch\(song\.versions\[language\]\.path, \{ cache: 'no-store' \}\)/);
});
