/* Follow Butterfly's data-theme across reloads, system changes and PJAX. */
(() => {
  'use strict';
  if (window.SiteThemeToggle) return;
  const html = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let busy = false;
  const current = () => html.dataset.theme === 'dark' ? 'dark' : 'light';
  function syncButton() {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    const dark = current() === 'dark';
    button.title = dark ? '切换到浅色模式' : '切换到深色模式';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', String(dark));
    button.disabled = busy;
  }
  function applyTheme(theme) {
    theme === 'dark' ? btf.activateDarkMode() : btf.activateLightMode();
    btf.saveToLocal.set('theme', theme, 2);
    const message = typeof GLOBAL_CONFIG !== 'undefined' && GLOBAL_CONFIG.Snackbar;
    if (message) btf.snackbarShow(theme === 'dark' ? message.day_to_night : message.night_to_day);
    Object.entries(window.globalFn?.themeChange || {}).forEach(([name, callback]) => {
      const run = () => {
        try { callback(theme); } catch (error) { console.warn('[theme]', name, error); }
      };
      if (['disqus', 'disqusjs'].includes(name)) setTimeout(run, 300);
      else run();
    });
    syncButton();
  }
  function toggle() {
    if (busy) return;
    const from = current(), to = from === 'light' ? 'dark' : 'light';
    if (reducedMotion.matches) { applyTheme(to); return; }
    busy = true;
    syncButton();
    const sky = document.createElement('div');
    sky.className = 'theme-transition';
    sky.dataset.to = to;
    sky.setAttribute('aria-hidden', 'true');
    sky.innerHTML = '<div class="theme-orbit"><svg class="theme-planet theme-sun" viewBox="0 0 1024 1024"><use href="#icon-sun"/></svg><svg class="theme-planet theme-moon" viewBox="0 0 1024 1024"><use href="#icon-moon"/></svg></div>';
    document.body.appendChild(sky);
    setTimeout(() => applyTheme(to), 380);
    setTimeout(() => { sky.remove(); busy = false; syncButton(); }, 1050);
  }
  new MutationObserver(syncButton).observe(html, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('click', event => {
    if (!event.target.closest('#theme-toggle')) return;
    event.preventDefault();
    toggle();
  });
  document.addEventListener('pjax:complete', syncButton);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncButton, { once: true });
  else syncButton();
  window.switchNightMode = toggle;
  window.SiteThemeToggle = Object.freeze({ toggle });
})();
