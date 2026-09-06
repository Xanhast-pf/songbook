import {
  hasChordNotation,
  parseChordLine,
  stripChordNotation,
  transposeChord,
} from './chords.js';

const state = {
  manifest: null,
  songs: [],
  currentIndex: -1,
  language: 'original',
  currentMarkdown: '',
  hasChords: false,
  chordsVisible: true,
  transpose: 0,
  theme: 'dark',
  wakeLock: null,
};

const elements = {
  body: document.body,
  nav: document.querySelector('#songNav'),
  lyrics: document.querySelector('#lyrics'),
  search: document.querySelector('#searchInput'),
  songCount: document.querySelector('#songCount'),
  menuToggle: document.querySelector('#menuToggle'),
  closeMenu: document.querySelector('#closeMenu'),
  backdrop: document.querySelector('#backdrop'),
  languageToggle: document.querySelector('#languageToggle'),
  originalLabel: document.querySelector('#originalLabel'),
  frenchLabel: document.querySelector('#frenchLabel'),
  chordToolbar: document.querySelector('#chordToolbar'),
  chordsToggle: document.querySelector('#chordsToggle'),
  transposeDown: document.querySelector('#transposeDown'),
  transposeReset: document.querySelector('#transposeReset'),
  transposeValue: document.querySelector('#transposeValue'),
  transposeUp: document.querySelector('#transposeUp'),
  themeToggle: document.querySelector('#themeToggle'),
  themeIcon: document.querySelector('#themeIcon'),
  themeLabel: document.querySelector('#themeLabel'),
  fontDown: document.querySelector('#fontDown'),
  fontUp: document.querySelector('#fontUp'),
  wakeLock: document.querySelector('#wakeLock'),
};

