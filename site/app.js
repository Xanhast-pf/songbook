const state = {
  manifest: null,
  songs: [],
  currentIndex: -1,
  wakeLock: null,
};

const elements = {
  body: document.body,
  nav: document.querySelector('#songNav'),
  lyrics: document.querySelector('#lyrics'),
  search: document.querySelector('#searchInput'),
  songCount: document.querySelector('#songCount'),
  openMenu: document.querySelector('#openMenu'),
  closeMenu: document.querySelector('#closeMenu'),
  backdrop: document.querySelector('#backdrop'),
  fontDown: document.querySelector('#fontDown'),
  fontUp: document.querySelector('#fontUp'),
  wakeLock: document.querySelector('#wakeLock'),
  pager: document.querySelector('#pager'),
  previous: document.querySelector('#previousSong'),
  next: document.querySelector('#nextSong'),
  pagerPosition: document.querySelector('#pagerPosition'),
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function inlineMarkdown(value) {
  let safe = escapeHtml(value);
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return safe;
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let stanza = [];

  const flushStanza = () => {
    if (!stanza.length) return;
    html.push(`<p class="stanza">${stanza.map(inlineMarkdown).join('<br>')}</p>`);
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

function groupMatches(group, query) {
  if (!query) return group.songs;
  const normalized = query.toLocaleLowerCase();
  return group.songs.filter((song) => `${song.title} ${song.artist ?? ''}`.toLocaleLowerCase().includes(normalized));
}

function renderNavigation(query = '') {
  if (!state.manifest) return;
  const currentId = state.songs[state.currentIndex]?.id;
  const groups = state.manifest.groups.map((group) => ({ ...group, songs: groupMatches(group, query) })).filter((group) => group.songs.length);

  elements.nav.innerHTML = groups.map((group) => `
    <section class="nav-group">
      <h2 class="nav-group__title">${escapeHtml(group.title)}</h2>
      ${group.songs.map((song) => `
        <button class="nav-song ${song.id === currentId ? 'is-active' : ''}" type="button" data-song-id="${escapeHtml(song.id)}">
          ${escapeHtml(song.title)}
          ${song.artist ? `<span class="nav-song__artist">${escapeHtml(song.artist)}</span>` : ''}
        </button>
      `).join('')}
    </section>
  `).join('');

  elements.nav.querySelectorAll('[data-song-id]').forEach((button) => {
    button.addEventListener('click', () => openSongById(button.dataset.songId));
  });
}

async function openSong(index, { updateHash = true } = {}) {
  if (index < 0 || index >= state.songs.length) return;
  const song = state.songs[index];
  state.currentIndex = index;

  try {
    const response = await fetch(song.path);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const markdown = await response.text();
    elements.lyrics.innerHTML = renderMarkdown(markdown);
    document.title = `${song.title} · Gig Songbook`;
    elements.pager.hidden = false;
    elements.previous.disabled = index === 0;
    elements.next.disabled = index === state.songs.length - 1;
    elements.pagerPosition.textContent = `${index + 1} / ${state.songs.length}`;
    renderNavigation(elements.search.value.trim());
    closeMenu();
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (updateHash) history.replaceState(null, '', `#${encodeURIComponent(song.id)}`);
  } catch (error) {
    elements.lyrics.innerHTML = `<div class="error"><strong>COULDN'T LOAD THIS SONG.</strong><br>${escapeHtml(String(error.message ?? error))}</div>`;
  }
}

function openSongById(id, options) {
  const index = state.songs.findIndex((song) => song.id === id);
  if (index !== -1) return openSong(index, options);
  return undefined;
}

function openMenu() {
  elements.body.classList.add('menu-open');
  elements.backdrop.hidden = false;
}

function closeMenu() {
  elements.body.classList.remove('menu-open');
  elements.backdrop.hidden = true;
}

function setLyricsSize(nextSize) {
  const size = clamp(nextSize, 0.95, 2.6);
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
  elements.openMenu.addEventListener('click', openMenu);
  elements.closeMenu.addEventListener('click', closeMenu);
  elements.backdrop.addEventListener('click', closeMenu);
  elements.previous.addEventListener('click', () => openSong(state.currentIndex - 1));
  elements.next.addEventListener('click', () => openSong(state.currentIndex + 1));
  elements.fontDown.addEventListener('click', () => {
    const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lyrics-size')) || 1.42;
    setLyricsSize(current - 0.12);
  });
  elements.fontUp.addEventListener('click', () => {
    const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lyrics-size')) || 1.42;
    setLyricsSize(current + 0.12);
  });
  elements.wakeLock.addEventListener('click', toggleWakeLock);

  window.addEventListener('hashchange', () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) openSongById(id, { updateHash: false });
  });

  window.addEventListener('keydown', (event) => {
    if (event.target.matches('input, textarea')) return;
    if (event.key === 'ArrowLeft') openSong(state.currentIndex - 1);
    if (event.key === 'ArrowRight') openSong(state.currentIndex + 1);
    if (event.key === 'Escape') closeMenu();
  });
}

async function init() {
  const savedSize = Number(localStorage.getItem('songbook-lyrics-size'));
  if (Number.isFinite(savedSize) && savedSize > 0) setLyricsSize(savedSize);

  bindEvents();

  try {
    const response = await fetch('./manifest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.manifest = await response.json();
    state.songs = state.manifest.groups.flatMap((group) => group.songs);
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
