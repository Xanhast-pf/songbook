import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../site/styles.css', import.meta.url), 'utf8');

function rootBlock(source) {
  const match = /:root\s*\{([\s\S]*?)\n\}/.exec(source);
  return match?.[0] ?? '';
}

test('rem values stay on the quarter-rem scale', () => {
  const values = [...css.matchAll(/(-?\d+(?:\.\d+)?)rem/g)].map((match) => Number(match[1]));
  const offScale = values.filter((value) => !Number.isInteger(value * 4));

  assert.deepEqual(offScale, []);
});

test('pixel measurements are reserved for one-pixel precision rules', () => {
  const values = [...css.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]));
  const nonPrecisionValues = values.filter((value) => Math.abs(value) !== 1);

  assert.deepEqual(nonPrecisionValues, []);
});

test('component rules consume palette tokens instead of hardcoded colors', () => {
  const componentCss = css.replace(rootBlock(css), '');
  const hardcodedColors = componentCss.match(/#[0-9a-f]{3,8}\b|\brgba?\(/gi) ?? [];

  assert.deepEqual(hardcodedColors, []);
});