const mobileMenu = window.matchMedia('(max-width: 860px)');
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function externalLinkHtml(label, url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return escapeHtml(label);
    return `<a href="${escapeHtml(parsed.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  } catch {
    return escapeHtml(label);
  }
}

function inlineMarkdown(value) {
  const links = [];
  const tokenFor = (html) => {
    const token = `§§LINK${links.length}§§`;
    links.push({ token, html });
    return token;
  };

  // Standard Markdown links: [label](https://example.com)
  let source = value.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => (
    tokenFor(externalLinkHtml(label, url))
  ));

  // Bare http(s) URLs are clickable too. Keep common trailing punctuation outside the link.
  source = source.replace(/https?:\/\/[^\s<>()\[\]]+/g, (match) => {
    const trailing = /[.,!?;:]+$/.exec(match)?.[0] ?? '';
    const url = trailing ? match.slice(0, -trailing.length) : match;
    return `${tokenFor(externalLinkHtml(url, url))}${trailing}`;
  });

  let safe = escapeHtml(source);
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');

  for (const { token, html } of links) {
    safe = safe.replaceAll(token, html);
  }

  return safe;
}

function renderChordedLine(value, transpose) {
  const parsed = parseChordLine(value);
  if (!parsed.hasChords) return inlineMarkdown(value);

  const html = [];
  const tokens = [...parsed.tokens];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === 'text') {
      html.push(inlineMarkdown(token.value));
      continue;
    }

    const originalChord = token.value;
    const displayChord = transposeChord(originalChord, transpose);
    const next = tokens[index + 1];
    let leading = '';
    let lyricAnchor = '';
    let remainder = '';

    if (next?.type === 'text') {
      const match = /^(\s*)(\S+)?([\s\S]*)$/.exec(next.value);
      leading = match?.[1] ?? '';
      lyricAnchor = match?.[2] ?? '';
      remainder = match?.[3] ?? '';
      index += 1;
    }

    if (leading) html.push(inlineMarkdown(leading));

    const title = transpose
      ? ` title="${escapeHtml(`Original chord: ${originalChord}`)}"`
      : '';
    html.push(
      `<span class="chord-anchor"><span class="chord"${title}>${escapeHtml(displayChord)}</span>`
      + `<span class="chord-anchor__lyric">${lyricAnchor ? inlineMarkdown(lyricAnchor) : '&nbsp;'}</span></span>`,
    );

    if (remainder) html.push(inlineMarkdown(remainder));
  }

  return html.join('');
}

function renderLyricLine(value, { showChords, transpose }) {
  const parsed = parseChordLine(value);
  if (!parsed.hasChords) return { html: inlineMarkdown(value), hasChords: false };

  if (!showChords) {
    return { html: inlineMarkdown(stripChordNotation(value)), hasChords: false };
  }

  return { html: renderChordedLine(value, transpose), hasChords: true };
}

function renderMarkdown(markdown, { showChords = true, transpose = 0 } = {}) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let stanza = [];

  const flushStanza = () => {
    if (!stanza.length) return;
    const renderedLines = stanza.map((line) => renderLyricLine(line, { showChords, transpose }));
    const stanzaHasChords = renderedLines.some((line) => line.hasChords);
    html.push(
      `<div class="stanza${stanzaHasChords ? ' stanza--chords' : ''}">`
      + renderedLines.map((line) => `<div class="song-line${line.hasChords ? ' song-line--chords' : ''}">${line.html || '&nbsp;'}</div>`).join('')
      + '</div>',
    );
    stanza = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    const trimmed = line.trim();

    if (!trimmed) {
      flushStanza();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushStanza();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushStanza();
      html.push('<hr>');
      continue;
    }

    if (trimmed.startsWith('> ')) {
      flushStanza();
      html.push(`<blockquote>${inlineMarkdown(trimmed.slice(2))}</blockquote>`);
      continue;
    }

    if (/^\*\*.+\*\*$/.test(trimmed)) {
      flushStanza();
      html.push(`<p class="artist">${inlineMarkdown(trimmed)}</p>`);
      continue;
    }

    stanza.push(trimmed);
  }

  flushStanza();
  return html.join('\n');
}

function songMatches(song, query) {
  if (!query) return true;
  const normalized = query.toLocaleLowerCase();
  return `${song.title} ${song.artist ?? ''}`.toLocaleLowerCase().includes(normalized);
}

function renderNavigation(query = '') {
  const currentId = state.songs[state.currentIndex]?.id;
  const songs = state.songs
    .map((song, index) => ({ song, number: index + 1 }))
    .filter(({ song }) => songMatches(song, query));

  elements.nav.innerHTML = songs.map(({ song, number }) => `
    <button class="nav-song ${song.id === currentId ? 'is-active' : ''}" type="button" data-song-id="${escapeHtml(song.id)}">
      <span class="nav-song__number" aria-hidden="true">${String(number).padStart(2, '0')}</span>
      <span class="nav-song__copy">
        ${escapeHtml(song.title)}
        ${song.artist ? `<span class="nav-song__artist">${escapeHtml(song.artist)}</span>` : ''}
      </span>
    </button>
  `).join('') || '<p class="nav-empty">NO SONGS FOUND</p>';

  elements.nav.querySelectorAll('[data-song-id]').forEach((button) => {
    button.addEventListener('click', () => openSongById(button.dataset.songId));
  });
}

function availableLanguage(song, preferred = state.language) {
  if (song?.versions?.[preferred]) return preferred;
  if (song?.versions?.original) return 'original';
  if (song?.versions?.francais) return 'francais';
  return null;
}

function updateLanguageToggle(song) {
  const language = availableLanguage(song);
  const hasOriginal = Boolean(song?.versions?.original);
  const hasFrench = Boolean(song?.versions?.francais);
  const canSwitch = hasOriginal && hasFrench;

  elements.languageToggle.disabled = !canSwitch;
  elements.languageToggle.dataset.language = language || state.language;
  elements.originalLabel.classList.toggle('is-active', language === 'original');
  elements.frenchLabel.classList.toggle('is-active', language === 'francais');
  elements.languageToggle.setAttribute('aria-label', canSwitch
    ? (language === 'original' ? 'Afficher la version française' : 'Afficher la version originale')
    : 'Aucune autre version disponible');
}

function getSongTranspose(songId) {
  const saved = Number(localStorage.getItem(`songbook-transpose:${songId}`));
  return Number.isFinite(saved) ? clamp(Math.round(saved), -11, 11) : 0;
}

function saveSongTranspose(songId, transpose) {
  localStorage.setItem(`songbook-transpose:${songId}`, String(transpose));
}

function updateChordControls() {
  elements.chordToolbar.hidden = !state.hasChords;
  if (!state.hasChords) return;

  elements.chordsToggle.setAttribute('aria-pressed', String(state.chordsVisible));
  elements.chordsToggle.setAttribute('aria-label', state.chordsVisible ? 'Hide chords' : 'Show chords');
  elements.chordsToggle.title = state.chordsVisible ? 'Hide chords' : 'Show chords';

  const transposeDisabled = !state.chordsVisible;
  elements.transposeDown.disabled = transposeDisabled || state.transpose <= -11;
  elements.transposeUp.disabled = transposeDisabled || state.transpose >= 11;
  elements.transposeReset.disabled = transposeDisabled || state.transpose === 0;
  elements.transposeValue.textContent = state.transpose > 0 ? `+${state.transpose}` : String(state.transpose).replace('-', '−');
  elements.transposeReset.title = state.transpose === 0 ? 'Original key' : 'Reset transposition';
}

function renderCurrentSong() {
  elements.lyrics.innerHTML = renderMarkdown(state.currentMarkdown, {
    showChords: state.chordsVisible,
    transpose: state.transpose,
  });
  updateChordControls();
}

async function openSong(index, { updateHash = true } = {}) {
  if (index < 0 || index >= state.songs.length) return;
  const song = state.songs[index];
  const language = availableLanguage(song);
  if (!language) return;

  state.currentIndex = index;
  state.language = language;
  state.transpose = getSongTranspose(song.id);

  try {
    const response = await fetch(song.versions[language].path);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.currentMarkdown = await response.text();
    state.hasChords = hasChordNotation(state.currentMarkdown);
    renderCurrentSong();
    document.title = `${song.title} · Gig Songbook`;
    updateLanguageToggle(song);
    renderNavigation(elements.search.value.trim());
    closeMenuAfterSelection();
    window.scrollTo({ top: 0, behavior: 'auto' });
    localStorage.setItem('songbook-language', state.language);
    if (updateHash) history.replaceState(null, '', `#${encodeURIComponent(song.id)}`);
  } catch (error) {
    state.currentMarkdown = '';
    state.hasChords = false;
    elements.chordToolbar.hidden = true;
    elements.lyrics.innerHTML = `<div class="error"><strong>COULDN'T LOAD THIS SONG.</strong><br>${escapeHtml(String(error.message ?? error))}</div>`;
  }
}

