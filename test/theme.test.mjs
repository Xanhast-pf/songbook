import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../site/app.js', import.meta.url), 'utf8');

test('songbook defaults to dark mode and exposes an accessible theme toggle', () => {
  assert.match(html, /<html lang="en" data-theme="dark">/);
  assert.match(html, /id="themeToggle"/);
  assert.match(html, /aria-label="Switch to light mode"/);
});

test('theme preference is persisted locally', () => {
  assert.match(app, /localStorage\.setItem\('songbook-theme'/);
  assert.match(app, /localStorage\.getItem\('songbook-theme'/);
});
