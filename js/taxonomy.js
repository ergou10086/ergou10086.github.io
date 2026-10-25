/* Word packing and local filtering; safe to initialize again after Butterfly PJAX. */
(() => {
  'use strict';
  if (window.__taxonomyPages) { window.__taxonomyPages(); return; }

  function packCloud(cloud) {
    if (!cloud.isConnected || cloud.clientWidth < 1) return;
    const words = [...cloud.querySelectorAll('.tx-word:not([hidden])')];
    cloud.classList.remove('is-packed');
    cloud.style.height = '';
    for (const word of cloud.querySelectorAll('.tx-word')) { word.style.left = ''; word.style.top = ''; }
    // A narrow phone screen reads better as a wrapped cloud than a tall ellipse.
    if (words.length < 4 || cloud.clientWidth < 480) return;
    const width = cloud.clientWidth;
    const boxes = words.map(word => ({ word, w: Math.ceil(word.offsetWidth) + 8, h: Math.ceil(word.offsetHeight) + 8 }))
      .sort((a, b) => Number(b.word.dataset.count) - Number(a.word.dataset.count) || b.w - a.w);
    let height = Math.max(420, Math.ceil(boxes.reduce((sum, box) => sum + box.w * box.h, 0) / width / .55));
    for (let attempt = 0; attempt < 3; attempt++, height = Math.ceil(height * 1.18)) {
      const placed = [];
      let success = true;
      for (const box of boxes) {
        let position = null;
        for (let step = 0; step < 6500; step++) {
          const angle = step * .57, radius = width / 155 * Math.sqrt(step);
          const x = Math.round(width / 2 + Math.cos(angle) * radius - box.w / 2);
          const y = Math.round(height / 2 + Math.sin(angle) * radius * height / width - box.h / 2);
          if (x < 3 || y < 10 || x + box.w > width - 3 || y + box.h > height - 10) continue;
          if (placed.some(p => x < p.x + p.w && x + box.w > p.x && y < p.y + p.h && y + box.h > p.y)) continue;
          position = { x, y, w: box.w, h: box.h, word: box.word };
          break;
        }
        if (!position) { success = false; break; }
        placed.push(position);
      }
      if (success) {
        cloud.style.height = `${height}px`;
        for (const item of placed) { item.word.style.left = `${item.x + 4}px`; item.word.style.top = `${item.y + 4}px`; }
        cloud.classList.add('is-packed');
        return;
      }
    }
    // Dense or extremely narrow layouts use the readable flex fallback.
  }

  function init() {
    const page = document.querySelector('[data-taxonomy]');
    if (!page || page.dataset.txReady) return;
    page.dataset.txReady = 'true';
    const cloud = page.querySelector('.tx-cloud');
    const items = [...page.querySelectorAll(cloud ? '.tx-word' : '[data-tx-item]')];
    const groups = [...page.querySelectorAll('[data-tx-group]')];
    const search = page.querySelector('[data-tx-search]');
    const empty = page.querySelector('.tx-empty'), status = page.querySelector('[data-tx-status]');
    let frame, searchTimer;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { if (cloud) packCloud(cloud); }); };
    search?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const query = search.value.normalize('NFKC').trim().toLocaleLowerCase();
        let count = 0;
        for (const item of items) {
          item.hidden = !String(item.dataset.search).normalize('NFKC').toLocaleLowerCase().includes(query);
          if (!item.hidden) count++;
        }
        for (const group of groups) group.hidden = !group.querySelector('[data-tx-item]:not([hidden])');
        for (const anchor of page.querySelectorAll('.tx-topic-nav a')) {
          const target = document.getElementById(anchor.hash.slice(1));
          anchor.hidden = !!target?.hidden;
        }
        empty.hidden = count !== 0;
        status.textContent = `找到 ${count} 项`;
        schedule();
      }, 100);
    });
    const updateMotion = () => page.classList.toggle('tx-motion-paused', document.hidden);
    const motionObserver = cloud && 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      for (const entry of entries) entry.target.classList.toggle('is-floating', entry.isIntersecting);
    }, { rootMargin: '30px' }) : null;
    if (cloud) {
      for (const item of items) { if (motionObserver) motionObserver.observe(item); else item.classList.add('is-floating'); }
      document.addEventListener('visibilitychange', updateMotion); updateMotion();
    }
    const stop = () => { observer?.disconnect(); motionObserver?.disconnect(); document.removeEventListener('visibilitychange', updateMotion); cancelAnimationFrame(frame); clearTimeout(searchTimer); };
    const observer = cloud && 'ResizeObserver' in window ? new ResizeObserver(entries => {
      const width = Math.round(entries[0].contentRect.width);
      if (cloud.dataset.width !== String(width)) { cloud.dataset.width = String(width); schedule(); }
    }) : null;
    observer?.observe(cloud);
    document.addEventListener('pjax:send', stop, { once: true });
    schedule();
    document.fonts?.ready.then(() => { if (page.isConnected) schedule(); });
  }
  window.__taxonomyPages = init;
  document.addEventListener('pjax:complete', init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