function openSongById(id, options) {
  const index = state.songs.findIndex((song) => song.id === id);
  if (index !== -1) return openSong(index, options);
  return undefined;
}

function toggleLanguage() {
  const song = state.songs[state.currentIndex];
  if (!song?.versions?.original || !song?.versions?.francais) return;
  state.language = state.language === 'original' ? 'francais' : 'original';
  openSong(state.currentIndex, { updateHash: false });
}

function toggleChords() {
  if (!state.hasChords) return;
  state.chordsVisible = !state.chordsVisible;
  localStorage.setItem('songbook-chords-visible', String(state.chordsVisible));
  renderCurrentSong();
}

function changeTranspose(delta) {
  if (!state.hasChords || !state.chordsVisible) return;
  const song = state.songs[state.currentIndex];
  if (!song) return;
  const next = clamp(state.transpose + delta, -11, 11);
  if (next === state.transpose) return;
  state.transpose = next;
  saveSongTranspose(song.id, state.transpose);
  renderCurrentSong();
}

function resetTranspose() {
  if (!state.hasChords || !state.chordsVisible || state.transpose === 0) return;
  const song = state.songs[state.currentIndex];
  if (!song) return;
  state.transpose = 0;
  saveSongTranspose(song.id, state.transpose);
  renderCurrentSong();
}

function toggleMenu() {
  if (mobileMenu.matches) {
    const opening = !elements.body.classList.contains('menu-open');
    elements.body.classList.toggle('menu-open', opening);
    elements.backdrop.hidden = !opening;
    return;
  }

  elements.body.classList.toggle('menu-collapsed');
  localStorage.setItem('songbook-menu-collapsed', String(elements.body.classList.contains('menu-collapsed')));
}

function closeMenu() {
  if (mobileMenu.matches) {
    elements.body.classList.remove('menu-open');
    elements.backdrop.hidden = true;
    return;
  }

  elements.body.classList.add('menu-collapsed');
  localStorage.setItem('songbook-menu-collapsed', 'true');
}

function closeMenuAfterSelection() {
  if (mobileMenu.matches) {
    elements.body.classList.remove('menu-open');
    elements.backdrop.hidden = true;
  }
}

function syncMenuMode() {
  elements.body.classList.remove('menu-open');
  elements.backdrop.hidden = true;

  if (mobileMenu.matches) {
    elements.body.classList.remove('menu-collapsed');
    return;
  }

  elements.body.classList.toggle(
    'menu-collapsed',
    localStorage.getItem('songbook-menu-collapsed') === 'true',
  );
}

