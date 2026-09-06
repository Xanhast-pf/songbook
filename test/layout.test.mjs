import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../site/app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../site/styles.css', import.meta.url), 'utf8');

test('toolbar exposes an accessible lyrics column control', () => {
  assert.match(html, /id="columnsToggle"/);
  assert.match(html, /id="columnsValue">1</);
  assert.match(html, /aria-label="Lyrics columns: 1\. Switch to 2 columns"/);
});

test('column preference cycles from one through three and persists locally', () => {
  assert.match(app, /clamp\(Math\.round\(columns\), 1, 3\)/);
  assert.match(app, /state\.columns === 3 \? 1 : state\.columns \+ 1/);
  assert.match(app, /localStorage\.setItem\('songbook-columns'/);
  assert.match(app, /localStorage\.getItem\('songbook-columns'/);
});

test('multi-column layout expands the reading width and keeps stanzas together', () => {
  assert.match(css, /\.lyrics\[data-columns="2"\][\s\S]*?column-count:\s*2/);
  assert.match(css, /\.lyrics\[data-columns="3"\][\s\S]*?column-count:\s*3/);
  assert.match(css, /\.lyrics \.stanza,[\s\S]*?break-inside:\s*avoid-column/);
});

test('narrow phones fall back to a single readable column', () => {
  assert.match(css, /@media \(max-width: 38\.75rem\)[\s\S]*?\.lyrics\[data-columns="2"\][\s\S]*?column-count:\s*1/);
});
