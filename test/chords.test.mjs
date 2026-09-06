import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasChordNotation,
  isChordSymbol,
  parseChordLine,
  stripChordNotation,
  transposeChord,
} from '../site/chords.js';

test('recognizes common ChordPro-style chord symbols', () => {
  for (const chord of ['G', 'F#m7', 'Bbmaj7', 'Dsus4', 'Cadd9', 'D/F#', 'Am7b5', 'N.C.']) {
    assert.equal(isChordSymbol(chord), true, chord);
  }
  assert.equal(isChordSymbol('WATCH'), false);
  assert.equal(isChordSymbol('FR'), false);
});

test('parses chords without mistaking Markdown links for chords', () => {
  const line = '[G]TAGI HEVA TE [D]TAI [WATCH](https://example.com)';
  const parsed = parseChordLine(line);
  assert.equal(parsed.hasChords, true);
  assert.deepEqual(parsed.tokens.filter((token) => token.type === 'chord').map((token) => token.value), ['G', 'D']);
  assert.match(stripChordNotation(line), /\[WATCH\]\(https:\/\/example\.com\)/);
});

test('detects chord notation in a Markdown document', () => {
  assert.equal(hasChordNotation('# SONG\n\n[G]HELLO [D]WORLD'), true);
  assert.equal(hasChordNotation('# SONG\n\n[WATCH](https://example.com)'), false);
});

test('transposes roots, qualities and slash bass notes', () => {
  assert.equal(transposeChord('G', 2), 'A');
  assert.equal(transposeChord('F#m7', 2), 'G#m7');
  assert.equal(transposeChord('D/F#', 2), 'E/G#');
  assert.equal(transposeChord('Bbmaj7', -2), 'Abmaj7');
  assert.equal(transposeChord('N.C.', 4), 'N.C.');
});
