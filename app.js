/* FROM AMERICA — an endless wall of two words.
   Every visible tile loops silently from a small preview file.
   Pointing at one brings in the real clip, with sound. */

const PAGE = 48;
const HOVER_DELAY = 50;

const $ = (s) => document.querySelector(s);
const el = (t, c) => {
  const n = document.createElement(t);
  if (c) n.className = c;
  return n;
};

const state = { clips: [], shown: 0, cursor: 0, playing: false };

/* Browsers refuse to play audio until the page has been interacted with, and
   a pointerenter does not count as interaction. So hover audio stays silent
   until the first real gesture, and we say so rather than failing quietly. */
let armed = false;

function arm() {
  if (armed) return;
  armed = true;
  $('#sound').hidden = true;
  // Anything already hovered should become audible immediately.
  for (const v of document.querySelectorAll('.tile__loud')) {
    v.muted = false;
    v.play().catch(() => {});
  }
}

for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
  document.addEventListener(ev, arm, { once: true, passive: true });
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function attribution(c) {
  return [c.station, c.show].filter(Boolean).join(' — ') || c.source || '';
}

/* ----------------------------------------------------------------- ticker */

function ticker() {
  const track = $('#ticker');
  const run = [];
  for (let i = 0; i < 20; i++) run.push('FROM AMERICA');
  for (const label of run.concat(run)) {
    const s = el('span');
    s.textContent = label;
    track.append(s);
  }
}

/* ------------------------------------------------------------------- wall */

const hoverTimers = new WeakMap();

function makeTile(clip, index) {
  const tile = el('button', 'tile');
  tile.type = 'button';
  tile.dataset.index = index;
  tile.setAttribute('aria-label', attribution(clip) || 'clip');

  if (clip.poster) {
    const img = el('img');
    img.src = clip.poster;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    tile.append(img);
  }

  const logo = el('span', 'tile__logo');
  logo.textContent = 'From America';
  tile.append(logo);

  const meta = el('span', 'tile__meta');
  meta.textContent = attribution(clip);
  tile.append(meta);

  tile.addEventListener('pointerenter', () => {
    hoverTimers.set(tile, setTimeout(() => loud(tile, clip), HOVER_DELAY));
  });
  tile.addEventListener('pointerleave', () => {
    clearTimeout(hoverTimers.get(tile));
    hush(tile);
  });
  tile.addEventListener('focus', () => loud(tile, clip));
  tile.addEventListener('blur', () => hush(tile));
  tile.addEventListener('click', () => openTheater(index));

  return tile;
}

function attachPreview(tile) {
  if (tile.querySelector('.tile__preview')) return;
  const clip = state.clips[Number(tile.dataset.index)];
  if (!clip) return;

  const v = el('video', 'tile__preview');
  v.src = clip.preview || clip.file;
  v.loop = true;
  v.muted = true;
  v.defaultMuted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.tabIndex = -1;
  v.addEventListener('playing', () => tile.classList.add('is-live'), { once: true });
  tile.append(v);
  v.play().catch(() => {});
}

function detachPreview(tile) {
  hush(tile);
  const v = tile.querySelector('.tile__preview');
  if (!v) return;
  v.pause();
  v.removeAttribute('src');
  v.load();
  v.remove();
  tile.classList.remove('is-live');
}

/* The full clip is a separate element laid over the preview. Swapping .src on
   the preview instead tears down its decoder mid-play, which is what made
   hover audio silently do nothing. */
function loud(tile, clip) {
  if (tile.querySelector('.tile__loud')) return;

  const v = el('video', 'tile__loud');
  v.src = clip.file;
  v.loop = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.tabIndex = -1;
  v.muted = !armed;
  v.addEventListener('playing', () => tile.classList.add('is-loud'), { once: true });
  tile.append(v);

  v.play().catch(() => {
    // Refused because the page has not been interacted with yet.
    v.muted = true;
    $('#sound').hidden = armed;
    v.play().catch(() => {});
  });
}

function hush(tile) {
  const v = tile.querySelector('.tile__loud');
  if (!v) return;
  v.pause();
  v.removeAttribute('src');
  v.load();
  v.remove();
  tile.classList.remove('is-loud');
}

const visible = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) attachPreview(e.target);
      else detachPreview(e.target);
    }
  },
  { rootMargin: '300px 0px', threshold: 0.01 }
);

function appendPage() {
  const wall = $('#wall');
  const frag = document.createDocumentFragment();
  const end = Math.min(state.shown + PAGE, state.clips.length);
  for (let i = state.shown; i < end; i++) frag.append(makeTile(state.clips[i], i));
  wall.append(frag);
  for (const t of wall.querySelectorAll('.tile:not([data-observed])')) {
    t.dataset.observed = '1';
    visible.observe(t);
  }
  state.shown = end;
}

/* ---------------------------------------------------------------- theater */

const theater = $('#theater');
const video = $('#theater-video');

function openTheater(index, autoAdvance = false) {
  if (!state.clips.length) return;
  arm();
  state.cursor = (index + state.clips.length) % state.clips.length;
  state.playing = autoAdvance;

  const clip = state.clips[state.cursor];
  theater.hidden = false;
  document.body.classList.add('is-locked');

  $('#theater-said').textContent = clip.said || 'from America';
  $('#theater-src').textContent = attribution(clip);
  const link = $('#theater-link');
  link.href = clip.url || '#';
  link.hidden = !clip.url;

  video.src = clip.file;
  video.muted = false;
  video.play().catch(() => {
    video.muted = true;
    video.play().catch(() => {});
  });
  $('#theater-pause').textContent = 'Pause';
}

function closeTheater() {
  theater.hidden = true;
  state.playing = false;
  video.pause();
  video.removeAttribute('src');
  video.load();
  document.body.classList.remove('is-locked');
}

video.addEventListener('ended', () => {
  if (state.playing) openTheater(state.cursor + 1, true);
});

$('#theater-close').addEventListener('click', closeTheater);
$('#theater-next').addEventListener('click', () => openTheater(state.cursor + 1, state.playing));
$('#theater-prev').addEventListener('click', () => openTheater(state.cursor - 1, state.playing));
$('#theater-pause').addEventListener('click', (e) => {
  if (video.paused) {
    video.play();
    e.target.textContent = 'Pause';
  } else {
    video.pause();
    e.target.textContent = 'Play';
  }
});
$('#play-all').addEventListener('click', () => openTheater(0, true));

document.addEventListener('keydown', (e) => {
  if (theater.hidden) return;
  if (e.key === 'Escape') closeTheater();
  if (e.key === 'ArrowRight') openTheater(state.cursor + 1, state.playing);
  if (e.key === 'ArrowLeft') openTheater(state.cursor - 1, state.playing);
});

/* -------------------------------------------------------------------- boot */

async function boot() {
  ticker();

  let data = { clips: [] };
  try {
    const res = await fetch('clips.json', { cache: 'no-cache' });
    if (res.ok) data = await res.json();
  } catch { /* not built yet */ }

  state.clips = shuffle(data.clips || []);
  if (!state.clips.length) {
    $('#empty').hidden = false;
    return;
  }

  $('#sound').hidden = false;
  appendPage();

  const more = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && state.shown < state.clips.length) {
      appendPage();
    }
  }, { rootMargin: '800px 0px' });
  more.observe($('#sentinel'));
}

boot();
