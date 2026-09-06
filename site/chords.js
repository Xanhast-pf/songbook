const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_INDEX = new Map([
  ['C', 0], ['B#', 0],
  ['C#', 1], ['DB', 1],
  ['D', 2],
  ['D#', 3], ['EB', 3],
  ['E', 4], ['FB', 4],
  ['E#', 5], ['F', 5],
  ['F#', 6], ['GB', 6],
  ['G', 7],
  ['G#', 8], ['AB', 8],
  ['A', 9],
  ['A#', 10], ['BB', 10],
  ['B', 11], ['CB', 11],
]);

const CHORD_TOKEN = /\[([^\]\n]+)\]/g;
const ROOT_NOTE = /^[A-Ga-g](?:[#b♯♭])?/;
const BASS_NOTE = /\/([A-Ga-g](?:[#b♯♭])?)$/;
const QUALITY_TOKEN = /^(?:(?:maj|min|dim|aug|sus|add|no|m|M|Δ|ø|°|\+|-)|[0-9#b♯♭()]|\/)*$/;

const normalizeAccidentals = (value) => value.replaceAll('♯', '#').replaceAll('♭', 'b');

function splitChordSymbol(value) {
  const chord = value.trim();
  if (/^N\.?C\.?$/i.test(chord)) return { special: chord };

  const rootMatch = ROOT_NOTE.exec(chord);
  if (!rootMatch) return null;

  const root = rootMatch[0];
  let suffix = chord.slice(root.length);
  let bass = null;
  const bassMatch = BASS_NOTE.exec(suffix);

  if (bassMatch) {
    bass = bassMatch[1];
    suffix = suffix.slice(0, bassMatch.index);
  }

  if (!QUALITY_TOKEN.test(suffix)) return null;
  return { root, suffix, bass };
}

export function isChordSymbol(value) {
  return Boolean(splitChordSymbol(value));
}

export function parseChordLine(value) {
  const tokens = [];
  let cursor = 0;
  let match;

  CHORD_TOKEN.lastIndex = 0;
  while ((match = CHORD_TOKEN.exec(value)) !== null) {
    // Do not treat the [label] part of a Markdown link as a chord.
    if (value[CHORD_TOKEN.lastIndex] === '(' || !isChordSymbol(match[1])) continue;

    if (match.index > cursor) tokens.push({ type: 'text', value: value.slice(cursor, match.index) });
    tokens.push({ type: 'chord', value: match[1].trim() });
    cursor = CHORD_TOKEN.lastIndex;
  }

  if (!tokens.some((token) => token.type === 'chord')) {
    return { hasChords: false, tokens: [{ type: 'text', value }] };
  }

  if (cursor < value.length) tokens.push({ type: 'text', value: value.slice(cursor) });
  return { hasChords: true, tokens };
}

export function stripChordNotation(value) {
  const parsed = parseChordLine(value);
  return parsed.tokens
    .filter((token) => token.type === 'text')
    .map((token) => token.value)
    .join('');
}

export function hasChordNotation(markdown) {
  return markdown
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .some((line) => parseChordLine(line).hasChords);
}

function noteIndex(note) {
  const normalized = normalizeAccidentals(note);
  const key = `${normalized[0]?.toUpperCase() ?? ''}${normalized.slice(1)}`;
  return NOTE_INDEX.get(key.toUpperCase());
}

function transposeNote(note, semitones, preferFlats) {
  const index = noteIndex(note);
  if (index === undefined) return note;
  const next = (index + semitones % 12 + 12) % 12;
  return (preferFlats ? FLAT_NOTES : SHARP_NOTES)[next];
}

export function transposeChord(value, semitones = 0) {
  const parsed = splitChordSymbol(value);
  if (!parsed || parsed.special || !semitones) return value.trim();

  const normalized = normalizeAccidentals(value);
  const preferFlats = /[A-G]b/i.test(normalized) && !/[A-G]#/i.test(normalized);
  const root = transposeNote(parsed.root, semitones, preferFlats);
  const bass = parsed.bass ? `/${transposeNote(parsed.bass, semitones, preferFlats)}` : '';
  return `${root}${parsed.suffix}${bass}`;
}