function applyTheme(theme, { persist = true } = {}) {
  const nextTheme = theme === 'light' ? 'light' : 'dark';
  state.theme = nextTheme;
  document.documentElement.dataset.theme = nextTheme;

  const isDark = nextTheme === 'dark';
  const actionLabel = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  elements.themeIcon.textContent = isDark ? '☾' : '☼';
  elements.themeLabel.textContent = isDark ? 'Dark mode' : 'Light mode';
  elements.themeToggle.setAttribute('aria-label', actionLabel);
  elements.themeToggle.title = actionLabel;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = getComputedStyle(document.body).backgroundColor;

  if (persist) localStorage.setItem('songbook-theme', nextTheme);
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

function setLyricsSize(nextSize) {
  const size = clamp(Math.round(nextSize * 4) / 4, 1, 2.5);
  document.documentElement.style.setProperty('--lyrics-size', `${size}rem`);
  localStorage.setItem('songbook-lyrics-size', String(size));
}

async function toggleWakeLock() {
  if (!('wakeLock' in navigator)) {
    elements.wakeLock.title = 'Screen wake lock is not supported in this browser';
    return;
  }

  if (state.wakeLock) {
    await state.wakeLock.release();
    state.wakeLock = null;
    elements.wakeLock.setAttribute('aria-pressed', 'false');
    return;
  }

  try {
    state.wakeLock = await navigator.wakeLock.request('screen');
    elements.wakeLock.setAttribute('aria-pressed', 'true');
    state.wakeLock.addEventListener('release', () => {
      state.wakeLock = null;
      elements.wakeLock.setAttribute('aria-pressed', 'false');
    }, { once: true });
  } catch {
    elements.wakeLock.setAttribute('aria-pressed', 'false');
  }
}

function bindEvents() {
  elements.search.addEventListener('input', () => renderNavigation(elements.search.value.trim()));
  elements.menuToggle.addEventListener('click', toggleMenu);
  elements.closeMenu.addEventListener('click', closeMenu);
  elements.backdrop.addEventListener('click', closeMenu);
  elements.languageToggle.addEventListener('click', toggleLanguage);
  elements.chordsToggle.addEventListener('click', toggleChords);
  elements.transposeDown.addEventListener('click', () => changeTranspose(-1));
  elements.transposeReset.addEventListener('click', resetTranspose);
  elements.transposeUp.addEventListener('click', () => changeTranspose(1));
  elements.themeToggle.addEventListener('click', toggleTheme);
  elements.fontDown.addEventListener('click', () => {
    const current = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lyrics-size')) || 1.5;
    setLyricsSize(current - 0.25);
  });
  elements.fontUp.addEventListener('click', () => {
    const current = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lyrics-size')) || 1.5;
    setLyricsSize(current + 0.25);
  });
  elements.wakeLock.addEventListener('click', toggleWakeLock);
  mobileMenu.addEventListener('change', syncMenuMode);

  window.addEventListener('hashchange', () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) openSongById(id, { updateHash: false });
  });

  window.addEventListener('keydown', (event) => {
    if (event.target.matches('input, textarea')) return;
    if (event.key === 'ArrowLeft') openSong(state.currentIndex - 1);
    if (event.key === 'ArrowRight') openSong(state.currentIndex + 1);
    if (event.key === 'Escape' && mobileMenu.matches) closeMenu();
  });
}

async function init() {
  const savedTheme = localStorage.getItem('songbook-theme');
  applyTheme(savedTheme === 'light' ? 'light' : 'dark', { persist: false });

  const savedSize = Number(localStorage.getItem('songbook-lyrics-size'));
  if (Number.isFinite(savedSize) && savedSize > 0) setLyricsSize(savedSize);

  const savedLanguage = localStorage.getItem('songbook-language');
  if (savedLanguage === 'original' || savedLanguage === 'francais') state.language = savedLanguage;

  const savedChordsVisible = localStorage.getItem('songbook-chords-visible');
  if (savedChordsVisible === 'false') state.chordsVisible = false;

  if (!mobileMenu.matches && localStorage.getItem('songbook-menu-collapsed') === 'true') {
    elements.body.classList.add('menu-collapsed');
  }

  bindEvents();

  try {
    const response = await fetch('./manifest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.manifest = await response.json();
    state.songs = state.manifest.songs;
    elements.songCount.textContent = `${state.songs.length} ${state.songs.length === 1 ? 'song' : 'songs'}`;
    renderNavigation();

    const requested = decodeURIComponent(location.hash.slice(1));
    if (requested && state.songs.some((song) => song.id === requested)) {
      await openSongById(requested, { updateHash: false });
    } else if (state.songs.length) {
      await openSong(0);
    }
  } catch (error) {
    elements.lyrics.innerHTML = `<div class="error"><strong>COULDN'T LOAD THE SONGBOOK.</strong><br>${escapeHtml(String(error.message ?? error))}</div>`;
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
