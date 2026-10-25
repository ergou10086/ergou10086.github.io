/* Persistent media, bounded loading and timers across Butterfly PJAX navigation. */
(() => {
  'use strict';
  const config = window.__SITE_WALLPAPER__;
  if (!config?.images?.length || window.SiteWallpaper) return;
  const html = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 768px)');
  const connection = navigator.connection;
  const state = { mode: config.initialMode, index: Math.max(0, config.images.findIndex(image => image.id === config.initialId)),
    cursor: 0, active: false, frame: null, pending: null, generation: 0, nextTimer: null, preloadTimer: null,
    remaining: config.intervalSeconds * 1000, due: 0, prefetch: null, retire: new Set(), observer: null, viewportObserver: null, inView: true };
  state.cursor = state.index;
  let root;
  const interval = config.intervalSeconds * 1000;
  const surfaceVisible = () => state.active && !document.hidden && (state.mode === 'unified' || state.inView);
  const posterOnly = () => (config.respectReducedMotion && reducedMotion.matches) || (config.saveDataPosterOnly && connection?.saveData);
  const sourceFor = image => mobile.matches || connection?.saveData ? image.mobile : image.desktop;
  const stillFor = image => image.kind === 'video' ? image.poster : sourceFor(image);
  const persist = () => {
    try { localStorage.setItem('ergoutree-wallpaper', JSON.stringify({ mode: state.mode, image: config.images[state.index].id })); } catch {}
  };
  function release(frame) {
    if (!frame) return;
    const video = frame.querySelector('video');
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    const image = frame.querySelector('img');
    if (image) { image.removeAttribute('srcset'); image.removeAttribute('src'); }
    frame.remove();
  }
  function stopTimers(preserve = false) {
    if (preserve && state.due) state.remaining = Math.max(1, state.due - Date.now());
    clearTimeout(state.nextTimer); clearTimeout(state.preloadTimer);
    state.nextTimer = state.preloadTimer = null; state.due = 0;
  }
  function dropPrefetch() {
    if (!state.prefetch) return;
    state.prefetch.removeAttribute('src'); state.prefetch = null;
  }
  function prefetchNext() {
    if (!surfaceVisible() || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '') || config.images.length < 2) return;
    dropPrefetch();
    const image = new Image();
    image.decoding = 'async'; image.fetchPriority = 'low';
    image.src = stillFor(config.images[(state.index + 1) % config.images.length]);
    state.prefetch = image;
  }
  function armTimer() {
    stopTimers();
    if (!surfaceVisible() || config.images.length < 2) return;
    const delay = Math.max(1, state.remaining);
    state.due = Date.now() + delay;
    state.nextTimer = setTimeout(() => next(), delay);
    const lead = config.preloadLeadSeconds * 1000;
    if (lead > 0 && delay > lead) state.preloadTimer = setTimeout(prefetchNext, delay - lead);
  }
  function updateControls() {
    const button = document.getElementById('wallpaper-mode');
    if (button) {
      const unified = state.mode === 'unified';
      button.setAttribute('aria-pressed', String(unified));
      button.title = unified ? '切换为分区背景' : '切换为一图流背景';
      button.setAttribute('aria-label', button.title);
      button.dataset.mode = state.mode;
    }
    document.querySelectorAll('[data-wallpaper-next]').forEach(link => {
      link.title = html.dataset.wallpaperHome === 'true' ? '下一张背景' : '返回首页并切换背景';
      link.setAttribute('aria-label', `${link.textContent.trim()} · ${link.title}`);
      // A local media action must not be intercepted by PJAX or instant.page.
      if (html.dataset.wallpaperHome === 'true') link.setAttribute('data-no-instant', '');
      else link.removeAttribute('data-no-instant');
    });
  }
  function startVideo(frame, image) {
    if (!frame || image.kind !== 'video' || !surfaceVisible() || posterOnly() || frame !== state.frame) return;
    let video = frame.querySelector('video');
    if (!video) {
      video = document.createElement('video');
      video.className = 'wallpaper-media';
      video.muted = true; video.defaultMuted = true; video.loop = true; video.autoplay = true; video.playsInline = true;
      video.setAttribute('muted', ''); video.setAttribute('playsinline', ''); video.setAttribute('aria-hidden', 'true');
      video.preload = 'auto'; video.poster = image.poster; video.disablePictureInPicture = true;
      video.addEventListener('loadeddata', () => { if (frame === state.frame) frame.classList.add('video-ready'); }, { once: true });
      video.addEventListener('error', () => { frame.classList.remove('video-ready'); video.pause(); video.removeAttribute('src'); video.load(); }, { once: true });
      frame.appendChild(video);
      video.src = sourceFor(image);
    }
    video.play().catch(() => {
      frame.classList.remove('video-ready');
      video.pause(); video.removeAttribute('src'); video.load();
      video.remove();
    });
  }
  async function show(index) {
    if (!root || !state.active) return;
    const generation = ++state.generation;
    if (state.pending) release(state.pending);
    stopTimers(); dropPrefetch();
    const image = config.images[index], frame = document.createElement('div'), img = new Image();
    frame.className = 'wallpaper-frame';
    frame.style.setProperty('--wallpaper-position', image.position);
    img.className = 'wallpaper-media'; img.alt = ''; img.decoding = 'async'; img.fetchPriority = 'high';
    frame.appendChild(img); root.appendChild(frame); state.pending = frame;
    const button = document.getElementById('wallpaper-mode');
    button?.setAttribute('aria-busy', 'true');
    let loadingTimeout;
    try {
      const loaded = new Promise((resolve, reject) => {
        img.onload = resolve; img.onerror = () => reject(new Error(`Unable to load ${image.id}`));
        loadingTimeout = setTimeout(() => reject(new Error(`Timed out loading ${image.id}`)), 30000);
      });
      img.src = stillFor(image);
      await loaded;
      if (img.decode) await img.decode().catch(() => {});
      if (generation !== state.generation || !state.active) { release(frame); return; }
      const previous = state.frame;
      previous?.querySelector('video')?.pause();
      state.frame = frame; state.pending = null; state.index = index; state.cursor = index;
      root.dataset.current = image.id; root.dataset.kind = image.kind;
      root.style.setProperty('--wallpaper-position', image.position);
      html.style.setProperty('--wallpaper-footer', `url(${JSON.stringify(stillFor(image))})`);
      html.style.setProperty('--wallpaper-start', `url(${JSON.stringify(stillFor(image))})`);
      // The incoming poster has decoded; keep the old frame visible until now.
      requestAnimationFrame(() => {
        if (generation !== state.generation || frame !== state.frame) return;
        frame.classList.add('is-current'); previous?.classList.remove('is-current');
        startVideo(frame, image);
      });
      const timer = setTimeout(() => {
        release(previous); state.retire.delete(timer);
        if (frame === state.frame) root.style.backgroundImage = 'none';
      }, reducedMotion.matches ? 0 : config.transitionMs + 50);
      state.retire.add(timer);
      state.remaining = interval; persist(); armTimer();
      document.dispatchEvent(new CustomEvent('wallpaper:change', { detail: { id: image.id, mode: state.mode } }));
    } catch (error) {
      if (generation === state.generation) {
        release(frame); state.pending = null; state.cursor = state.index; state.remaining = interval; armTimer();
        console.warn('[backgrounds]', error.message);
      }
    } finally {
      clearTimeout(loadingTimeout);
      if (generation === state.generation) document.getElementById('wallpaper-mode')?.removeAttribute('aria-busy');
    }
  }
  function next() {
    state.cursor = (state.cursor + 1) % config.images.length;
    if (state.active) return show(state.cursor);
    state.index = state.cursor; persist();
  }
  function setMode(mode) {
    if (!['split', 'unified'].includes(mode) || mode === state.mode) return;
    state.mode = mode; html.dataset.wallpaperMode = mode; persist(); syncPage();
  }
  function syncPage() {
    const header = document.getElementById('page-header');
    const home = !!header?.classList.contains('full_page');
    html.dataset.wallpaperHome = String(home);
    html.dataset.wallpaperMode = state.mode;
    const active = home || state.mode === 'unified';
    html.dataset.wallpaperActive = String(active);
    if (header && home) html.style.setProperty('--wallpaper-hero-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
    state.observer?.disconnect();
    state.viewportObserver?.disconnect();
    if (header && home && typeof ResizeObserver !== 'undefined') {
      state.observer = new ResizeObserver(entries => html.style.setProperty('--wallpaper-hero-height', `${Math.ceil(entries[0].contentRect.height)}px`));
      state.observer.observe(header);
    }
    if (header && home && typeof IntersectionObserver !== 'undefined') {
      state.inView = header.getBoundingClientRect().bottom > 0 && header.getBoundingClientRect().top < innerHeight;
      state.viewportObserver = new IntersectionObserver(entries => {
        const inView = entries[0].isIntersecting;
        if (state.inView === inView) return;
        state.inView = inView;
        if (state.mode !== 'split' || !state.active) return;
        if (!inView) { stopTimers(true); dropPrefetch(); state.frame?.querySelector('video')?.pause(); }
        else { startVideo(state.frame, config.images[state.index]); armTimer(); }
      });
      state.viewportObserver.observe(header);
    } else state.inView = true;
    updateControls();
    if (!active) {
      stopTimers(true); dropPrefetch(); state.generation++;
      release(state.pending); release(state.frame); state.pending = state.frame = null;
      state.active = false; root.style.backgroundImage = '';
      return;
    }
    state.active = true;
    if (!state.frame && !state.pending) show(state.index);
    else if (surfaceVisible()) { startVideo(state.frame, config.images[state.index]); if (!state.nextTimer) armTimer(); }
    else { stopTimers(true); state.frame?.querySelector('video')?.pause(); }
  }
  function init() {
    root = document.getElementById('site-wallpaper');
    if (!root) return;
    syncPage();
    document.addEventListener('click', event => {
      const button = event.target.closest('#wallpaper-mode');
      if (button) {
        event.preventDefault(); setMode(state.mode === 'unified' ? 'split' : 'unified'); return;
      }
      const brand = event.target.closest('[data-wallpaper-next]');
      if (!brand || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (html.dataset.wallpaperHome === 'true') {
        event.preventDefault(); event.stopImmediatePropagation(); next();
      } else {
        // Preserve the familiar inner-page return-home behavior, selecting the
        // next image before PJAX replaces the page contents.
        if (state.active) next();
        else { state.index = (state.cursor + 1) % config.images.length; state.cursor = state.index; persist(); }
      }
    }, true);
    document.addEventListener('pjax:complete', syncPage);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { stopTimers(true); dropPrefetch(); state.frame?.querySelector('video')?.pause(); }
      else if (state.active) { startVideo(state.frame, config.images[state.index]); armTimer(); }
    });
    const motionChanged = () => {
      const video = state.frame?.querySelector('video');
      if (posterOnly() && video) { state.frame.classList.remove('video-ready'); video.pause(); video.removeAttribute('src'); video.load(); video.remove(); }
      else if (state.frame) startVideo(state.frame, config.images[state.index]);
    };
    reducedMotion.addEventListener('change', motionChanged);
    connection?.addEventListener?.('change', motionChanged);
    window.addEventListener('pagehide', () => { stopTimers(true); state.frame?.querySelector('video')?.pause(); });
    window.addEventListener('pageshow', event => { if (event.persisted) syncPage(); });
  }
  window.SiteWallpaper = Object.freeze({ next, setMode, get current() { return config.images[state.index].id; }, get mode() { return state.mode; } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
